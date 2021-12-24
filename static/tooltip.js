"use strict";

const useState = React.useState;
const useEffect = React.useEffect;
const useRef = React.useRef;
const useContext = React.useContext;
const TooltipVisibleContext = React.createContext(true);

function JobGlyph({
  conclusion
}) {
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

  return /*#__PURE__*/React.createElement("div", {
    className: "conclusion"
  }, /*#__PURE__*/React.createElement("span", {
    className: `conclusion-${conclusion}`
  }, conclusionChar));
}

function JobTooltip({
  jobData,
  tooltipInfo
}) {
  const name = `${jobData.workflow_name} / ${jobData.job_name}`; // If tooltip info hasn't loaded yet, just show the basic info.

  if (typeof tooltipInfo === "undefined") {
    return /*#__PURE__*/React.createElement("div", {
      className: "tooltip-content"
    }, `[${jobData.conclusion}] ${name}`, /*#__PURE__*/React.createElement("div", {
      id: "loading-job-info"
    }, /*#__PURE__*/React.createElement("em", null, "Loading job info...")));
  }

  const rawLogs = tooltipInfo.conclusion !== "pending" ? /*#__PURE__*/React.createElement("span", null, " | ", /*#__PURE__*/React.createElement("a", {
    target: "_blank",
    href: tooltipInfo.log_url
  }, "Raw logs")) : null;
  const failureCaptures = tooltipInfo.failure_captures !== null ? /*#__PURE__*/React.createElement("span", null, " | ", /*#__PURE__*/React.createElement("a", {
    target: "_blank",
    href: `failure?capture=${tooltipInfo.failure_captures}`
  }, "more like this")) : null;
  let disableIssue;

  if (tooltipInfo.existing_disable_issue !== null) {
    disableIssue = /*#__PURE__*/React.createElement("span", null, " | ", /*#__PURE__*/React.createElement("a", {
      target: "_blank",
      href: tooltipInfo.existing_disable_issue
    }, "test curently disabled"));
  } else if (tooltipInfo.disable_issue_title !== null) {
    const examplesURL = `http://hud2.pytorch.org/failure?capture=${tooltipInfo.failure_captures}`;
    const issueBody = encodeURIComponent(`Platforms: <fill this in or delete. Valid labels are: asan, linux, mac, macos, rocm, win, windows.>

This job was disabled because it is failing on master ([recent examples](${examplesURL})).`);
    const issueCreateURL = `https://github.com/pytorch/pytorch/issues/new?title=${tooltipInfo.disable_issue_title}&body=${issueBody}`;
    disableIssue = /*#__PURE__*/React.createElement("span", null, " | ", /*#__PURE__*/React.createElement("a", {
      target: "_blank",
      href: issueCreateURL
    }, "disable this test"));
  } else {
    disableIssue = null;
  }

  const failureContext = tooltipInfo.failure_line !== null ? /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", null, /*#__PURE__*/React.createElement("strong", null, "Click for context "), /*#__PURE__*/React.createElement("code", null, tooltipInfo.failure_line)), /*#__PURE__*/React.createElement("pre", null, tooltipInfo.failure_context)) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "tooltip-content"
  }, `[${jobData.conclusion}] ${name}`, /*#__PURE__*/React.createElement("div", {
    id: "options-row"
  }, /*#__PURE__*/React.createElement("a", {
    target: "_blank",
    href: tooltipInfo.html_url
  }, "Job page"), /*#__PURE__*/React.createElement("span", null, " | ", /*#__PURE__*/React.createElement("a", {
    target: "_blank",
    href: `commit/${tooltipInfo.sha}`
  }, "Commit HUD")), rawLogs, failureCaptures, disableIssue, failureContext));
}

function Job({
  jobData,
  tooltipInfo
}) {
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
      setToolTipContent( /*#__PURE__*/React.createElement(JobTooltip, {
        jobData: jobData,
        tooltipInfo: tooltipInfo
      }));
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
    } // Bind the event listener


    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, pinned]);

  if (typeof jobData.id === "undefined") {
    return /*#__PURE__*/React.createElement("td", {
      className: "tooltip-target-no-click",
      onMouseOver: handleMouseOver,
      onMouseLeave: handleMouseLeave
    }, /*#__PURE__*/React.createElement("div", {
      className: "tooltip-container"
    }, toolTipContent), /*#__PURE__*/React.createElement("div", {
      className: "conclusion"
    }, /*#__PURE__*/React.createElement("span", {
      className: "conclusion-none"
    }, "O")));
  }

  return /*#__PURE__*/React.createElement("td", {
    onMouseOver: handleMouseOver,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick,
    className: "tooltip-target"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tooltip-container",
    ref: ref
  }, toolTipContent), /*#__PURE__*/React.createElement(JobGlyph, {
    conclusion: jobData.conclusion
  }));
}

function HudRow({
  rowData,
  jobInfo
}) {
  const sha = rowData.sha;
  return /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "job-metadata"
  }, /*#__PURE__*/React.createElement("time-formatted", {
    timestamp: rowData.time
  })), /*#__PURE__*/React.createElement("td", {
    className: "job-metadata"
  }, /*#__PURE__*/React.createElement("a", {
    href: rowData.commit_url
  }, sha.substring(0, 7))), /*#__PURE__*/React.createElement("td", {
    className: "job-metadata"
  }, /*#__PURE__*/React.createElement("a", {
    href: `/commit/${sha}`
  }, rowData.commit_message)), /*#__PURE__*/React.createElement("td", {
    className: "job-metadata"
  }, rowData.pr_num !== null && /*#__PURE__*/React.createElement("a", {
    href: `https://github.com/pytorch/pytorch/pull/${rowData.pr_num}`
  }, "#", rowData.pr_num)), rowData.jobs.map(job => /*#__PURE__*/React.createElement(Job, {
    key: job.workflow_name + job.job_name,
    jobData: job,
    tooltipInfo: jobInfo[job.id]
  })));
}

function HudGrid({
  gridData,
  jobInfo
}) {
  const rows = gridData.map(row => /*#__PURE__*/React.createElement(HudRow, {
    key: row.sha,
    rowData: row,
    jobInfo: jobInfo
  }));
  return /*#__PURE__*/React.createElement("tbody", null, rows);
}

function HudHeaderRow({
  names
}) {
  return /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "regular-header"
  }, "Time"), /*#__PURE__*/React.createElement("th", {
    className: "regular-header"
  }, "SHA"), /*#__PURE__*/React.createElement("th", {
    className: "regular-header"
  }, "Commit"), /*#__PURE__*/React.createElement("th", {
    className: "regular-header"
  }, "PR"), names.map(name => /*#__PURE__*/React.createElement("th", {
    className: "job-header",
    key: name
  }, /*#__PURE__*/React.createElement("div", {
    className: "job-header__name"
  }, name)))));
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

  return /*#__PURE__*/React.createElement("table", {
    onClick: handleClick
  }, /*#__PURE__*/React.createElement(TooltipVisibleContext.Provider, {
    value: shouldShowTooltip
  }, /*#__PURE__*/React.createElement(HudHeaderRow, {
    names: jobNames
  }), /*#__PURE__*/React.createElement(HudGrid, {
    gridData: gridData,
    jobInfo: jobInfo
  })));
}

ReactDOM.render( /*#__PURE__*/React.createElement(HudTable, null), document.getElementById("hud"));