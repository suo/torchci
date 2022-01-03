import { GetStaticProps } from "next";
import { SWRConfig } from "swr";
import {
  createContext,
  CSSProperties,
  useCallback,
  useContext,
  useState,
} from "react";
import { useRouter } from "next/router";

import fetchHud from "lib/fetchHud";
import { formatHudURL, HudParams, JobData, RowData } from "lib/types";
import styles from "components/minihud.module.css";
import JobLinks from "components/JobLinks";
import { LocalTimeHuman } from "components/TimeUtils";
import JobConclusion from "components/JobConclusion";
import JobFilterInput from "components/JobFilterInput";
import useHudData from "lib/useHudData";
import { isFailedJob } from "lib/jobUtils";
import LogViewer from "components/LogViewer";

function includesCaseInsensitive(value: string, pattern: string): boolean {
  if (pattern === "") {
    return true;
  }
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function FailedJob({ job }: { job: JobData }) {
  const [jobFilter, setJobFilter] = useContext(JobFilterContext);
  const [jobHover, setJobHover] = useContext(JobHoverContext);

  function toggleJobFilter() {
    if (jobFilter === job.name) {
      setJobFilter(null);
    } else {
      setJobFilter(job.name);
    }
  }

  const linkStyle: CSSProperties = { cursor: "pointer" };
  if (job.name === jobHover) {
    linkStyle.backgroundColor = "khaki";
  }
  return (
    <div className={styles.failedJob}>
      <div>
        <JobConclusion conclusion={job.conclusion} />
        <a
          target="_blank"
          rel="noreferrer"
          style={linkStyle}
          onMouseEnter={() => setJobHover(job.name)}
          onMouseLeave={() => setJobHover(null)}
          href={job.htmlUrl}
        >
          {" "}
          {job.name}
        </a>
      </div>
      <div className={styles.failedJobLinks}>
        <input
          type="checkbox"
          id="scales"
          checked={jobFilter === job.name}
          onChange={() => toggleJobFilter()}
        />
        <label htmlFor="scales">Set filter | </label>
        <JobLinks job={job} />
      </div>
      <LogViewer job={job} />
    </div>
  );
}

function FailedJobs({ failedJobs }: { failedJobs: JobData[] }) {
  if (failedJobs.length === 0) {
    return null;
  }
  return (
    <ul className={styles.failedJobList}>
      {failedJobs.map((job) => (
        <li key={job.id}>
          <FailedJob job={job} />
        </li>
      ))}
    </ul>
  );
}

function ShaSummary({ row }: { row: RowData }) {
  const [jobFilter, _setJobFilter] = useContext(JobFilterContext);

  const jobs =
    jobFilter === null
      ? row.jobs
      : row.jobs.filter((job) => includesCaseInsensitive(job.name, jobFilter));

  const failedJobs = jobs.filter(isFailedJob);
  const pendingJobs = jobs.filter((job) => job.conclusion === "pending");

  let style;
  if (failedJobs.length !== 0) {
    style = styles.workflowBoxFail;
  } else if (pendingJobs.length === 0) {
    style = styles.workflowBoxSuccess;
  } else {
    style = styles.workflowBoxPending;
  }

  return (
    <div className={style}>
      <span className={`${styles.shaTitleElement} ${styles.timestamp}`}>
        <LocalTimeHuman timestamp={row.time} />
      </span>
      <span className={`${styles.shaTitleElement} ${styles.commitTitle}`}>
        {/* here, we purposefully do not use Link/. The prefetch behavior
          (even with prefetch disabled) spams our backend).*/}
        <a target="_blank" rel="noreferrer" href={`/commit/${row.sha}`}>
          {row.commitMessage}
        </a>
      </span>

      <span
        className={`${styles.shaTitleElement} ${styles.sha} ${styles.extraShaInfo}`}
      >
        <a target="_blank" rel="noreferrer" href={row.commitUrl}>
          {row.sha.substring(0, 7)}
        </a>
      </span>
      {row.prNum !== null && (
        <span className={`${styles.shaTitleElement} ${styles.extraShaInfo}`}>
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://github.com/pytorch/pytorch/pull/${row.prNum}`}
          >
            Pull
          </a>
        </span>
      )}
      <span className={`${styles.shaTitleElement} ${styles.extraShaInfo}`}>
        <a
          target="_blank"
          rel="noreferrer"
          href={`https://www.internalfb.com/diff/${row.diffNum}`}
        >
          Diff
        </a>
      </span>
      {failedJobs.length !== 0 ? (
        <span className={styles.shaTitleElement}>
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://www.internalfb.com/intern/test/bouncycastle/?arcanist_name=fbsource&revision_or_diff_id=${row.diffNum}`}
          >
            <button className={styles.revertButton}>Revert</button>
          </a>
        </span>
      ) : null}
      <div>{pendingJobs.length ? `${pendingJobs.length} pending` : null}</div>
      <FailedJobs failedJobs={failedJobs} />
    </div>
  );
}

function MiniHud() {
  const params: HudParams = {
    branch: "master",
    repoOwner: "pytorch",
    repoName: "pytorch",
    page: 0,
  };
  const { shaGrid } = useHudData(params);

  return (
    <>
      {shaGrid.map((row: RowData) => (
        <ShaSummary row={row} key={row.sha} />
      ))}
    </>
  );
}

const JobFilterContext = createContext<
  [null | string, (name: null | string) => void]
>([null, (_n) => {}]);

const JobHoverContext = createContext<
  [null | string, (name: null | string) => void]
>([null, (_n) => {}]);

export default function Page({ fallback }: any) {
  const router = useRouter();
  const [jobFilter, setJobFilter] = useState<string | null>(null);
  const [jobHover, setJobHover] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    if (jobFilter === "") {
      router.push(`/minihud`, undefined, { shallow: true });
    } else {
      router.push(`/minihud?name_filter=${jobFilter}`, undefined, {
        shallow: true,
      });
    }
  }, [router, jobFilter]);

  return (
    <SWRConfig value={{ fallback }}>
      <JobFilterInput
        width="50%"
        currentFilter={jobFilter}
        handleSubmit={handleSubmit}
        handleInput={setJobFilter}
      />

      <JobFilterContext.Provider value={[jobFilter, setJobFilter]}>
        <JobHoverContext.Provider value={[jobHover, setJobHover]}>
          <MiniHud />
        </JobHoverContext.Provider>
      </JobFilterContext.Provider>
    </SWRConfig>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const params: HudParams = {
    branch: "master",
    repoOwner: "pytorch",
    repoName: "pytorch",
    page: 0,
  };
  return {
    props: {
      fallback: {
        [formatHudURL("api/hud", params)]: await fetchHud(params),
      },
    },
    revalidate: 60,
  };
};
