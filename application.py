from flask import Flask

import hud
import commit


application = Flask(__name__)


@application.route("/")
def root():
    return hud.get()


@application.route("/commit/<sha>")
def commit_(sha):
    return commit.get(sha)


if __name__ == "__main__":
    application.run()
