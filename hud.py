from collections import defaultdict
from datetime import datetime
from flask import render_template

from common import query_rockset


def get():
    results = query_rockset("hud_query", "11d33dd45434cccd")
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

    return render_template("index.html", sha_grid=sha_grid, names=names)
