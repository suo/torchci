from common import ROCKSET_API_KEY, query_rockset

from flask import render_template


def get():
    results = query_rockset("unclassified", "427a2b404175b84f")
    return render_template(
        "unclassified.html",
        results=results
    )
