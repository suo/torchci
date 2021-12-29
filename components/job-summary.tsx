import { JobData } from "../lib/types";
import JobConclusion from "./job-conclusion";

function JobFailureContext({ job }: { job: JobData }) {
  if (job.failureContext == null) {
    return null;
  }
  return (
    <details>
      <summary>
        <code>{job.failureLine}</code>
      </summary>
      <pre>{job.failureContext}</pre>
    </details>
  );
}

export default function JobSummary({ job }: { job: JobData }) {
  return (
    <div>
      <JobConclusion conclusion={job.conclusion} />
      <a href={job.htmlUrl}> {job.name} </a>
      <JobFailureContext job={job} />
    </div>
  );
}
