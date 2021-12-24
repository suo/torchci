"use strict";

const useState = React.useState;
const useEffect = React.useEffect;
const useRef = React.useRef;
const useContext = React.useContext;

const TooltipVisibleContext = React.createContext(true);

function JobGlyph({ conclusion }) {
  let conclusionChar;
  switch (conclusion) {
    case "success":
      conclusionChar = "O";
      break;
    case "failure":
      conclusionChar = "X";
      break;
    case "neutral":
      conclusionChar = "N";
      break;
    case "cancelled":
      conclusionChar = "C";
      break;
    case "timed_out":
      conclusionChar = "T";
      break;
    case "skipped":
      conclusionChar = "S";
      break;
    case "pending":
      conclusionChar = "?";
      break;
    default:
      // Shouldn't happen
      conclusionChar = "U";
  }

  return (
    <div className="conclusion">
      <span className={`conclusion-${conclusion}`}>{conclusionChar}</span>
    </div>
  );
}

function JobTooltip({ jobData, tooltipInfo }) {
  const name = `${jobData.workflow_name} / ${jobData.job_name}`;
  // If tooltip info hasn't loaded yet, just show the basic info.
  if (typeof tooltipInfo === "undefined") {
    return (
      <div className="tooltip-content">
        {`[${jobData.conclusion}] ${name}`}
        <div id="loading-job-info">
          <em>Loading job info...</em>
        </div>
      </div>
    );
  }

  const rawLogs =
    tooltipInfo.conclusion !== "pending" ? (
      <span>
        {" | "}
        <a target="_blank" href={tooltipInfo.log_url}>
          Raw logs
        </a>
      </span>
    ) : null;

  const failureCaptures =
    tooltipInfo.failure_captures !== null ? (
      <span>
        {" | "}
        <a
          target="_blank"
          href={`failure?capture=${tooltipInfo.failure_captures}`}
        >
          more like this
        </a>
      </span>
    ) : null;

  let disableIssue;
  if (tooltipInfo.existing_disable_issue !== null) {
    disableIssue = (
      <span>
        {" | "}
        <a target="_blank" href={tooltipInfo.existing_disable_issue}>
          test curently disabled
        </a>
      </span>
    );
  } else if (tooltipInfo.disable_issue_title !== null) {
    const examplesURL = `http://hud2.pytorch.org/failure?capture=${tooltipInfo.failure_captures}`;
    const issueBody =
      encodeURIComponent(`Platforms: <fill this in or delete. Valid labels are: asan, linux, mac, macos, rocm, win, windows.>

This job was disabled because it is failing on master ([recent examples](${examplesURL})).`);
    const issueCreateURL = `https://github.com/pytorch/pytorch/issues/new?title=${tooltipInfo.disable_issue_title}&body=${issueBody}`;
    disableIssue = (
      <span>
        {" | "}
        <a target="_blank" href={issueCreateURL}>
          disable this test
        </a>
      </span>
    );
  } else {
    disableIssue = null;
  }

  const failureContext =
    tooltipInfo.failure_line !== null ? (
      <details>
        <summary>
          <strong>Click for context </strong>
          <code>{tooltipInfo.failure_line}</code>
        </summary>
        <pre>{tooltipInfo.failure_context}</pre>
      </details>
    ) : null;

  return (
    <div className="tooltip-content">
      {`[${jobData.conclusion}] ${name}`}
      <div id="options-row">
        <a target="_blank" href={tooltipInfo.html_url}>
          Job page
        </a>
        <span>
          {" | "}
          <a target="_blank" href={`commit/${tooltipInfo.sha}`}>
            Commit HUD
          </a>
        </span>
        {rawLogs}
        {failureCaptures}
        {disableIssue}
        {failureContext}
      </div>
    </div>
  );
}

function Job({ jobData, tooltipInfo }) {
  const tooltipVisible = useContext(TooltipVisibleContext);
  const [toolTipContent, setToolTipContent] = useState(null);
  const [pinned, setPinned] = useState(false);
  const timeoutId = useRef(null);

  function handleMouseOver() {
    if (!tooltipVisible) {
      return;
    }
    clearTimeout(timeoutId.current);
    timeoutId.current = setTimeout(() => {
      setToolTipContent(
        <JobTooltip jobData={jobData} tooltipInfo={tooltipInfo} />
      );
    }, 10);
  }
  function handleMouseLeave() {
    clearTimeout(timeoutId.current);
    if (!pinned) {
      setToolTipContent(null);
    }
  }
  function handleClick() {
    setPinned(true);
  }
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (pinned && ref.current && !ref.current.contains(event.target)) {
        setToolTipContent(null);
        setPinned(false);
        document.removeEventListener("mousedown", this);
      }
    }
    if (!pinned) {
      return;
    }

    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, pinned]);

  if (typeof jobData.id === "undefined") {
    return (
      <td
        className="tooltip-target-no-click"
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
      >
        <div className="tooltip-container">{toolTipContent}</div>
        <div className="conclusion">
          <span className="conclusion-none">O</span>
        </div>
      </td>
    );
  }
  return (
    <td
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="tooltip-target"
    >
      <div className="tooltip-container" ref={ref}>
        {toolTipContent}
      </div>
      <JobGlyph conclusion={jobData.conclusion} />
    </td>
  );
}

function HudRow({ rowData, jobInfo }) {
  const sha = rowData.sha;
  return (
    <tr>
      <td className="job-metadata">
        <time-formatted timestamp={rowData.time}></time-formatted>
      </td>
      <td className="job-metadata">
        <a href={rowData.commit_url}>{sha.substring(0, 7)}</a>
      </td>
      <td className="job-metadata">
        <a href={`/commit/${sha}`}>{rowData.commit_message}</a>
      </td>
      <td className="job-metadata">
        {rowData.pr_num !== null && (
          <a href={`https://github.com/pytorch/pytorch/pull/${rowData.pr_num}`}>
            #{rowData.pr_num}
          </a>
        )}
      </td>
      {rowData.jobs.map((job) => (
        <Job
          key={job.workflow_name + job.job_name}
          jobData={job}
          tooltipInfo={jobInfo[job.id]}
        />
      ))}
    </tr>
  );
}

function HudGrid({ gridData, jobInfo }) {
  const rows = gridData.map((row) => (
    <HudRow key={row.sha} rowData={row} jobInfo={jobInfo} />
  ));
  return <tbody>{rows}</tbody>;
}

function HudHeaderRow({ names }) {
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

function HudTable() {
  const [jobNames, setJobNames] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [jobInfo, setJobInfo] = useState({});
  const [shouldShowTooltip, setShouldShowTooltip] = useState(true);

  function handleClick(e) {
    if (e.target.className !== "tooltip-content") {
      setShouldShowTooltip(!shouldShowTooltip);
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch("/api/hud");
      const json = await response.json();
      setJobNames(json.names);
      setGridData(json.grid);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch("/job_info/0");
      const json = await response.json();
      setJobInfo(json);
    };
    fetchData();
  }, []);

  if (jobNames.length === 0) {
    return "loading...";
  }

  return (
    <table onClick={handleClick}>
      <TooltipVisibleContext.Provider value={shouldShowTooltip}>
        <HudHeaderRow names={jobNames} />
        <HudGrid gridData={gridData} jobInfo={jobInfo} />
      </TooltipVisibleContext.Provider>
    </table>
  );
}
ReactDOM.render(<HudTable />, document.getElementById("hud"));
