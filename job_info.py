import logging
import re

from ghapi.all import GhApi

from common import query_rockset

PYTHON_TEST_FAILURE_RE = re.compile(r"^(?:FAIL|ERROR) \[.*\]: (test_.* \(.*Test.*\))")
logger = logging.getLogger(__name__)


def get(page):
    jobs = query_rockset("job_info", "prod", page=page)
    # ids are returned as both ints and string, cast them all to strings to
    # serialize keys properly
    by_id = {str(j["id"]): j for j in jobs}

    results = query_rockset("issue_query", "latest", label="skipped")
    disable_issues = {}
    for issue in results:
        if issue["title"].startswith("DISABLED"):
            disable_issues[issue["title"]] = issue

    for job in by_id.values():
        job["disable_issue_title"] = None
        job["existing_disable_issue"] = None

        failure_line = job["failure_line"]
        if failure_line is None:
            continue

        match = PYTHON_TEST_FAILURE_RE.search(failure_line)
        if match is None:
            continue

        title = f"DISABLED {match.group(1)}"
        job["disable_issue_title"] = title
        if title in disable_issues:
            job["existing_disable_issue"] = disable_issues[title]["html_url"]

    return by_id
