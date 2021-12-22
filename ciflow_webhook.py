import hashlib
import hmac
import logging
import os

from flask import request
from ghapi.all import GhApi


logger = logging.getLogger(__name__)

CIFLOW_WEBHOOK_SECRET = os.environ.get("CIFLOW_WEBHOOK_SECRET")
CIFLOW_LABELS = set(["ciflow/trunk", "ciflow/periodic", "ciflow/all"])


def _f(rem, quota):
    logger.info(f"Quota remaining: {rem} of {quota}")


def synchronize_tag(tag, head_sha):
    """Make sure ``tag`` points to ``head_sha``, deleting old tags as necessary.

    ``tag`` looks like: "ciflow/trunk/12345"
    """
    logger.info(f"synchronizing tag {tag} to head_sha {head_sha}")
    api = GhApi(limit_cb=_f)
    matching_tags = api.git.list_matching_refs("pytorch", "pytorch", f"tags/{tag}")
    for match in matching_tags:
        if match.ref == f"refs/tags/{tag}":
            if match.object.sha == head_sha:
                logger.info(f"noop: tag {tag} is already up to date on sha {head_sha}")
                return

            logger.info(f"deleting out of date tag {tag} on sha {match.object.sha}")
            api.git.delete_ref("pytorch", "pytorch", f"tags/{tag}")
            break

    logger.info(f"creating tag {tag} on sha {head_sha}")
    api.git.create_ref("pytorch", "pytorch", f"refs/tags/{tag}", head_sha)


def rm_tag(tag):
    """Delete ``tag`` from the repo if necessary.

    ``tag`` looks like: "ciflow/trunk/12345"
    """
    logger.info(f"cleaning up tag {tag}")
    api = GhApi(limit_cb=_f)

    matching_tags = api.git.list_matching_refs("pytorch", "pytorch", f"tags/{tag}")
    for match in matching_tags:
        if match.ref == f"refs/tags/{tag}":
            logger.info(f"deleting out of date tag {tag}")
            api.git.delete_ref("pytorch", "pytorch", f"tags/{tag}")
            return

    logger.info(f"Didn't find tag {tag}")


def validate_webhook():
    """Check that the the webhook secret matches the one we set in GitHub."""
    sha_name, signature = request.headers["X-Hub-Signature-256"].split("=")
    if sha_name != "sha256":
        return False

    mac = hmac.new(
        CIFLOW_WEBHOOK_SECRET.encode(), msg=request.data, digestmod=hashlib.sha256
    )
    return hmac.compare_digest(mac.hexdigest(), signature)


def post():
    if not validate_webhook():
        return "Invalid signature", 400

    if request.headers["X-GitHub-Event"] != "pull_request":
        return "ignored non-pull request webhook"

    payload = request.get_json()

    # For now, gate on suo only
    if payload["pull_request"]["user"]["login"] != "suo":
        return "suo only!"

    pr_num = payload["number"]
    action = payload["action"]
    logger.info(f"processing pull request webhook with action {action}")

    # Clean up tags when we unlabel or close a PR
    if action == "closed":
        for label in CIFLOW_LABELS:
            rm_tag(f"{label}/{pr_num}")
        return "ok"

    if action == "unlabeled":
        label = payload["label"]["name"]
        if label in CIFLOW_LABELS:
            rm_tag(f"{label}/{pr_num}")
        return "ok"

    # Otherwise, synchronize all CIFlow labels with the PR's head sha.
    if action not in ("labeled", "synchronize", "opened", "reopened"):
        return f"ignored action {action} as it was not a synchronization event."

    labels = [label["name"] for label in payload["pull_request"]["labels"]]
    labels = filter(lambda x: x in CIFLOW_LABELS, labels)

    head_sha = payload["pull_request"]["head"]["sha"]
    for label in labels:
        tag = f"{label}/{pr_num}"
        synchronize_tag(tag, head_sha)

    return "ok"
