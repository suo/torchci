import { GetStaticPaths, GetStaticProps } from "next";
import fetchCommit from "../../lib/fetch-commit";
import { JobData } from "../../lib/types";
import styles from "../../components/commit.module.css";
import _ from "lodash";
import { useRouter } from "next/router";
import useSWR from "swr";
import JobSummary from "../../components/job-summary";

function isFailedJob(job: JobData) {
  return (
    job.conclusion === "failure" ||
    job.conclusion === "cancelled" ||
    job.conclusion === "timed_out"
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CommitInfo({ sha, fallback }: { sha: string; fallback: any }) {
  const { data } = useSWR(`/api/commit/${sha}`, fetcher, {
    fallback,
    refreshInterval: 60 * 1000, // refresh every minute
    // Refresh even when the user isn't looking, so that switching to the tab
    // will always have fresh info.
    refreshWhenHidden: true,
  });
  const commit = data;

  return (
    <div>
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

export default function Page({ fallback }: any) {
  const router = useRouter();
  const sha = router.query.sha as string;

  return (
    <div>
      <h1 id="hud-header">
        PyTorch Commit: <code>{sha}</code>
      </h1>
      {router.isFallback ? (
        <div>Loading...</div>
      ) : (
        <CommitInfo sha={sha} fallback={fallback} />
      )}
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return { paths: [], fallback: true };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const sha = params!.sha as string;
  const fallback: any = {};
  fallback[`/api/commit/${sha}`] = await fetchCommit(sha as string);
  return {
    props: {
      fallback,
    },
    revalidate: 60, // Every minute.
  };
};
