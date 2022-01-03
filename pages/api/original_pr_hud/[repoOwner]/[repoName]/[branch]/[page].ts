import type { NextApiRequest, NextApiResponse } from "next";
import { packHudParams } from "lib/types";
import getRocksetClient from "lib/rockset";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const params = packHudParams(req.query);
  const rocksetClient = getRocksetClient();
  const hudQuery = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "original_pr_hud_query",
    "fdc13fe45bf37b74",
    {
      parameters: [
        {
          name: "branch",
          type: "string",
          value: `refs/heads/${params.branch}`,
        },
        {
          name: "page",
          type: "int",
          value: params.page.toString(),
        },
      ],
    }
  );

  // Construct mapping of master commit sha => job name => job data
  const jobsBySha: {
    [sha: string]: { [name: string]: any };
  } = {};
  hudQuery.results!.forEach((job) => {
    if (jobsBySha[job.master_commit_sha] === undefined) {
      jobsBySha[job.master_commit_sha] = {};
    }

    const existingJob = jobsBySha[job.master_commit_sha][job.name];
    if (existingJob !== undefined) {
      // If there are multiple jobs with the same name, we want the most recent.
      // Q: How can there be more than one job with the same name for a given sha?
      // A: Periodic builds can be scheduled multiple times for one sha. In those
      // cases, we want the most recent job to be shown.
      if (job.id! > existingJob.id!) {
        jobsBySha[job.master_commit_sha][job.name] = job;
      }
    } else {
      jobsBySha[job.master_commit_sha!][job.name] = job;
    }
  });

  res.status(200).json(jobsBySha);
}
