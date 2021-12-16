from collections import defaultdict
from datetime import datetime

from rockset import Q, F

from common import client, NO_LIMIT, HUD_PAGE_SIZE, COMMIT_TABLE, JOB_TABLE



def get(page=0, branch_name="master"):
    master_commit_query = (
        Q(COMMIT_TABLE)
        .where(F["ref"] == f"refs/heads/{branch_name}")
        # weird kink in Rockset querybuilder--we can't sort with a skip, but we
        # can't sort without a limit. So just sort with no limit, then do the
        # skip/take after.
        .highest(NO_LIMIT, F["timestamp"])
        .limit(HUD_PAGE_SIZE, skip=page * HUD_PAGE_SIZE)
    )
    jobs_query = (
        Q(JOB_TABLE)
        .join(
            master_commit_query,
            on=F[JOB_TABLE]["sha"] == F[COMMIT_TABLE]["sha"],
        )
        .select(
            F["workflow_name"],
            F["job_name"],
            F["conclusion"],
            F[JOB_TABLE]["sha"],
            F[JOB_TABLE]["id"],
        )
    )
    jobs = client.sql(jobs_query)
    master_commits = client.sql(master_commit_query)

    # dict of:
    # sha => commit info
    sha_to_commit = {}
    for commit in master_commits:
        sha = commit["sha"]
        sha_to_commit[sha] = commit

    # dictionary of
    # sha => workflow_name => results
    jobs_by_sha = defaultdict(dict)
    names = set()
    for job in jobs:
        name = f"{job['workflow_name']} / {job['job_name']}"
        sha = job["sha"]

        names.add(name)

        # Q: How can there be more than one job with the same name for a given sha?
        # A: Periodic builds can be scheduled multiple times for one sha. In
        # this case, display the most recent periodic job.
        if name in jobs_by_sha[sha]:
            current_job = jobs_by_sha[sha][name]
            if job["id"] < current_job["id"]:
                continue

        jobs_by_sha[sha][name] = job

    # sort names alphabetically
    names = sorted(list(names))

    # subtle: our query is sorted by time desc, so `sha_to_commit` will
    # always be in the right order already.
    sha_grid = defaultdict(list)
    for sha, commit in sha_to_commit.items():
        name_to_jobs = jobs_by_sha[sha]
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
            sha_grid[key].append(name_to_jobs.get(name))

    print("job query stats", jobs.stats())
    print("master query stats", master_commits.stats())
    return sha_grid, names
