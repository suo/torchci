import rockset from "@rockset/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { CommitData } from "../lib/types";

interface Data {
  commit: CommitData;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (typeof process.env.ROCKSET_API_KEY === "undefined") {
    throw "ROCKSET_API_KEY is not defined, add it to your .env.local file";
  }
  const rocksetClient = rockset(process.env.ROCKSET_API_KEY);
  const commitQuery = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "commit_query",
    "a7158163d4bb8846",
    {
      parameters: [
        {
          name: "sha",
          type: "string",
          value: req.query.sha as string,
        },
      ],
    }
  );

  const commitJobsQuery = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "commit_jobs_query",
    "803e9d0421652e51",
    {
      parameters: [
        {
          name: "sha",
          type: "string",
          value: "",
        },
      ],
    }
  );

  const commit = commitQuery.results?.[0].commit;
  const firstLine = commit.message.indexOf("\n");
  const commitTitle = commit.message.slice(0, firstLine);
  const commitMessage = commit.message.slice(firstLine + 1);
  const foo: CommitData = {
      sha: commit.id,
      commitTitle,
      commitMessage,
  }

  res.status(200).json({commit, foo});
}
