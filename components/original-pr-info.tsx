import { isFailedJob } from "lib/job-utils";
import { JobData } from "lib/types";
import styles from "./original-pr-info.module.css";

export default function OriginalPRInfo({ job }: { job: JobData }) {
  const originalPrJob = job.originalPrData;
  if (!isFailedJob(job) || originalPrJob === undefined) {
    return null;
  }

  const sameConclusion = originalPrJob.conclusion === job.conclusion;
  const sameClassification =
    originalPrJob.failureCaptures !== null &&
    originalPrJob.failureCaptures === job.failureCaptures;

  if (sameConclusion) {
    return (
      <span>
        {" | "}
        <a
          className={styles.originalPRJobFailure}
          target="_blank"
          rel="noreferrer"
        >
          original PR job failed
          <span style={{ backgroundColor: "darkred" }}>
            {" "}
            {sameClassification && " WITH SAME ERROR!"}
          </span>
        </a>
      </span>
    );
  }

  return null;
}
