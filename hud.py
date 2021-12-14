from collections import defaultdict
from datetime import datetime
from flask import render_template

from common import query_rockset


def get():
    results = query_rockset("hud_query", "3a1a9c9dc234906c")
    master_commits = query_rockset("master_commits", "4d94a9d08bb397fd")

    # dict of:
    # sha => commit info
    sha_to_commit = {}
    for result in master_commits:
        sha = result["sha"]
        sha_to_commit[sha] = result

    # dictionary of
    # sha => workflow_name => results
    results_by_sha = defaultdict(dict)
    names = set()
    for result in results:
        name = f"{result['workflow_name']} / {result['job_name']}"
        sha = result["sha"]

        names.add(name)

        # Q: How can there be more than one job with the same name for a given sha?
        # A: Periodic builds can be scheduled multiple times for one sha. In
        # this case, display the most recent periodic job.
        if name in results_by_sha[sha]:
            current_result = results_by_sha[sha][name]
            if result["id"] < current_result["id"]:
                continue

        results_by_sha[sha][name] = result

    # sort names alphabetically
    names = sorted(list(names))

    # subtle: our query is sorted by time desc, so `shas_to_time` will
    # always be in the right order already.
    sha_grid = defaultdict(list)
    for sha, names_to_results in results_by_sha.items():
        commit_url = sha_to_commit[sha]["url"]
        truncated_commit_message = sha_to_commit[sha]["truncated_message"]
        time = sha_to_commit[sha]["timestamp"]
        time = datetime.fromisoformat(time)
        pr_num = sha_to_commit[sha]["pr_num"]

        for name in names:
            key = (
                time,
                sha,
                commit_url,
                f"{truncated_commit_message}...",
                pr_num,
            )
            sha_grid[key].append(names_to_results.get(name))

    return sha_grid, names
