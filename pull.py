from flask import render_template

from rockset import Q, F

import commit
from common import client


def get(pull_number, selected_sha=None):
    q = Q("pull_request").where(F["number"] == pull_number)
    results = client.sql(q)
    shas = [result["sha"] for result in results]
    if selected_sha is None:
        selected_sha = shas[0]

    data = commit._get(selected_sha)

    return render_template(
        "pull.html",
        pull_number=pull_number,
        shas=shas,
        selected_sha=selected_sha,
        **data
    )
