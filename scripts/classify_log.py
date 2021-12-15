"""
classify_log.py

Given an GitHub workflow job id or set of ids,
- Download the logs from s3.
- Classify them according to provided rules.
- Optionally, write the classification back to s3.

This is intended to be run from a lambda, but can be run manually as well.
"""

import gzip
import json
import logging
import re
from itertools import cycle
from multiprocessing import Pipe, Process

logger = logging.getLogger()
logger.setLevel(logging.INFO)


import boto3  # type: ignore

WRITE_TO_S3 = True


class Rule:
    def __init__(self, name, pattern, priority):
        self.name = name
        if isinstance(pattern, str):
            pattern = pattern.encode()

        self.pattern = re.compile(pattern)
        self.priority = priority

    def match(self, line):
        return self.pattern.search(line)


class RuleMatch:
    def __init__(self, rule, line_num):
        self.rule: Rule = rule
        self.line_num: int = line_num


class RuleEngine:
    DUMMY_RULE = Rule("dummy", "", -1)

    def __init__(self, rules):
        # Sort rules so that the highest priority is first
        self.rules = sorted(rules, key=lambda rule: rule.priority, reverse=True)
        self._best_match = RuleMatch(self.DUMMY_RULE, "")

    def run(self, lines):
        """Find the highest-priority matching rule from this log.

        This uses multiple processes to match lines in parallel. Certain logs
        (long logs with long lines, e.g. windows logs) cause a non-parallel
        implementation to timeout on lambda.
        """
        # Split the work into buckets so we can parallelize.
        num_buckets = 6  # hard-coded because AWS Lambda supports max 6 vcpus.
        buckets = [[] for _ in range(num_buckets)]
        lines_with_num = list(enumerate(lines))
        for elem, bucket in zip(lines_with_num, cycle(buckets)):
            bucket.append(elem)

        # create a list to keep all processes
        processes = []

        # create a list to keep connections
        parent_connections = []

        # create a process per bucket
        for bucket in buckets:
            # create a pipe for communication
            # we are doing this manually because AWS lambda doesn't have shm
            # (and thus can't use most higher-order multiprocessing primitives)
            parent_conn, child_conn = Pipe()
            parent_connections.append(parent_conn)

            # send the work over
            process = Process(
                target=self.process_bucket,
                args=(
                    bucket,
                    child_conn,
                ),
            )
            processes.append(process)

        for process in processes:
            process.start()
        for process in processes:
            process.join()

        # get the best match from all the processes
        for parent_conn in parent_connections:
            match = parent_conn.recv()
            if match == None:
                continue
            if match.rule.priority > self._best_match.rule.priority:
                self._best_match = match

    def process_bucket(self, bucket, conn):
        for num, line in bucket:
            self.process_line(num, line)
        conn.send(self.best_match())
        conn.close()

    def process_line(self, line_num, line):
        for rule in self.rules:
            match = rule.match(line)
            if match is not None:
                if rule.priority > self._best_match.rule.priority:
                    self._best_match = RuleMatch(rule, line_num)

        # optimization: remove rules we know can't beat the current one
        new_rules = []
        for rule in self.rules:
            if rule.priority > self._best_match.rule.priority:
                new_rules.append(rule)
        self.rules = new_rules

    def best_match(self):
        if self._best_match.rule is self.DUMMY_RULE:
            return None
        return self._best_match


