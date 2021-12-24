from collections import defaultdict
from datetime import datetime

from common import query_rockset


def get(page=0, branch_name="master"):
    branch = f"refs/heads/{branch_name}"
    branch_commits = query_rockset("master_commits", "prod", branch=branch, page=page)
    jobs = query_rockset("hud_query", "latest", branch=branch, page=page)

    # dict of:
    # sha => commit info
    sha_to_commit = {}
    for commit in branch_commits:
        sha = commit["sha"]
        sha_to_commit[sha] = commit

    # dictionary of
    # sha => workflow_name => results
    jobs_by_sha = defaultdict(dict)
    names = set()
    for job in jobs:
        name = (job["workflow_name"], job["job_name"])
        sha = job["sha"]

        names.add(name)

        # Q: How can there be more than one job with the same name for a given sha?
        # A: Periodic builds can be scheduled multiple times for one sha. In
        # this case, display the most recent periodic job.
        if name in jobs_by_sha[sha]:
            current_job = jobs_by_sha[sha][name]
            if job["id"] < current_job["id"]:
                continue

        # remove this so that the payload doesn't contain repeated shas
        del job["sha"]
        jobs_by_sha[sha][name] = job

    # sort names alphabetically
    names = sorted(list(names))

    # subtle: our query is sorted by time desc, so `sha_to_commit` will
    # always be in the right order already.
    sha_grid = []
    for sha, commit in sha_to_commit.items():
        name_to_jobs = jobs_by_sha[sha]
        row = {
            "sha": sha,
            "time": commit["timestamp"],
            "commit_url": commit["url"],
            "commit_message": f"{commit['truncated_message']}...",
            "pr_num": commit["pr_num"],
            "jobs": [
                name_to_jobs.get(
                    name,
                    {
                        "workflow_name": name[0],
                        "job_name": name[1],
                    },
                )
                for name in names
            ],
        }

        sha_grid.append(row)

    return sha_grid, [f"{name[0]} / {name[1]}" for name in names]
