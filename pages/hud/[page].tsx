import { getCharForConclusion } from "../../lib/job-utils";
import { LocalTimeHuman, durationHuman } from "../../components/time-utils";
import { useRouter } from "next/router";
import _ from "lodash";
import useSWR, { SWRConfig } from "swr";

import React, {
  useState,
  useContext,
  createContext,
  KeyboardEventHandler,
  useEffect,
} from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { JobData, RowData } from "../../lib/types";
import fetchHud from "../../lib/fetch-hud";
import Link from "next/link";
import { TooltipTarget } from "../../components/tooltip-target";

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
  const jobExists = job.hasOwnProperty("id");

  let conclusionGlyph = jobExists ? (
    <span className={`conclusion-${job.conclusion}`}>
      {getCharForConclusion(job.conclusion)}
    </span>
  ) : (
    <span className="conclusion-none">O</span>
  );

  return (
    <td onDoubleClick={() => window.open(job.htmlUrl)}>
      <TooltipTarget
        id={`${job.name}-${job.id}`}
        pinnedId={pinnedId}
        setPinnedId={setPinnedId}
        tooltipContent={<JobTooltip job={job} />}
      >
        <div className="conclusion">{conclusionGlyph}</div>
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

function HudColumns({ names }: { names: string[] }) {
  return (
    <colgroup>
      <col className="col-time" />
      <col className="col-sha" />
      <col className="col-commit" />
      <col className="col-pr" />
      {names.map((name: string) => (
        <col className="col-job" key={name} />
      ))}
    </colgroup>
  );
}
function HudHeaderRow({ names }: { names: string[] }) {
  return (
    <thead>
      <tr>
        <th className="regular-header">Time</th>
        <th className="regular-header">SHA</th>
        <th className="regular-header">Commit</th>
        <th className="regular-header">PR</th>
        {names.map((name) => (
          <th className="job-header" key={name}>
            <div className="job-header__name">{name}</div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function HudTable({ page }: { page: number }) {
  const { data } = useSWR(`/api/hud?page=${page}`, fetcher, {
    refreshInterval: 60 * 1000, // refresh every minute
  });

  return (
    <table className="hud-table">
      <HudColumns names={data.jobNames} />
      <HudHeaderRow names={data.jobNames} />
      <tbody>
        {data.shaGrid.map((row: RowData) => (
          <HudRow key={row.sha} rowData={row} />
        ))}
      </tbody>
    </table>
  );
}

const PinnedTooltipContext = createContext<null | string>(null);
const SetPinnedTooltipContext = createContext<any>(null);

export default function Hud({ fallback }: any) {
  // Logic to handle tooltip pinning. The behavior we want is:
  // - If the user clicks on a tooltip, it should be pinned.
  // - While a tooltip is pinned, we don't show any other tooltips.
  // - Clicking outside the tooltip or pressing esc should unpin it.
  // This state needs to be set up at this level because we want to capture all
  // clicks.
  const [pinnedTooltip, setPinnedTooltip] = useState<null | string>(null);
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

  const router = useRouter();
  const pageIndex = router.query.page
    ? parseInt(router.query.page as string)
    : 0;

  return (
    <SWRConfig value={{ fallback }}>
      <PinnedTooltipContext.Provider value={pinnedTooltip}>
        <SetPinnedTooltipContext.Provider value={setPinnedTooltip}>
          <div id="hud-container" onClick={handleClick}>
            <h1 id="hud-header">
              PyTorch HUD: <code>master</code>
            </h1>
            <div>This page reloads every minute.</div>
            <div>
              Page {pageIndex}:{" "}
              {pageIndex !== 0 ? (
                <span>
                  <Link href={`/hud/${pageIndex - 1}`}>Prev</Link> |{" "}
                </span>
              ) : null}
              <Link href={`/hud/${pageIndex + 1}`}>Next</Link>
            </div>
            <div>job fiter TODO</div>
            <div>disableissues</div>
            {router.isFallback ? (
              <div>Loading...</div>
            ) : (
              <HudTable page={pageIndex} />
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
  fallback[`/api/hud?page=${pageIndex}`] = await fetchHud(pageIndex);
  return {
    props: {
      fallback,
    },
    revalidate: 600, // Every 10 minutes.
  };
};
