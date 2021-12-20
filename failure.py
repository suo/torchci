from flask import render_template

from common import query_rockset


def get(captures):
    samples = query_rockset("failure_samples_query", "prod", captures=captures)
    count = query_rockset("failure_count_query", "prod", captures=captures)
    job_count = {}
    for result in count:
        job_count[f"{result['workflow_name']} / {result['job_name']}"] = result["count"]

    total_count = sum(job_count.values())

    return render_template(
        "failure.html",
        original_capture=captures,
        samples=samples,
        job_count=job_count,
        total_count=total_count,
        most_recent_count=min(25, total_count),
    )
