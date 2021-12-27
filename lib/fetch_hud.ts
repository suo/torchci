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
  const hudQuery = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "hud_query",
    "6f2cec5f159dda28",
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
  const commitQuery = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "master_commits",
    "c6a23106e970612a",
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
  const results = hudQuery.results;

  const namesSet: Set<string> = new Set();
  // Built a list of all the distinct job names.
  results?.forEach((job: JobData) => {
    namesSet.add(job.name);
  });
  const names = Array.from(namesSet).sort();

  // Construct mapping of sha => job name => job data
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
          name: name,
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
