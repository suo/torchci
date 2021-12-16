import os
import time
from datetime import datetime

from rockset import Client, ParamDict

ROCKSET_API_KEY = os.environ.get("ROCKSET_API_KEY")
NO_LIMIT = 99999999999999
HUD_PAGE_SIZE = 50
COMMIT_TABLE = "commit"
JOB_TABLE = "job"

# Switch to use test view
# COMMIT_TABLE = "test_commit"
# JOB_TABLE = "test_job"

client = Client(
    api_key=ROCKSET_API_KEY,
    api_server="https://api.rs2.usw2.rockset.com",
)


def query_rockset(query_name, version, params=None, workspace="commons"):
    global client
    # retrieve Query Lambda
    qlambda = client.QueryLambda.retrieve(
        query_name, version=version, workspace="commons"
    )
    if params == None:
        params = ParamDict()

    results = qlambda.execute(parameters=params)
    return results.results
