import os
import time
from datetime import datetime

from rockset import Client, ParamDict

ROCKSET_API_KEY = os.environ.get("ROCKSET_API_KEY")


class CachedQuery:
    def __init__(self, fn, *, query_name, kwargs, evict_after_sec):
        self.fn = fn
        self.query_name = query_name
        self.kwargs = kwargs
        self.evict_after_sec = evict_after_sec
        self.cached_result = None
        self.last_cache_update = datetime.now()

    def __call__(self):
        now = datetime.now()
        delta = now - self.last_cache_update
        if delta.seconds <= self.evict_after_sec and self.cached_result:
            return self.cached_result

        self.last_cache_update = now

        start = time.perf_counter()
        self.cached_result = self.fn(**self.kwargs)
        print(
            f"Uncached query '{self.query_name}' took {time.perf_counter() - start} seconds"
        )

        return self.cached_result


client = Client(
    api_key="ROCKSET_API_KEY",
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
