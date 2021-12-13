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
import re
from argparse import ArgumentParser

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

    def process(self, line_num, line):
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


rules = [
    Rule(
        "Python unittest error", r"FAIL \[.*\]: (test.*) \((?:__main__\.)?(.*)\)", 999
    ),
    Rule("MSVC out of memory", r"Catastrophic error", 998),
    Rule("Compile error", r"(.*\d+:\d+): error: (.*)", 997),
    Rule("Curl error", r"curl: .* error:", 997),
    Rule("Dirty checkout", r"Build left local git repository checkout dirty", 997),
]

s3 = boto3.resource("s3")
BUCKET_NAME = "ossci-raw-job-status"


def match_to_json(id, match, lines):
    context_start = max(0, match.line_num - 25)
    context_end = match.line_num + 25
    context = lines[context_start:context_end]
    context = [line.rstrip() for line in context]
    context = b"\n".join(context)

    return json.dumps(
        {
            "job_id": int(id),
            "rule": match.rule.name,
            # decode with replace to avoid raising errors on non-utf8 characters
            "line": lines[match.line_num].decode(errors="replace").strip(),
            "context": context.decode(errors="replace"),
        },
        indent=4,
    )


def classify(id):
    print(f"classifying {id}")
    log_obj = s3.Object(BUCKET_NAME, f"log/{id}")
    log_obj.load()

    if log_obj.metadata.get("conclusion") != "failure":
        # only classify failed jobs
        print("skipping non-failing job")
        return

    log = log_obj.get()

    engine = RuleEngine(rules)

    # logs are stored gzip-compressed
    log = gzip.decompress(log["Body"].read())
    lines = log.split(b"\n")

    # GHA adds a timestamp to the front of every log. Strip it before matching.
    for idx, line in enumerate(lines):
        lines[idx] = line.partition(b" ")[2]

    for i, line in enumerate(lines):
        engine.process(i, line)
    match = engine.best_match()
    if not match:
        print("no match found")
        return "no match found"

    json = match_to_json(id, match, lines)
    if WRITE_TO_S3:
        s3.Object(BUCKET_NAME, f"classification/{id}").put(Body=json)
    print(json)
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

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "ids",
        nargs="+",
        help="ids to classify",
    )
    parser.add_argument(
        "--do-write",
        action="store_true",
        help="If set, write the resulting classification to s3.",
    )
    args = parser.parse_args()
    WRITE_TO_S3 = args.do_write
    for id in args.ids:
        classify(id)
