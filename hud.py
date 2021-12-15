from collections import defaultdict
from datetime import datetime

from rockset import Q, F

from common import client

# workaround rockset's somewhat clunky Python API.
NO_LIMIT = 99999999999999
PAGE_SIZE = 50
MASTER_COMMIT_TABLE = "master_commit"
MASTER_JOB_TABLE = "master_job"
# Switch to use test view
if False:
    MASTER_COMMIT_TABLE = "test_master_commit"
    MASTER_JOB_TABLE = "test_master_job"


def get(page=0):
    master_commit_query = (
        Q(MASTER_COMMIT_TABLE)
        # weird kink in Rockset querybuilder--we can't sort with a skip, but we
        # can't sort without a limit. So just sort with no limit, then do the
        # skip/take after.
        .highest(NO_LIMIT, F["timestamp"]).limit(PAGE_SIZE, skip=page * PAGE_SIZE)
    )
    results = client.sql(
        Q(MASTER_JOB_TABLE).join(
            master_commit_query,
            on=F[MASTER_JOB_TABLE]["sha"] == F[MASTER_COMMIT_TABLE]["sha"],
        )
    )
    master_commits = client.sql(master_commit_query)

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

    # subtle: our query is sorted by time desc, so `sha_to_commit` will
    # always be in the right order already.
    sha_grid = defaultdict(list)
    for sha, commit in sha_to_commit.items():
        name_to_results = results_by_sha[sha]
        commit_url = commit["url"]
        time = commit["timestamp"]
        time = datetime.fromisoformat(time)
        pr_num = commit["pr_num"]
        truncated_commit_message = commit["truncated_message"]

        for name in names:
            key = (
                time,
                sha,
                commit_url,
                f"{truncated_commit_message}...",
                pr_num,
            )
            sha_grid[key].append(name_to_results.get(name))

    print("job query stats", results.stats())
    print("master query stats", master_commits.stats())
    return sha_grid, names
