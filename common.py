import logging
import os

from ghapi.all import GhApi
from rockset import Client, ParamDict

logger = logging.getLogger(__name__)

ROCKSET_API_KEY = os.environ.get("ROCKSET_API_KEY")

client = Client(
    api_key=ROCKSET_API_KEY,
    api_server="https://api.rs2.usw2.rockset.com",
)


def query_rockset(query_name, tag, **kwargs):
    global client
    qlambda = client.QueryLambda.retrieveByTag(query_name, tag=tag, workspace="commons")
    params = ParamDict(**kwargs)

    results = qlambda.execute(parameters=params)
    return results.results


def get_sev_issues():
    api = GhApi()
    try:
        return api.issues.list_for_repo("pytorch", "pytorch", labels="ci: sev")
    except Exception as e:
        logger.error("get_sev_issues failed:", e)
        return []
