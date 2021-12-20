import os
from flask import Flask, send_from_directory, request
from flask.templating import render_template
from flask_compress import Compress
from flask_caching import Cache
from flask_apscheduler import APScheduler

import hud
import commit
import unclassified
import pull
import failure

from common import query_rockset

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


@cache.memoize()
def _cached_hud(page):
    """Cache the results of the HUD query so that we don't have to hit rockset on every request."""
    return hud.get(page)


@application.route("/")
def hud_():
    """Main PyTorch HUD page.

    NOTE: there is a second cache.cached() decorator on this function. This is
    so that template rendering is cached as well, not just the rockset query.
    """
    try:
        page = int(request.args.get("page", 0))
    except ValueError:
        # just ignore weird input
        page = 0
    # and negative input
    if page < 0:
        page = 0

    sha_grid, names = _cached_hud(page)

    # Cache the template rendering as well. This needs to be memoized on page
    # since the rendered result is different for different pages.
    @cache.memoize()
    def cached_render(page):
        return render_template("hud.html", page=page, sha_grid=sha_grid, names=names)

    return cached_render(page)


@application.route("/commit/<sha>")
def commit_(sha):
    return commit.get(sha)


@application.route("/favicon.ico")
def favicon():
    return send_from_directory(
        os.path.join(application.root_path, "static"),
        "favicon.ico",
        mimetype="image/vnd.microsoft.icon",
    )


@application.route("/_unclassified")
def unclassified_():
    return unclassified.get()


@application.route("/pytorch/pytorch/pull/<int:pull_number>")
def pull_(pull_number):
    return pull.get(pull_number, None)


@application.route("/pytorch/pytorch/pull/<int:pull_number>/<string:selected_sha>")
def pull_sha_(pull_number, selected_sha):
    return pull.get(pull_number, selected_sha)


@cache.memoize()
def _cached_job_info(page):
    jobs = query_rockset("job_info", "prod", page=page)
    # ids are returned as both ints and string, cast them all to strings to
    # serialize keys properly
    by_id = {str(j["id"]): j for j in jobs}
    return by_id


@application.route("/job_info/<int:page>")
def job_info(page):
    return _cached_job_info(page)


@application.route("/failure")
def failure_():
    return failure.get(request.args.get("capture"))


# Periodically prefetch the hud query so that users always hit cache.
# Turned off in debug mode, since we don't cache in debug mode.
if not FLASK_DEBUG:
    scheduler = APScheduler()

    @scheduler.task("interval", seconds=10)
    def prefetch_hud():
        # cache first page
        _cached_hud(page=0)

    @scheduler.task("interval", seconds=10)
    def prefetch_job_info():
        # cache first page
        _cached_job_info(page=0)

    scheduler.init_app(application)
    scheduler.start()

if __name__ == "__main__":
    application.run()
