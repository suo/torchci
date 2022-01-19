"""Collection of random functionality for backfilling dynamo
"""

import logging
import datetime
import uuid
import os
import sys
import concurrent.futures
import json
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

s3 = boto3.resource("s3")
dynamodb = boto3.resource("dynamodb")
BUCKET_NAME = "ossci-raw-job-status"


def backfill_obj(table, obj, key_fn):
    """Add this S3 object handle to DynamoDB.

    Args:
        table: DynamoDB table resource to add the object to.
        obj: the S3 ObjectSummary to add
        key_fn: lambda that accepts the json obj and return a primary key
    """
    key = f"pytorch/pytorch/{key_fn(obj)}"
    obj["dynamoKey"] = key
    logger.info(f"Backfilling obj {key}")

    try:
        table.put_item(
            Item=obj,
            ConditionExpression="attribute_not_exists(dynamoKey)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.info("Key already exists, skipping")
        else:
            raise

    logger.info(f"SUCCESS {key}")


def backfill_bucket(prefix, table_name, key_fn):
    """Backfill all objects in the bucket with the given prefix.

    Args:
        prefix: prefix to filter the objects to backfill
        table_name: the name of the dynamodb table
        key_fn: lambda that accepts the json obj and returns a primary key
    """
    table = dynamodb.Table(table_name)
    obj_list = s3.Bucket(BUCKET_NAME).objects.filter(Prefix=prefix)

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=os.cpu_count(),
        thread_name_prefix="Thread",
    ) as executor:
        futures = []
        for obj in obj_list:
            obj = obj.get()
            obj = json.load(obj["Body"])
            futures.append(executor.submit(backfill_obj, table, obj, key_fn))
        concurrent.futures.wait(futures)


def backfill_pr():
    """One off for populating historical PR data.

    How to retrieve from GH API:

    Get all pull requests:
        gh api -X GET repos/pytorch/pytorch/pulls -f 'state=all' --paginate > pr.json

    Make it one PR for line:
        cat pr.json | jq -c '.[]' > pr_line.json
    """
    table = dynamodb.Table("torchci-pull-request")

    def backfill(obj):
        key = f"pytorch/pytorch/{obj['number']}"
        obj["dynamoKey"] = key
        logger.info(f"Backfilling pr {obj['number']}")

        try:
            table.put_item(
                Item=obj,
                # Overwrite old objects that came from the "issues" backfill
                ConditionExpression="attribute_exists(pull_request)",
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                logger.info("Key already exists, skipping")
            else:
                raise

        logger.info(f"SUCCESS {key}")

    with open("../pr_line.json") as f:
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=os.cpu_count(),
            thread_name_prefix="Thread",
        ) as executor:
            futures = []
            for line in f:
                obj = json.loads(line)
                futures.append(executor.submit(backfill, obj))
            concurrent.futures.wait(futures)


if __name__ == "__main__":
    logging.basicConfig(
        format="<%(levelname)s> [%(asctime)s] %(message)s",
        level=logging.INFO,
        stream=sys.stderr,
    )

    # backfill_bucket("push/", "torchci-push", lambda x: uuid.uuid4())
    # backfill_bucket("workflow_run/", "torchci-workflow-run", lambda x: x["id"])
    backfill_pr()
