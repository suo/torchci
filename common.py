import os
import time
from datetime import datetime

from rockset import Client, ParamDict

ROCKSET_API_KEY = os.environ.get("ROCKSET_API_KEY")

client = Client(
    api_key=ROCKSET_API_KEY,
    api_server="https://api.rs2.usw2.rockset.com",
)


def query_rockset(query_name, version, workspace="commons"):
    global client
    # retrieve Query Lambda
    qlambda = client.QueryLambda.retrieve(
        query_name, version=version, workspace="commons"
    )

    params = ParamDict()

    results = qlambda.execute(parameters=params)
    return results.results
