import { JobData } from "lib/types";
import JobConclusion from "./JobConclusion";

export default function JobSummary({ job }: { job: JobData }) {
  return (
    <div>
      <JobConclusion conclusion={job.conclusion} />
      <a href={job.htmlUrl}> {job.name} </a>
    </div>
  );
}
