import { GetStaticProps } from "next";
import useSWR, { SWRConfig } from "swr";
import {
  createContext,
  CSSProperties,
  useCallback,
  useContext,
  useState,
} from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

import fetchHud from "lib/fetch-hud";
import { formatHudURL, HudParams, JobData, RowData } from "lib/types";
import styles from "components/minihud.module.css";
import { JobLinks } from "components/job-tooltip";
import { LocalTimeHuman } from "components/time-utils";
import JobConclusion from "components/job-conclusion";
import { JobFilterInput } from "components/job-filter-input";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function includesCaseInsensitive(value: string, pattern: string): boolean {
  if (pattern === "") {
    return true;
  }
  return value.toLowerCase().includes(pattern.toLowerCase());
}

// react-lazylog doesn't work with SSR, so we have to import it dynamically like this.
const LogViewer = dynamic(() => import("components/log-viewer"), {
  ssr: false,
});

function isFailedJob(job: JobData) {
  return (
    job.conclusion === "failure" ||
    job.conclusion === "cancelled" ||
    job.conclusion === "timed_out"
  );
}

function FailedJob({ job }: { job: JobData }) {
  const [_jobFilter, setJobFilter] = useContext(JobFilterContext);
  const [jobHover, setJobHover] = useContext(JobHoverContext);

  const linkStyle: CSSProperties = { cursor: "pointer" };
  if (job.name === jobHover) {
    linkStyle.backgroundColor = "khaki";
  }
  return (
    <div>
      <div>
        <JobConclusion conclusion={job.conclusion} />
        <a
          style={linkStyle}
          onClick={() => setJobFilter(job.name)}
          onMouseEnter={() => setJobHover(job.name)}
          onMouseLeave={() => setJobHover(null)}
        >
          {" "}
          {job.name}
        </a>
      </div>
      <span>
        <a href={job.htmlUrl}>Job page</a> |{" "}
      </span>
      <JobLinks job={job} />
      <LogViewer job={job} />
    </div>
  );
}

function FailedJobs({ failedJobs }: { failedJobs: JobData[] }) {
  if (failedJobs.length === 0) {
    return null;
  }
  return (
    <ul>
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
      <span className={styles.shaTitleElement}>
        <LocalTimeHuman timestamp={row.time} />
      </span>
      <span className={`${styles.shaTitleElement} ${styles.commitTitle}`}>
        {/* here, we purposefully do not use Link/. The prefetch behavior
          (even with prefetch disabled) spams our backend).*/}
        <a href={`/commit/${row.sha}`}>{row.commitMessage}</a>
      </span>

      <span
        className={`${styles.shaTitleElement} ${styles.sha} ${styles.extraShaInfo}`}
      >
        <a href={row.commitUrl}>{row.sha.substring(0, 7)}</a>
      </span>
      {row.prNum !== null && (
        <span className={`${styles.shaTitleElement} ${styles.extraShaInfo}`}>
          <a href={`https://github.com/pytorch/pytorch/pull/${row.prNum}`}>
            Pull
          </a>
        </span>
      )}
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
  const { data } = useSWR(formatHudURL(params), fetcher, {
    refreshInterval: 60 * 1000, // refresh every minute
    // Refresh even when the user isn't looking, so that switching to the tab
    // will always have fresh info.
    refreshWhenHidden: true,
  });
  const shaGrid: RowData[] = data.shaGrid;

  return (
    <div>
      {shaGrid.map((row: RowData) => (
        <ShaSummary row={row} key={row.sha} />
      ))}
    </div>
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
        width="500px"
        currentFilter={jobFilter}
        handleSubmit={handleSubmit}
        handleInput={setJobFilter}
      />

      <JobFilterContext.Provider value={[jobFilter, setJobFilter]}>
        <JobHoverContext.Provider value={[jobHover, setJobHover]}>
          <div className={styles.minihudGrid}>
            <MiniHud />
          </div>
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
        [formatHudURL(params)]: await fetchHud(params),
      },
    },
    revalidate: 60,
  };
};
