import { JobData } from "lib/types";
import JobConclusion from "./job-conclusion";

export default function JobSummary({ job }: { job: JobData }) {
  return (
    <div>
      <JobConclusion conclusion={job.conclusion} />
      <a href={job.htmlUrl}> {job.name} </a>
    </div>
  );
}
