from collections import defaultdict
from flask import render_template
from rockset import Client, ParamDict
from common import ROCKSET_API_KEY


def do_commit_query(sha):
    rs = Client(
        api_key=ROCKSET_API_KEY,
        api_server="https://api.rs2.usw2.rockset.com",
    )
    qlambda = rs.QueryLambda.retrieve(
        "commit_query", version="a7158163d4bb8846", workspace="commons"
    )

    params = ParamDict()
    params["sha"] = sha
    results = qlambda.execute(parameters=params)
    return results.results[0]["commit"]


def do_commit_jobs_query(sha):
    rs = Client(
        api_key=ROCKSET_API_KEY,
        api_server="https://api.rs2.usw2.rockset.com",
    )
    qlambda = rs.QueryLambda.retrieve(
        "commit_jobs_query", version="2901d4cc01547811", workspace="commons"
    )

    params = ParamDict()
    params["sha"] = sha
    results = qlambda.execute(parameters=params)
    return results.results


def get(sha):
    commit = do_commit_query(sha)
    jobs = do_commit_jobs_query(sha)

    # dict of workflow -> jobs
    jobs_by_workflow = defaultdict(list)
    for job in jobs:
        jobs_by_workflow[job["workflow_name"]].append(job)


    # sort jobs by job id, which gets us the same sorting as in the GH UI
    for jobs in jobs_by_workflow.values():
        jobs.sort(key=lambda j: j["id"])

    commit_title, _, commit_message_body = commit["message"].partition("\n")

    return render_template(
        "commit.html",
        commit_title=commit_title,
        commit_message_body=commit_message_body,
        commit=commit,
        jobs_by_workflow=jobs_by_workflow,
    )
