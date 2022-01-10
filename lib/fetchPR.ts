import getRocksetClient from "./rockset";
import { PRData } from "./types";

export default async function fetchPR(pr: string): Promise<PRData[]> {
  const rocksetClient = getRocksetClient();
  const PRQuery = await rocksetClient.queryLambdas.executeQueryLambda(
    "commons",
    "prs_query",
    "fb017667a2a06c9a",
    {
      parameters: [
        {
          name: "pr",
          type: "int",
          value: pr,
        },
      ],
    }
  );
  const shaSet = new Set();
  const results: PRData[] = [];

  (PRQuery.results ?? []).map(({ sha, event_time, commit }) => {
    if (!shaSet.has(sha)) {
      const shaString = sha as string;
      const eventTime = event_time as string;
      const firstLine = commit.indexOf("\n");
      const commitTitle: string = commit.slice(0, firstLine);
      shaSet.add(shaString);
      results.push({ sha: shaString, eventTime, commitTitle });
    }
  });
  return results;
}
