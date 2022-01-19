import getRocksetClient from "./rockset";
import { PRData } from "./types";

export default async function fetchPR(pr: string): Promise<PRData> {
  const rocksetClient = getRocksetClient();
  const [prQuery, commitHistoryQuery] = await Promise.all([
    rocksetClient.queryLambdas.executeQueryLambdaByTag(
      "commons",
      "pr_query",
      "latest",
      {
        parameters: [
          {
            name: "pr",
            type: "int",
            value: pr,
          },
        ],
      }
    ),
    rocksetClient.queryLambdas.executeQueryLambdaByTag(
      "commons",
      "pr_commit_history_query",
      "latest",
      {
        parameters: [
          {
            name: "pr",
            type: "int",
            value: pr,
          },
        ],
      }
    ),
  ]);
  const prDataResult = prQuery.results![0];

  return { ...prDataResult, shas: commitHistoryQuery.results! };
}
