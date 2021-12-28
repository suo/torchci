import rockset from "@rockset/client";
import _ from "lodash";
import { JobData, RowData } from "./types";

export default async function fetchHud(page: number): Promise<{
  shaGrid: RowData[];
  jobNames: string[];
}> {
  if (typeof process.env.ROCKSET_API_KEY === "undefined") {
    throw "ROCKSET_API_KEY is not defined, add it to your .env.local file";
  }
  const rocksetClient = rockset(process.env.ROCKSET_API_KEY);
  const hudQuery = await rocksetClient.queryLambdas.executeQueryLambdaByTag(
    "commons",
    "hud_query",
    "latest",
    {
      parameters: [
        {
          name: "branch",
          type: "string",
          value: "refs/heads/master",
        },
        {
          name: "page",
          type: "int",
          value: page.toString(),
        },
      ],
    }
  );
  const commitQuery = await rocksetClient.queryLambdas.executeQueryLambdaByTag(
    "commons",
    "master_commits",
    "latest",
    {
      parameters: [
        {
          name: "branch",
          type: "string",
          value: "refs/heads/master",
        },
        {
          name: "page",
          type: "int",
          value: page.toString(),
        },
      ],
    }
  );

  const commitsBySha = _.keyBy(commitQuery.results, "sha");
  let results = hudQuery.results;

  const namesSet: Set<string> = new Set();
  // Built a list of all the distinct job names.
  results?.forEach((job: JobData) => {
    namesSet.add(job.name);
  });
  const names = Array.from(namesSet).sort();

  // Construct mapping of sha => job name => job data
  //
  // Subtle: here, we sort the jobs by "id" first. This ensures that if there
  // are multiple jobs with the same name, the most recent one will come last,
  // and thus be the one selected by the `keyBy` call below.
  //
  // Q: How can there be more than one job with the same name for a given sha?
  // A: Periodic builds can be scheduled multiple times for one sha. In those
  // cases, we want the most recent job to be shown.
  results = _.sortBy(results, "id");
  const jobsBySha: {
    [sha: string]: { [name: string]: JobData };
  } = {};
  _.forEach(_.groupBy(results, "sha"), (jobs, sha) => {
    jobsBySha[sha] = _.keyBy(jobs, "name");
  });

  const shaGrid: RowData[] = [];

  _.forEach(commitsBySha, (commit, sha) => {
    const nameToJobs = jobsBySha[sha];
    const jobs: JobData[] = [];
    for (const name of names) {
      if (nameToJobs[name] === undefined) {
        // Insert default name
        jobs.push({
          name,
        });
      } else {
        jobs.push(nameToJobs[name]);
      }
    }

    const row: RowData = {
      sha: sha,
      time: commit.timestamp,
      commitUrl: commit.url,
      commitMessage: commit.message,
      prNum: commit.prNum,
      jobs: jobs,
    };
    shaGrid.push(row);
  });
  return { shaGrid: shaGrid, jobNames: names };
}
