from flask import Flask
from flask_compress import Compress

import hud
import commit


application = Flask(__name__)

# Compress responses. The HUD is a really big HTML page, (~2MB) which actually
# takes a bit of time to send. Enabling compression with default settings
# reduces the size drastically (~40KB), which improves user-perceived perf.
Compress(application)


@application.route("/")
def root():
    return hud.get()


@application.route("/commit/<sha>")
def commit_(sha):
    return commit.get(sha)


if __name__ == "__main__":
    application.run()
