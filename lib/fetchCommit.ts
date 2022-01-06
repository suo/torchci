import _ from "lodash";
import getRocksetClient from "./rockset";

import { CommitData } from "./types";

export default async function fetchCommit(sha: string): Promise<CommitData> {
  const rocksetClient = getRocksetClient();
  const commitQuery = await rocksetClient.queryLambdas.executeQueryLambdaByTag(
    "commons",
    "commit_query",
    "latest",
    {
      parameters: [
        {
          name: "sha",
          type: "string",
          value: sha,
        },
      ],
    }
  );

  const commitJobsQuery = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "commit_jobs_query",
    "4ba333d37b875c58",
    {
      parameters: [
        {
          name: "sha",
          type: "string",
          value: sha,
        },
      ],
    }
  );

  const commit = commitQuery.results?.[0].commit;
  const firstLine = commit.message.indexOf("\n");
  const commitTitle: string = commit.message.slice(0, firstLine);
  const commitMessageBody: string = commit.message.slice(firstLine + 1);

  const pullRe = /Pull Request resolved: (.*)/;
  const exportedPhabRegex = /Differential Revision: \[(.*)\]/;
  const commitedPhabRegex = /Differential Revision: (D.*)/;

  let match = commitMessageBody.match(pullRe);
  const prUrl = match ? match[1] : null;

  match = commitMessageBody.match(exportedPhabRegex);
  if (match === null) {
    match = commitMessageBody.match(commitedPhabRegex);
  }

  let jobs = commitJobsQuery.results!;

  // Subtle: we need to unique jobs by name, taking the most recent job. This is
  // because there might be many periodic jobs with the same name, and we want
  // to avoid noising up the display with many duplicate jobs.
  jobs = _.sortBy(jobs, "id").reverse();
  jobs = _.uniqBy(jobs, "name");
  // Now reverse again, because we want to display earlier jobs first in the the UI.
  jobs.reverse();

  const diffNum = match ? match[1] : null;
  return {
    sha: commit.id,
    commitTitle,
    commitMessageBody,
    prUrl,
    diffNum,
    jobs,
  };
}