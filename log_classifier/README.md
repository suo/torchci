# log classifier

The log classifier is a Python script that runs and:

1. Downloads a log file from S3.
2. Classifies it, according to rules defined in `rules.json`.
3. Uploads the classification back to S3.

It can be run locally (see `python classify_log.py --help`), but is mostly run
by AWS Lambda (called `ossci-log-analyzer` in PyTorch's AWS account).

## How to add a new rule

1. Edit and `rules.py` to add a rule.
2. This generates `rules.json`.
3. You can run `classify_log.py <id>` to test the new rule on your local changes.
4. Commit both changes and push the result to `origin/main`.

`rules.json` is hosted on GitHub pages and the lambda code will automatically
fetch it and use it as its ruleset, so you don't need to change the lambda code.

Note that you may need to wait a few minutes for GH pages to rebuild the site.
Once your changes are visibile on
[GitHub pages](https://suo.github.io/torchci/log_classifier/rules.json),

## How to backfill a new rule

Run `backfill.py`. Note that this uses the Lambda to run the rules, so you need
to make sure [GitHub pages](https://suo.github.io/torchci/log_classifier/rules.json) reflects your changes before you run!
