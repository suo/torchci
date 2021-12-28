import { GetStaticPaths, GetStaticProps } from "next";
import fetchCommit from "../../lib/fetch-commit";
import { CommitData, JobData } from "../../lib/types";
import styles from "../../components/commit.module.css";
import JobConclusion from "../../components/job-conclusion";
import _ from "lodash";

function isFailedJob(job: JobData) {
  return (
    job.conclusion === "failure" ||
    job.conclusion === "cancelled" ||
    job.conclusion === "timed_out"
  );
}

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

function JobSummary({ job }: { job: JobData }) {
  return (
    <div>
      <JobConclusion conclusion={job.conclusion} />
      <a href={job.htmlUrl}> {job.name} </a>
      <JobFailureContext job={job} />
    </div>
  );
}

function FilteredJobList({
  filterName,
  jobs,
  pred,
}: {
  filterName: string;
  jobs: JobData[];
  pred: (job: JobData) => boolean;
}) {
  const filteredJobs = jobs.filter(pred);
  return (
    <div>
      <h2>{filterName}</h2>
      <ul>
        {filteredJobs.map((job) => (
          <li key={job.id}>
            <JobSummary job={job} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkflowBox({
  workflowName,
  jobs,
}: {
  workflowName: string;
  jobs: JobData[];
}) {
  const isFailed = jobs.some(isFailedJob) !== false;
  const workflowClass = isFailed
    ? styles.workflowBoxFail
    : styles.workflowBoxSuccess;
  return (
    <div className={workflowClass}>
      <h3>{workflowName}</h3>
      {jobs.map((job) => (
        <JobSummary key={job.id} job={job} />
      ))}
    </div>
  );
}

function WorkflowsContainer({ jobs }: { jobs: JobData[] }) {
  const byWorkflow = _.groupBy(jobs, (job) => job.workflowName);
  return (
    <div className={styles.workflowContainer}>
      {_.map(byWorkflow, (jobs, workflowName) => {
        return (
          <WorkflowBox
            key={workflowName}
            workflowName={workflowName}
            jobs={jobs}
          />
        );
      })}
    </div>
  );
}

function VersionControlLinks({
  sha,
  diffNum,
}: {
  sha: string;
  diffNum: string | null;
}) {
  return (
    <div>
      <a href={`https://github.com/pytorch/pytorch/commit/${sha}`}>GitHub</a>
      {diffNum !== undefined ? (
        <span>
          {" "}
          |{" "}
          <a href={`https://www.internalfb.com/diff/${diffNum}`}>Phabricator</a>
        </span>
      ) : null}
    </div>
  );
}

export default function Page({ commit }: { commit: CommitData }) {
  return (
    <div>
      <h1 id="hud-header">
        PyTorch Commit: <code>{commit.sha}</code>
      </h1>

      <h2>{commit.commitTitle}</h2>

      <VersionControlLinks sha={commit.sha} diffNum={commit.diffNum} />

      <article className={styles.commitMessage}>
        {commit.commitMessageBody}
      </article>

      <FilteredJobList
        filterName="Failed jobs"
        jobs={commit.jobs}
        pred={isFailedJob}
      />

      <FilteredJobList
        filterName="Pending jobs"
        jobs={commit.jobs}
        pred={(job) => job.conclusion === "pending"}
      />

      <WorkflowsContainer jobs={commit.jobs} />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return { paths: [], fallback: "blocking" };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const sha = params!.sha;
  return {
    props: {
      commit: await fetchCommit(sha as string),
    },
    revalidate: 60, // Every 10 minutes.
  };
};
