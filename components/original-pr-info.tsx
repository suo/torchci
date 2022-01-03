import { isFailedJob } from "lib/job-utils";
import { JobData } from "lib/types";
import styles from "./original-pr-info.module.css";

export default function OriginalPRInfo({ job }: { job: JobData }) {
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
