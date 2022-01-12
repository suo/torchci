import CommitStatus from "components/CommitStatus";
import ErrorBoundary from "components/ErrorBoundary";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CommitInfo({ sha }: { sha: string }) {
  const { data: commit, error } = useSWR(
    sha != null ? `/api/commit/${sha}` : null,
    fetcher,
    {
      refreshInterval: 60 * 1000, // refresh every minute
      // Refresh even when the user isn't looking, so that switching to the tab
      // will always have fresh info.
      refreshWhenHidden: true,
    }
  );
  if (error != null) {
    return <div>Error occured</div>;
  }

  if (commit === undefined) {
    return <div>Loading...</div>;
  }

  return <CommitStatus commit={commit} />;
}

function CommitHeader({ prData }: { prData: any }) {
  const router = useRouter();
  const pr = router.query.pr as string;

  return (
    <h2>
      Commit:{" "}
      <select
        style={{ font: "inherit" }}
        onChange={(e) => {
          router.push(`/pr/pytorch/pytorch/${pr}?sha=${e.target.value}`);
        }}
      >
        {(prData ?? []).map((commit: any, ind: number) => {
          return (
            <option key={ind} value={commit.sha}>
              {commit.commitTitle +
                ` (${commit.sha.substr(commit.sha.length - 6)})`}
            </option>
          );
        })}
      </select>
    </h2>
  );
}

function Page() {
  const router = useRouter();
  const pr = router.query.pr as string;

  const { data: prData } = useSWR(
    `/api/pr/${pr}${
      router.query.sha != null ? `?sha=${router.query.sha}` : ""
    }`,
    fetcher,
    {
      refreshInterval: 60 * 1000, // refresh every minute
      // Refresh even when the user isn't looking, so that switching to the tab
      // will always have fresh info.
      refreshWhenHidden: true,
    }
  );

  const sha =
    (router.query.sha as string) ?? (prData != null ? prData[0].sha : null);
  const prTitle = prData != null ? prData[0].title : "";
  return (
    <div>
      <h1 id="hud-header">
        PyTorch PR: <code>{`${prTitle} #${pr}`}</code>
      </h1>
      <CommitHeader prData={prData} />
      <ErrorBoundary>
        <CommitInfo sha={sha} />
      </ErrorBoundary>
    </div>
  );
}

export default function PageWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Page />
    </ErrorBoundary>
  );
}
