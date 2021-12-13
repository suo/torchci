import os
from flask import Flask
from flask_compress import Compress
from flask_caching import Cache

import hud
import commit

config = {
    "CACHE_TYPE": "SimpleCache",  # Flask-Caching related configs
    "CACHE_DEFAULT_TIMEOUT": 180,
}

# turn off caching in debug mode, since it breaks edit-reload.
if os.environ.get("FLASK_DEBUG") == "1":
    config["CACHE_TYPE"] = "NullCache"

application = Flask(__name__)
application.config.from_mapping(config)
cache = Cache(application)

# Compress responses. The HUD is a really big HTML page, (~2MB) which actually
# takes a bit of time to send. Enabling compression with default settings
# reduces the size drastically (~40KB), which improves user-perceived perf.
Compress(application)


@application.route("/")
@cache.cached()
def root():
    return hud.get()


@application.route("/commit/<sha>")
def commit_(sha):
    return commit.get(sha)


if __name__ == "__main__":
    application.run()
