from rockset import Client, Q, F
from common import ROCKSET_API_KEY

from flask import render_template


def get():
    client = Client(
        api_key=ROCKSET_API_KEY,
        api_server="https://api.rs2.usw2.rockset.com",
    )
    q = (
        Q("GitHub-Actions.workflow_job", alias="job")
        .join(
            Q("GitHub-Actions.workflow_run", alias="workflow"),
            on=(F["job"]["run_id"] == F["workflow"]["id"]),
        )
        .left_outer_join(
            Q("GitHub-Actions.classification", alias="classification"),
            on=(F["job"]["id"] == F["classification"]["job_id"]),
        )
        .select(F["job"]["html_url"], F["job"]["id"])
        .where(
            (F["job"]["conclusion"] == "failure")
            & (F["classification"]["line"].is_null())
        ).limit(100)
    )
    results = client.sql(q)

    return render_template(
        "unclassified.html",
        results=results
    )
