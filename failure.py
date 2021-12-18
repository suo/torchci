from collections import defaultdict

from flask import render_template

from rockset import Q, F
from common import client, NO_LIMIT


def get(capture):
    job = Q("job")
    q = (
        Q("GitHub-Actions.classification", alias="c")
        .join(job, on=F["c"]["job_id"] == F["job"]["id"])
        .where(F["captures"] == capture)
        .highest(25, F["_event_time"])
    )

    results = client.sql(q)
    count_query = (
        Q("GitHub-Actions.classification", alias="c")
        .join(job, on=F["c"]["job_id"] == F["job"]["id"])
        .where(F["captures"] == capture)
        .aggregate(F["job"]["job_name"], F["job"]["workflow_name"], F.count())
        .highest(NO_LIMIT, F.count())
    )
    count = client.sql(count_query)
    job_count = {}
    for result in count:
        job_count[f"{result['workflow_name']} / {result['job_name']}"] = result[
            "?COUNT"
        ]

    total_count = sum(job_count.values())

    render = render_template(
        "failure.html",
        original_capture=capture,
        captures=results,
        job_count=job_count,
        total_count=total_count,
        most_recent_count=min(25, total_count),
    )
    # render first to actually issue the queries so we can collect stats
    print("failure query stats", results.stats())
    print("failure count query stats", count.stats())
    return render





