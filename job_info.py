from logging import disable
import re

from ghapi.all import GhApi

from common import query_rockset

PYTHON_TEST_FAILURE_RE = re.compile(r"^(?:FAIL|ERROR) \[.*\]: (test_.* \(.*Test.*\))")


def get(page):
    jobs = query_rockset("job_info", "prod", page=page)
    # ids are returned as both ints and string, cast them all to strings to
    # serialize keys properly
    by_id = {str(j["id"]): j for j in jobs}

    api = GhApi()
    existing_disable_test_issues = api.issues.list_for_repo(
        "pytorch", "pytorch", labels="module: flaky-tests"
    )
    existing_disable_test_issues_by_title = {}
    for issue in existing_disable_test_issues:
        if issue.title.startswith("DISABLED"):
            existing_disable_test_issues_by_title[issue.title] = issue

    for job in by_id.values():
        job["disable_issue_title"] = None
        job["existing_disable_issue"] = None

        failure_line = job["failure_line"]
        if failure_line is None:
            continue

        match = PYTHON_TEST_FAILURE_RE.search(failure_line)
        if match is None:
            continue

        disable_issue_title = f"DISABLED {match.group(1)}"
        job["disable_issue_title"] = disable_issue_title
        if disable_issue_title in existing_disable_test_issues_by_title:
            job["existing_disable_issue"] = existing_disable_test_issues_by_title[
                disable_issue_title
            ].html_url

    return by_id
