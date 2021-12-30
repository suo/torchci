import { LocalTimeHuman, durationHuman } from "../../components/time-utils";
import { useRouter } from "next/router";
import _ from "lodash";
import useSWR, { SWRConfig } from "swr";

import React, {
  useState,
  useContext,
  createContext,
  useEffect,
  useCallback,
} from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { IssueData, JobData, RowData } from "../../lib/types";
import fetchHud from "../../lib/fetch-hud";
import Link from "next/link";
import { TooltipTarget } from "../../components/tooltip-target";
import JobConclusion from "../../components/job-conclusion";

function includesCaseInsensitive(value: string, pattern: string): boolean {
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function DisableIssue({
  issueTitle,
  failureCaptures,
}: {
  issueTitle: string;
  failureCaptures: string;
}) {
  const { data } = useSWR("/api/issue?label=skipped", fetcher);

  const [disableIssue, setDisableIssue] = useState<string | null>(null);
  if (data === undefined) {
    return <span>checking for disable issues.</span>;
  }

  const issues: IssueData[] = data.issues;
  function handleDisableIssue(e: React.MouseEvent) {
    e.preventDefault();

    const matchingIssues = issues.filter((issue) => issue.title === issueTitle);
    if (matchingIssues.length !== 0) {
      // There is a matching issue, show that in the tooltip box.
      setDisableIssue(matchingIssues[0].html_url);
    } else {
      // No matching issue, open a window to create one.
      const examplesURL = `http://torch-ci.com/failure/${encodeURIComponent(
        failureCaptures
      )}`;
      const issueBody =
        encodeURIComponent(`Platforms: <fill this in or delete. Valid labels are: asan, linux, mac, macos, rocm, win, windows.>

This test was disabled because it is failing on master ([recent examples](${examplesURL})).`);
      const issueCreateURL = `https://github.com/pytorch/pytorch/issues/new?title=${issueTitle}&body=${issueBody}`;
      window.open(issueCreateURL);
    }
  }

  return (
    <span>
      {" | "}
      {disableIssue === null ? (
        <a onClick={handleDisableIssue}>disable test</a>
      ) : (
        <a target="_blank" rel="noreferrer" href={disableIssue}>
          test already disabled
        </a>
      )}
    </span>
  );
}

function JobTooltip({ job }: { job: JobData }) {
  // For nonexistent jobs, just show something basic:
  if (!job.hasOwnProperty("id")) {
    return <div>{`[does not exist] ${job.name}`}</div>;
  }

  const rawLogs =
    job.conclusion !== "pending" ? (
      <span>
        {" | "}
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

  let disableIssue = null;
  if (job.failureLine !== null) {
    const testFailureRe = /^(?:FAIL|ERROR) \[.*\]: (test_.* \(.*Test.*\))/;
    const match = job.failureLine!.match(testFailureRe);
    if (match !== null) {
      const issueTitle = `DISABLED ${match[1]}`;
      disableIssue = (
        <DisableIssue
          issueTitle={issueTitle}
          failureCaptures={job.failureCaptures as string}
        />
      );
    }
  }

  const failureContext =
    job.failureLine !== null ? (
      <details>
        <summary>
          <strong>Click for context </strong>
          <code>{job.failureLine}</code>
        </summary>
        <pre>{job.failureContext}</pre>
      </details>
    ) : null;

  return (
    <div>
      {`[${job.conclusion}] ${job.name}`}
      <div>
        <em>click to pin this tooltip, double-click for job page</em>
      </div>
      <div id="options-row">
        <a target="_blank" rel="noreferrer" href={job.htmlUrl}>
          Job page
        </a>
        <span>
          {" | "}
          <a target="_blank" rel="noreferrer" href={`commit/${job.sha}`}>
            Commit HUD
          </a>
        </span>
        {rawLogs}
        {failureCaptures}
        {durationS}
        {disableIssue}
        {failureContext}
      </div>
    </div>
  );
}

function JobCell({ sha, job }: { sha: string; job: JobData }) {
  const pinnedId = useContext(PinnedTooltipContext);
  const setPinnedId = useContext(SetPinnedTooltipContext);
  return (
    <td onDoubleClick={() => window.open(job.htmlUrl)}>
      <TooltipTarget
        id={`${sha}-${job.name}`}
        pinnedId={pinnedId}
        setPinnedId={setPinnedId}
        tooltipContent={<JobTooltip job={job} />}
      >
        <JobConclusion conclusion={job.conclusion} />
      </TooltipTarget>
    </td>
  );
}

function HudRow({ rowData }: { rowData: RowData }) {
  const sha = rowData.sha;
  return (
    <tr>
      <td className="job-metadata">
        <LocalTimeHuman timestamp={rowData.time} />
      </td>
      <td className="job-metadata">
        <a href={rowData.commitUrl}>{sha.substring(0, 7)}</a>
      </td>
      <td className="job-metadata">
        <div className="job-metadata__truncated">
          {/* here, we purposefully do not use Link/. The prefetch behavior
          (even with prefetch disabled) spams our backend).*/}
          <a href={`/commit/${sha}`}>{rowData.commitMessage}</a>
        </div>
      </td>
      <td className="job-metadata">
        {rowData.prNum !== null && (
          <a href={`https://github.com/pytorch/pytorch/pull/${rowData.prNum}`}>
            #{rowData.prNum}
          </a>
        )}
      </td>
      {rowData.jobs.map((job: JobData) => (
        <JobCell sha={sha} key={job.name} job={job} />
      ))}
    </tr>
  );
}

function HudTableColumns({
  names,
  filter,
}: {
  names: string[];
  filter: string | null;
}) {
  return (
    <colgroup>
      <col className="col-time" />
      <col className="col-sha" />
      <col className="col-commit" />
      <col className="col-pr" />
      {names.map((name: string) => {
        const passesFilter =
          filter === null || includesCaseInsensitive(name, filter);
        const style = passesFilter ? {} : { visibility: "collapse" as any };

        return <col className="col-job" key={name} style={style} />;
      })}
    </colgroup>
  );
}

function HudTableHeader({
  names,
  filter,
}: {
  names: string[];
  filter: string | null;
}) {
  return (
    <thead>
      <tr>
        <th className="regular-header">Time</th>
        <th className="regular-header">SHA</th>
        <th className="regular-header">Commit</th>
        <th className="regular-header">PR</th>
        {names.map((name) => {
          const passesFilter =
            filter === null || includesCaseInsensitive(name, filter);
          const style = passesFilter ? {} : { visibility: "collapse" as any };
          return (
            <th className="job-header" key={name} style={style}>
              <div className="job-header__name">{name}</div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function HudTableBody({ shaGrid }: { shaGrid: RowData[] }) {
  return (
    <tbody>
      {shaGrid.map((row: RowData) => (
        <HudRow key={row.sha} rowData={row} />
      ))}
    </tbody>
  );
}

function FilterableHudTable({
  page,
  jobNames,
  children,
}: {
  page: number;
  jobNames: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [jobFilter, setJobFilter] = useState<string | null>(null);
  // null and empty string both correspond to no filter; otherwise lowercase it
  // to make the filter case-insensitive.
  const normalizedJobFilter =
    jobFilter === null || jobFilter === "" ? null : jobFilter.toLowerCase();

  const handleInput = useCallback((f) => setJobFilter(f), []);
  const handleSubmit = useCallback(
    (f) => {
      if (f === "") {
        router.push(`/hud/${page}`, undefined, { shallow: true });
      } else {
        router.push(`/hud/${page}?name_filter=${f}`, undefined, {
          shallow: true,
        });
      }
    },
    [page, router]
  );

  return (
    <div>
      <JobFilterInput handleSubmit={handleSubmit} handleInput={handleInput} />

      <table className="hud-table">
        <HudTableColumns filter={normalizedJobFilter} names={jobNames} />
        <HudTableHeader filter={normalizedJobFilter} names={jobNames} />
        {children}
      </table>
    </div>
  );
}

function HudTable({ page }: { page: number }) {
  const { data } = useSWR(`/api/hud/${page}`, fetcher, {
    refreshInterval: 60 * 1000, // refresh every minute
    // Refresh even when the user isn't looking, so that switching to the tab
    // will always have fresh info.
    refreshWhenHidden: true,
  });

  // Here, we are intentionally injecting HudTableBody into the
  // FilterableHudTable component. This is for rendering performance; we don't
  // want React to re-render the whole table every time the filter changes.
  return (
    <FilterableHudTable page={page} jobNames={data.jobNames}>
      <HudTableBody shaGrid={data.shaGrid} />
    </FilterableHudTable>
  );
}

function JobFilterInput({
  handleSubmit,
  handleInput,
}: {
  handleSubmit: (value: string) => void;
  handleInput: (value: string) => void;
}) {
  const router = useRouter();
  const [currentFilter, setCurrentFilter] = useState("");
  // We have to use an effect hook here because query params are undefined at
  // static generation time; they only become available after hydration.
  useEffect(() => {
    const filterValue = (router.query.name_filter as string) || "";
    setCurrentFilter(filterValue);
    handleInput(filterValue);
  }, [router.query.name_filter, handleInput]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(currentFilter);
        }}
      >
        <label htmlFor="name_filter">
          Job filter: (press enter to change url, esc to clear):{" "}
        </label>
        <input
          onChange={(e) => {
            setCurrentFilter(e.currentTarget.value);
            handleInput(e.currentTarget.value);
          }}
          type="search"
          name="name_filter"
          value={currentFilter}
        />
        <input type="submit" value="Go" />
      </form>
    </div>
  );
}

function PageSelector({ curPage }: { curPage: number }) {
  return (
    <div>
      Page {curPage}:{" "}
      {curPage !== 0 ? (
        <span>
          <Link href={`/hud/${curPage - 1}`}>Prev</Link> |{" "}
        </span>
      ) : null}
      <Link href={`/hud/${curPage + 1}`}>Next</Link>
    </div>
  );
}

const PinnedTooltipContext = createContext<null | string>(null);
const SetPinnedTooltipContext = createContext<any>(null);

export default function Hud({ fallback }: any) {
  const router = useRouter();

  // Logic to handle tooltip pinning. The behavior we want is:
  // - If the user clicks on a tooltip, it should be pinned.
  // - While a tooltip is pinned, we don't show any other tooltips.
  // - Clicking outside the tooltip or pressing esc should unpin it.
  // This state needs to be set up at this level because we want to capture all
  // clicks.
  const [pinnedTooltip, setPinnedTooltip] = useState<string | null>(null);
  function handleClick() {
    setPinnedTooltip(null);
  }
  useEffect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        setPinnedTooltip(null);
      }
    });
  }, []);

  // Page handling
  const page = router.query.page ? parseInt(router.query.page as string) : 0;

  return (
    <SWRConfig value={{ fallback }}>
      <PinnedTooltipContext.Provider value={pinnedTooltip}>
        <SetPinnedTooltipContext.Provider value={setPinnedTooltip}>
          <div id="hud-container" onClick={handleClick}>
            <h1 id="hud-header">
              PyTorch HUD: <code>master</code>
            </h1>
            <div>This page automatically updates.</div>

            <PageSelector curPage={page} />

            {router.isFallback ? (
              <div>Loading...</div>
            ) : (
              <HudTable page={page} />
            )}
          </div>
        </SetPinnedTooltipContext.Provider>
      </PinnedTooltipContext.Provider>
    </SWRConfig>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return { paths: [{ params: { page: "0" } }], fallback: true };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const pageIndex = params!.page ? parseInt(params!.page as string) : 0;
  const fallback: any = {};
  fallback[`/api/hud/${pageIndex}`] = await fetchHud(pageIndex);
  return {
    props: {
      fallback,
    },
    revalidate: 60,
  };
};