# Guidelines for writing rules:
# - Start with ^ if you can, it makes filtering out non-matching lines faster.
# - Try to make sure the produced "captures" field is useful:
#   - It should have enough information to identify the failure.
#   - It should be groupable; e.g. there should be no random noise in the capture group.
# - If no capture groups are specified, the "captures" field is the whole match.
#
# - Try to match against as much information as possible, so that captures are interesting.
#     For example, instead of 'error: ', do 'error: .*'
# - You can use capture groups to filter out line noise, so that we can aggregate on captures.
#     For example, for the failure 'FAIL [10.2s]: test_foo', 'test_foo' is a
#     good capture group, as it filters out test timings which might be
#     variable.
rules = [
    Rule(
        "NVIDIA installation failure", r"^ERROR: Installation has failed.*?nvidia", 1000
    ),
    Rule(
        "Python unittest error", r"FAIL \[.*\]: (test.*) \((?:__main__\.)?(.*)\)", 999
    ),
    Rule("MSVC out of memory", r"Catastrophic error: .*", 998),
    Rule("MSVC compiler error", r"^.*\(\d+\): error C\d+:.*", 999),
    Rule("Compile error", r"^.*\d+:\d+: error: .*", 997),
    Rule("Curl error", r"curl: .* error:", 996),
    Rule("Dirty checkout", r"^Build left local git repository checkout dirty", 995),
    Rule(
        "Docker manifest error",
        r"^ERROR: Something has gone wrong and the previous image isn't available for the merge-base of your branch",
        994,
    ),
    Rule("Python AttributeError", r"^AttributeError: .*", 100),
    Rule("Python RuntimeError", r"^RuntimeError: .*", 99),
]

s3 = boto3.resource("s3")
BUCKET_NAME = "ossci-raw-job-status"


def match_to_json(id, rule_match, lines):
    context_start = max(0, rule_match.line_num - 25)
    context_end = rule_match.line_num + 25
    context = lines[context_start:context_end]
    context = [line.rstrip() for line in context]
    context = b"\n".join(context)

    # perform matching to get capture groups
    line = lines[rule_match.line_num]
    match = rule_match.rule.match(line)
    capture_groups = match.groups(default="<no capture>")
    if len(capture_groups) == 0:
        captures = match.group(0)
    else:
        captures = b", ".join(match.groups(default="<no capture>"))

    return json.dumps(
        {
            "job_id": int(id),
            "rule": rule_match.rule.name,
            # decode with replace to avoid raising errors on non-utf8 characters
            "line": line.decode(errors="replace").strip(),
            "context": context.decode(errors="replace"),
            "captures": captures.decode(errors="replace").strip(),
        },
        indent=4,
    )


def classify(id):
    logger.info(f"classifying {id}")
    logger.info("fetching from s3")
    log_obj = s3.Object(BUCKET_NAME, f"log/{id}")
    log_obj.load()

    if log_obj.metadata.get("conclusion") != "failure":
        # only classify failed jobs
        logger.info("skipping non-failing job")
        return

    log = log_obj.get()

    # logs are stored gzip-compressed
    logger.info("decompressing")
    log = gzip.decompress(log["Body"].read())
    lines = log.split(b"\n")

    # GHA adds a timestamp to the front of every log. Strip it before matching.
    logger.info("stripping timestamps")
    for idx, line in enumerate(lines):
        lines[idx] = line.partition(b" ")[2]

    logger.info("running engine")
    engine = RuleEngine(rules)
    engine.run(lines)
    match = engine.best_match()
    if not match:
        logger.info("no match found")
        return "no match found"

    json = match_to_json(id, match, lines)
    if WRITE_TO_S3:
        logger.info("writing to s3")
        s3.Object(BUCKET_NAME, f"classification/{id}").put(
            Body=json, ContentType="application/json"
        )
    else:
        logger.info("writing to stdout")
        print(json)
    logger.info("done")
    return json


def handle_s3_trigger(event):
    log_key = event["Records"][0]["s3"]["object"]["key"]
    # chop off the leading "logs/"
    id = log_key.partition("/")[2]
    return classify(id)


def handle_http_trigger(event):
    id = event["rawQueryString"]
    return classify(id)


def lambda_handler(event, context):
    if "Records" in event:
        body = handle_s3_trigger(event)
    else:
        body = handle_http_trigger(event)
    return {"statusCode": 200, "body": body}


if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(
        format="<%(levelname)s> [%(asctime)s] %(message)s",
        level=logging.INFO,
        stream=sys.stderr,
    )

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "ids",
        nargs="+",
        help="ids to classify",
    )
    parser.add_argument(
        "--update-s3",
        action="store_true",
        help="If set, write the resulting classification to s3.",
    )
    args = parser.parse_args()
    WRITE_TO_S3 = args.update_s3
    for id in args.ids:
        classify(id)
