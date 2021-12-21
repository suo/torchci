import logging
import os

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
    return query_rockset("issue_query", "latest", label="ci: sev")
