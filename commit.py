import re
from collections import defaultdict

from flask import render_template

from common import query_rockset

PR_URL_REGEX = re.compile(r"Pull Request resolved: (.*)")
EXPORTED_PHAB_REGEX = re.compile(r"Differential Revision: \[(.*)\]")
COMMITED_PHAB_REGEX = re.compile(r"Differential Revision: (D.*)")


def _get(sha):
    commit = query_rockset("commit_query", "prod", sha=sha)[0]["commit"]
    jobs = query_rockset("commit_jobs_query", "prod", sha=sha)

    jobs = sorted(jobs, key=lambda job: job["workflow_name"] + job["job_name"])
    # dict of workflow -> jobs
    jobs_by_workflow = defaultdict(list)
    failed_workflows = set()
    failed_jobs = []
    pending_jobs = []
    for job in jobs:
        jobs_by_workflow[job["workflow_name"]].append(job)
        if job["conclusion"] in ("failure", "cancelled", "timed_out"):
            failed_jobs.append(job)
            failed_workflows.add(job["workflow_name"])
        elif job["conclusion"] == None:
            pending_jobs.append(job)

    # sort jobs by job id, which gets us the same sorting as in the GH UI
    for jobs in jobs_by_workflow.values():
        jobs.sort(key=lambda j: j["id"])

    commit_title, _, commit_message_body = commit["message"].partition("\n")
    match = PR_URL_REGEX.search(commit_message_body)
    if match is None:
        pr_url = None
    else:
        pr_url = match.group(1)

    match = EXPORTED_PHAB_REGEX.search(commit_message_body)
    if match is None:
        match = COMMITED_PHAB_REGEX.search(commit_message_body)
    if match is None:
        diff_num = None
    else:
        diff_num = match.group(1)

    return {
        "pr_url": pr_url,
        "diff_num": diff_num,
        "commit_title": commit_title,
        "commit_message_body": commit_message_body,
        "commit": commit,
        "jobs_by_workflow": jobs_by_workflow,
        "failed_workflows": failed_workflows,
        "failed_jobs": failed_jobs,
        "pending_jobs": pending_jobs,
    }


def get(sha):
    data = _get(sha)

    return render_template(
        "commit.html",
        **data,
    )
