import _ from "lodash";
import getRocksetClient from "./rockset";
import { HudParams, JobData, RowData } from "./types";

export default async function fetchHud(params: HudParams): Promise<{
  shaGrid: RowData[];
  jobNames: string[];
}> {
  const rocksetClient = getRocksetClient();
  const hudQuery = await rocksetClient.queryLambdas.executeQueryLambdaByTag(
    "commons",
    "hud_query",
    "latest",
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
  const commitQuery = await rocksetClient.queryLambdas.executeQueryLambdaByTag(
    "commons",
    "master_commits",
    "latest",
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

  const commitsBySha = _.keyBy(commitQuery.results, "sha");
  let results = hudQuery.results;

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
  results!.forEach((job: JobData) => {
    if (jobsBySha[job.sha!] === undefined) {
      jobsBySha[job.sha!] = {};
    }

    const existingJob = jobsBySha[job.sha!][job.name];
    if (existingJob !== undefined) {
      // If there are multiple jobs with the same name, we want the most recent.
      // Q: How can there be more than one job with the same name for a given sha?
      // A: Periodic builds can be scheduled multiple times for one sha. In those
      // cases, we want the most recent job to be shown.
      if (job.id! > existingJob.id!) {
        jobsBySha[job.sha!][job.name] = job;
      }
    } else {
      jobsBySha[job.sha!][job.name] = job;
    }
  });

  const shaGrid: RowData[] = [];

  _.forEach(commitsBySha, (commit, sha) => {
    const jobs: JobData[] = [];
    const nameToJobs = jobsBySha[sha];
    for (const name of names) {
      if (nameToJobs === undefined || nameToJobs[name] === undefined) {
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
