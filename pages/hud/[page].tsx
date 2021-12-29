import { LocalTimeHuman, durationHuman } from "../../components/time-utils";
import { useRouter } from "next/router";
import _ from "lodash";
import useSWR, { SWRConfig } from "swr";

import React, {
  useState,
  useContext,
  createContext,
  useEffect,
  FormEventHandler,
} from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { JobData, RowData } from "../../lib/types";
import fetchHud from "../../lib/fetch-hud";
import Link from "next/link";
import { TooltipTarget } from "../../components/tooltip-target";
import JobConclusion from "../../components/job-conclusion";

function includesCaseInsensitive(value: string, pattern: string): boolean {
  return value.toLowerCase().includes(pattern.toLowerCase());
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
          href={`failure?capture=${job.failureCaptures}`}
        >
          more like this
        </a>
      </span>
    ) : null;

  let disableIssue = null;
  //   if (tooltipInfo.existing_disable_issue !== null) {
  //     disableIssue = (
  //       <span>
  //         {" | "}
  //         <a target="_blank" href={tooltipInfo.existing_disable_issue}>
  //           test curently disabled
  //         </a>
  //       </span>
  //     );
  //   } else if (tooltipInfo.disable_issue_title !== null) {
  //     const examplesURL = `http://hud2.pytorch.org/failure?capture=${tooltipInfo.failure_captures}`;
  //     const issueBody =
  //       encodeURIComponent(`Platforms: <fill this in or delete. Valid labels are: asan, linux, mac, macos, rocm, win, windows.>

  // This job was disabled because it is failing on master ([recent examples](${examplesURL})).`);
  //     const issueCreateURL = `https://github.com/pytorch/pytorch/issues/new?title=${tooltipInfo.disable_issue_title}&body=${issueBody}`;
  //     disableIssue = (
  //       <span>
  //         {" | "}
  //         <a target="_blank" href={issueCreateURL}>
  //           disable this test
  //         </a>
  //       </span>
  //     );
  //   } else {
  //     disableIssue = null;
  //   }

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

function JobCell({ job }: { job: JobData }) {
  const pinnedId = useContext(PinnedTooltipContext);
  const setPinnedId = useContext(SetPinnedTooltipContext);
  return (
    <td onDoubleClick={() => window.open(job.htmlUrl)}>
      <TooltipTarget
        id={`${job.name}-${job.id}`}
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
        <JobCell key={job.name} job={job} />
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

  return (
    <div>
      <JobFilterInput
        handleSubmit={(f) => {
          if (f === "") {
            router.push(`/hud/${page}`, undefined, { shallow: true });
          } else {
            router.push(`/hud/${page}?name_filter=${f}`, undefined, {
              shallow: true,
            });
          }
        }}
        handleInput={(f) => setJobFilter(f)}
      />

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

            <div>disableissues</div>
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
