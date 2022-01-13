import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { Context, Probot } from "probot";
import {
  EmitterWebhookEvent as WebhookEvent,
  EmitterWebhookEventName as WebhookEvents,
} from "@octokit/webhooks";

function narrowType<E extends WebhookEvents>(
  event: E,
  context: WebhookEvent
): context is WebhookEvent<E> {
  return context.name === event;
}

async function handleWorkflowJob(
  event: WebhookEvent<"workflow_run" | "workflow_job">
) {
  // [WebhookEvent typing]: `event` is really a Probot.Context, but if we try to
  // do any strong type checking on `context.payload` TypeScript errors out with
  // "union too complex"-type errors. This is fixed by mostly passing around
  // `event` as a `WebhookEvent` (which it "inherits" from). But sometimes we
  // need the actual context object (for logging and such), so declare it here
  // as well
  const context = event as Context;

  // Here we intentionally don't generate a uuid so that webhook payloads
  // that map to a single payload overwrite each other, which gives us the
  // behavior that the object always represents the latest state of a job.
  //
  // However this means that there is the chance that job ids from
  // different repos could collide. To prevent this, prefix the objects
  // generated by non-pytorch repos (we could prefix pytorch objects as we
  // well, but I'm too lazy to do the data migration).
  const repo = event.payload.repository.full_name;
  let repo_prefix;
  if (repo === "pytorch/pytorch") {
    repo_prefix = "";
  } else {
    repo_prefix = repo + "/";
  }

  let key;
  let payload;
  if (narrowType("workflow_job", event)) {
    key = `${repo_prefix}${event.payload.workflow_job.id}`;
    payload = event.payload.workflow_job;
  } else if (narrowType("workflow_run", event)) {
    key = `${repo_prefix}${event.payload.workflow_run.id}`;
    payload = event.payload.workflow_run;
  }

  const client = DynamoDBDocument.from(
    new DynamoDB({
      credentials: {
        accessKeyId: process.env.OUR_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.OUR_AWS_SECRET_ACCESS_KEY!,
      },
      region: "us-east-1",
    })
  );

  await client.put({
    TableName: "torchci-workflow-job",
    Item: {
      dynamoKey: key,
      ...payload,
    },
  });
}

export default function webhookToDynamo(app: Probot) {
  app.on(["workflow_job", "workflow_run"], handleWorkflowJob);
}
