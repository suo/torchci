asdf# torchci

## Develop locally

Install dependencies:
```bash
pip install -r requirements.txt
```

You will need a Rockset API key. You can get it from the
[Rockset console](https://console.rockset.com/apikeys). It's the key named `hud`.

Run a local server:
```bash
ROCKSET_API_KEY=<key from above> FLASK_DEBUG=1 FLASK_APP=application.py flask run
```

## Deploy

You will need first need to install and configure the [Elastic Beanstalk CLI](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html)
and the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html).

To set up the Elastic Beanstalk CI with this repo, follow these steps:
1. `eb init`
2. Select `us-east-1` as the default region.
3. Select `pytorch-ci-hud` as the application to use.
4. Do not continue with CodeCommit (why do they even ask for this?)
5. Run `eb use torchci`

After this, `eb status` should show something like:
```
Environment details for: torchci
  Application name: pytorch-ci-hud
  Region: us-east-1
  Deployed Version: app-14e9-211209_212625
  Environment ID: e-ikdb6gev2s
  Platform: arn:aws:elasticbeanstalk:us-east-1::platform/Python 3.8 running on 64bit Amazon Linux 2/3.3.8
  Tier: WebServer-Standard-1.0
  CNAME: torchci.eba-hgmjcuka.us-east-1.elasticbeanstalk.com
  Updated: 2021-12-10 05:45:28.818000+00:00
  Status: Ready
  Health: Green
```

If you are on your laptop (or something else with a web browser), `eb open` will
open up a link to the site.

Make some changes, commit them, then run `eb deploy` to deploy them!
