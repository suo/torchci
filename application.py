import os
from flask import Flask
from flask.templating import render_template
from flask_compress import Compress
from flask_caching import Cache
from flask_apscheduler import APScheduler

import requests

import hud
import commit
from common import query_rockset, ParamDict

FLASK_DEBUG = os.environ.get("FLASK_DEBUG") == "1"

config = {
    "CACHE_TYPE": "SimpleCache",  # Flask-Caching related configs
    "CACHE_DEFAULT_TIMEOUT": 15,
}

# turn off caching in debug mode, since it breaks edit-reload.
if FLASK_DEBUG:
    config["CACHE_TYPE"] = "NullCache"

application = Flask(__name__)
application.config.from_mapping(config)
cache = Cache(application)

# Compress responses. The HUD is a really big HTML page, (~2MB) which actually
# takes a bit of time to send. Enabling compression with default settings
# reduces the size drastically (~40KB), which improves user-perceived perf.
Compress(application)


@cache.cached(key_prefix="hud_query")
def _cached_hud():
    """Cache the results of the HUD query so that we don't have to hit rockset on every request."""
    return hud.get()


@application.route("/")
@cache.cached()
def hud_():
    """Main PyTorch HUD page.

    NOTE: there is a second cache.cached() decorator on this function. This is
    so that template rendering is cached as well, not just the rockset query.
    """
    sha_grid, names = _cached_hud()
    return render_template("index.html", sha_grid=sha_grid, names=names)


@application.route("/commit/<sha>")
def commit_(sha):
    return commit.get(sha)


# Really we could have queried Rockset directly from JSON, but that requires
# figuring out API authentication from the client. Making the server act as a
# proxy lets us avoid that.
#
# It also lets us render tooltip html in jinja.
@application.route("/job_dialog/<int:id>")
def job_dialog(id):
    result = query_rockset("job_dialog", "e74f51dd2fa6fc39", ParamDict({"job_id": id}))
    result = result[0]
    return {"html": render_template("job_dialog.html", result=result, id=id)}


# Periodically prefetch the hud query so that users always hit cache.
# Turned off in debug mode, since we don't cache in debug mode.
if not FLASK_DEBUG:
    scheduler = APScheduler()

    @scheduler.task("interval", seconds=10)
    def prefetch_hud():
        _cached_hud()

    scheduler.init_app(application)
    scheduler.start()

if __name__ == "__main__":
    application.run()
