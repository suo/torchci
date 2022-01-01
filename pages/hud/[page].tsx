import { LocalTimeHuman } from "../../components/time-utils";
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
import { JobData, RowData } from "../../lib/types";
import fetchHud from "../../lib/fetch-hud";
import Link from "next/link";
import { TooltipTarget } from "../../components/tooltip-target";
import JobConclusion from "../../components/job-conclusion";
import JobTooltip from "../../components/job-tooltip";
import { JobFilterInput } from "../../components/job-filter-input";

function includesCaseInsensitive(value: string, pattern: string): boolean {
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function JobCell({ sha, job }: { sha: string; job: JobData }) {
  const [pinnedId, setPinnedId] = useContext(PinnedTooltipContext);
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
  const handleSubmit = useCallback(() => {
    if (jobFilter === "") {
      router.push(`/hud/${page}`, undefined, { shallow: true });
    } else {
      router.push(`/hud/${page}?name_filter=${jobFilter}`, undefined, {
        shallow: true,
      });
    }
  }, [page, router, jobFilter]);

  // We have to use an effect hook here because query params are undefined at
  // static generation time; they only become available after hydration.
  useEffect(() => {
    const filterValue = (router.query.name_filter as string) || "";
    setJobFilter(filterValue);
    handleInput(filterValue);
  }, [router.query.name_filter, handleInput]);

  return (
    <div>
      <JobFilterInput
        currentFilter={jobFilter}
        handleSubmit={handleSubmit}
        handleInput={handleInput}
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

const PinnedTooltipContext = createContext<[null | string, any]>([null, null]);

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
      <PinnedTooltipContext.Provider value={[pinnedTooltip, setPinnedTooltip]}>
        <div id="hud-container" onClick={handleClick}>
          <h1 id="hud-header">
            PyTorch HUD: <code>master</code>
          </h1>
          <div>This page automatically updates.</div>

          <PageSelector curPage={page} />

          {router.isFallback ? <div>Loading...</div> : <HudTable page={page} />}
        </div>
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
