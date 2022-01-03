import { durationHuman } from "./TimeUtils";
import useSWR from "swr";
import React from "react";
import { IssueData, JobData } from "../lib/types";
import { isFailedJob } from "lib/jobUtils";
import styles from "./JobLinks.module.css";

export default function JobLinks({ job }: { job: JobData }) {
  const rawLogs =
    job.conclusion !== "pending" ? (
      <span>
        <a target="_blank" rel="noreferrer" href={job.logUrl}>
          Raw logs
        </a>
      </span>
    ) : null;

  const durationS =
    job.durationS !== null ? (
      <span>{` | Duration: ${durationHuman(job.durationS!)}`}</span>
    ) : null;

  const failureCaptures =
    job.failureCaptures !== null ? (
      <span>
        {" | "}
        <a
          target="_blank"
          rel="noreferrer"
          href={`/failure/${encodeURIComponent(job.failureCaptures as string)}`}
        >
          more like this
        </a>
      </span>
    ) : null;

  return (
    <span>
      {rawLogs}
      {failureCaptures}
      {durationS}
      <OriginalPRInfo job={job} />
      <DisableIssue job={job} />
    </span>
  );
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const testFailureRe = /^(?:FAIL|ERROR) \[.*\]: (test_.* \(.*Test.*\))/;

function formatIssueBody(failureCaptures: string) {
  const examplesURL = `http://torch-ci.com/failure/${encodeURIComponent(
    failureCaptures
  )}`;
  return encodeURIComponent(`Platforms: <fill this in or delete. Valid labels are: asan, linux, mac, macos, rocm, win, windows.>

This test was disabled because it is failing on master ([recent examples](${examplesURL})).`);
}

function DisableIssue({ job }: { job: JobData }) {
  const hasFailureClassification = job.failureLine !== null;
  const swrKey = hasFailureClassification ? "/api/issue?label=skipped" : null;
  const { data } = useSWR(swrKey, fetcher, {
    // Set a 60s cache for the request, so that lots of tooltip hovers don't
    // spam the backend. Since actually mutating the state (through filing a
    // disable issue) is a pretty heavy operation, 60s of staleness is fine.
    dedupingInterval: 60000,
  });

  // Null states. Don't show an issue disable link if:
  // - We don't have a failure classification
  if (!hasFailureClassification) {
    return null;
  }
  // - The failure classification is not a python unittest failure.
  const match = job.failureLine!.match(testFailureRe);
  if (match === null) {
    return null;
  }
  // - If we don't yet have any data, show a loading state.
  if (data === undefined) {
    return <span>{" | "} checking for disable issues.</span>;
  }

  // At this point, we should show something. Search the existing disable issues
  // for a matching one.
  const issueTitle = `DISABLED ${match[1]}`;
  const issues: IssueData[] = data.issues;
  let issueLink;
  let linkText;
  const matchingIssues = issues.filter((issue) => issue.title === issueTitle);

  if (matchingIssues.length !== 0) {
    // There is a matching issue, show that in the tooltip box.
    linkText = "Test is disabled";
    issueLink = matchingIssues[0].html_url;
  } else {
    // No matching issue, show a link to create one.
    const issueBody = formatIssueBody(job.failureCaptures!);
    linkText = "Disable test";
    issueLink = `https://github.com/pytorch/pytorch/issues/new?title=${issueTitle}&body=${issueBody}`;
  }

  return (
    <span>
      {" | "}
      <a target="_blank" rel="noreferrer" href={issueLink}>
        {linkText}
      </a>
    </span>
  );
}

export function OriginalPRInfo({ job }: { job: JobData }) {
  const originalPrJob = job.originalPrData;
  if (originalPrJob === undefined) {
    return null;
  }

  const sameFailureConclusion =
    isFailedJob(job) && originalPrJob.conclusion === job.conclusion;
  const sameClassification =
    originalPrJob.failureCaptures !== null &&
    originalPrJob.failureCaptures === job.failureCaptures;

  let sameFailureWarning = null;
  if (sameFailureConclusion) {
    sameFailureWarning = (
      <span className={styles.originalPRJobFailure}>
        {" "}
        also failed
        <span style={{ backgroundColor: "darkred" }}>
          {sameClassification && " WITH SAME ERROR!"}
        </span>
      </span>
    );
  }

  return (
    <span>
      {" | "}
      <a target="_blank" rel="noreferrer" href={originalPrJob.htmlUrl}>
        original PR job
      </a>
      {sameFailureWarning}
    </span>
  );
}
