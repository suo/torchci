import type { NextApiRequest, NextApiResponse } from "next";
import rockset from "@rockset/client";

interface Data {}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (typeof process.env.ROCKSET_API_KEY === "undefined") {
    throw "ROCKSET_API_KEY is not defined, add it to your .env.local file";
  }
  const capture = req.query!.capture;
  const rocksetClient = rockset(process.env.ROCKSET_API_KEY);

  const samples = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "failure_samples_query",
    "f89367594d5f1404",
    {
      parameters: [
        {
          name: "captures",
          type: "string",
          value: capture as string,
        },
      ],
    }
  );

  const jobCount: {
    [jobName: string]: number;
  } = {};

  for (const result of samples.results!) {
    jobCount[result.name] = (jobCount[result.name] || 0) + 1;
  }
  res.status(200).json({
    jobCount,
    totalCount: samples.results!.length,
    samples: samples.results!,
  });
}
