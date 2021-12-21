class JobToolTip extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    this.setAttribute("class", "job-tooltip")
    const conclusion = this.getAttribute('conclusion');
    const jobName = this.getAttribute('job-name');
    this.innerHTML = `[${conclusion}] ${jobName}` +
      `<div><em>click to pin this tooltip, double-click for job page</em></div>`;
    this.style.left = this.getAttribute("x-coord");
    this.style.top = this.getAttribute("y-coord");

    // Retrieve job info from our prefetched global state.
    if (!window.hasOwnProperty("jobInfo")) {
      this.innerHTML += "<div id='loading-job-info'><em>Loading job info...</em></div>";
      return;
    }
    this.renderJobInfo();
  }

  _generateDisableIssueHTML(job) {
    if (job.existing_disable_issue !== null) {
      return `| <a href=${job.existing_disable_issue}>test currently disabled</a>`
    }

    if (job.disable_issue_title !== null) {
      const issueTitle = encodeURIComponent(job.disable_issue_title);
      const examplesURL = `http://hud2.pytorch.org/failure?capture=${encodeURIComponent(job.failure_captures)}`;
      const issueBody = encodeURIComponent(`Platforms: <fill this in or delete. Valid labels are: asan, linux, mac, macos, rocm, win, windows.>

This job was disabled because it is failing on master ([recent examples](${examplesURL})).`);
      const issueCreateURL = `https://github.com/pytorch/pytorch/issues/new?title=${issueTitle}&body=${issueBody}`;

      return `| <a href=${issueCreateURL}>disable this test</a>`
    }
    return "";
  }

  getJobInfo() {
    const jobId = this.getAttribute('job-id');
    if (window.jobInfo.hasOwnProperty(jobId)) {
      return window.jobInfo[jobId];
    }
    return null;
  }

  renderJobInfo() {
    const job = this.getJobInfo();
    if (job === null) {
      return;
    }

    const disableIssueHTML = this._generateDisableIssueHTML(job);

    this.innerHTML +=
      `\
    <div>
      <a target="_blank" href=${job.html_url}>Job page</a>
      | <a target="_blank" href=commit/${job.sha}>PR HUD</a>

      ${job.conclusion !== null
        ? `\
          | <a target="_blank" href=${job.log_url}>raw logs</a>
          | Duration: ${this.convertTime(job.duration_s)}</a>
        `
        : ""}

      ${job.failure_line !== null ?
        `
        | <a target="_blank" href="failure?capture=${encodeURIComponent(job.failure_captures)}">more like this</a>
        ${disableIssueHTML}
      <details>
        <summary>
          <strong>Click for context </strong>
          <code>${job.failure_line}</code>
        </summary>
        <pre>${job.failure_context}</pre>
      </details>
      `
        : ""}
    </div>
    `
  }

  // from: https://gist.github.com/g1eb/62d9a48164fe7336fdf4845e22ae3d2c
  convertTime(seconds) {
    var hours = Math.floor(seconds / 3600)
    var minutes = Math.floor((seconds - (hours * 3600)) / 60)
    var seconds = seconds - (hours * 3600) - (minutes * 60)
    if (!!hours) {
      if (!!minutes) {
        return `${hours}h ${minutes}m ${seconds}s`
      } else {
        return `${hours}h ${seconds}s`
      }
    }
    if (!!minutes) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  onClick = () => {

  }
}

customElements.define("job-tooltip", JobToolTip);

function newTooltip(jobTarget) {
  let conclusion = jobTarget.getAttribute("conclusion");
  if (conclusion === null) {
    conclusion = "does not exist";
  } else if (conclusion === "None") {
    conclusion = "pending";
  }
  const th = jobTarget
    .closest("table")
    .querySelector(`th:nth-child(${jobTarget.cellIndex + 1})`);
  const jobName = th.querySelector(".job-header__name").innerHTML;

  const newTooltip = document.createElement("job-tooltip");
  newTooltip.setAttribute("conclusion", conclusion);
  newTooltip.setAttribute("job-name", jobName);
  newTooltip.setAttribute("job-id", jobTarget.getAttribute("job-id"));

  const box = jobTarget.getBoundingClientRect();
  newTooltip.setAttribute("x-coord", box.x + 20 + window.scrollX + "px");
  newTooltip.setAttribute("y-coord", box.y + 20 + window.scrollY + "px");

  document.body.append(newTooltip);

  return newTooltip;
}

function jobMouseOver(event) {
  const elem = event.currentTarget;
  const existingTooltip = document.querySelector(".job-tooltip");
  if (existingTooltip !== null) {
    return;
  }
  // Find the corresponding header name (cellIndex+1 because nth-child is 1-indexed);
  newTooltip(elem);
}

function jobMouseLeave(event) {
  const existingTooltip = document.querySelector(".job-tooltip");
  if (
    existingTooltip === null ||
    existingTooltip.getAttribute("pinned") === "true"
  ) {
    return;
  }
  existingTooltip.remove();
}

function jobDoubleClick(event) {
  const elem = event.currentTarget;
  if (elem.querySelector(".conclusion-none") !== null) {
    // Don't do anything for non-existent jobs.
    return;
  }
  let id = elem.getAttribute("job-id");
  job = window.jobInfo[id]
  window.open(job.html_url);
}

function jobClick(event) {
  const elem = event.currentTarget;
  if (elem.querySelector(".conclusion-none") !== null) {
    // Don't fetch for non-existent jobs.
    return;
  }
  let tooltip = document.querySelector(".job-tooltip");

  if (tooltip === null) {
    tooltip = newTooltip(elem);
  }
  tooltip.setAttribute("pinned", "true");

  setTimeout(() => {
    document.addEventListener("click", function cb(event) {
      if (!tooltip.contains(event.target)) {
        tooltip.remove();
        // Remove this listener when the tooltip is removed.
        event.currentTarget.removeEventListener(event.type, cb);
      }
    });
  }, 100);
}
document.querySelectorAll(".tooltip-target").forEach(function (element) {
  element.addEventListener("click", jobClick);
  element.addEventListener("dblclick", jobDoubleClick);
  element.addEventListener("mouseover", jobMouseOver);
  element.addEventListener("mouseleave", jobMouseLeave);
});
document
  .querySelectorAll(".tooltip-target-no-click")
  .forEach(function (element) {
    element.addEventListener("mouseover", jobMouseOver);
    element.addEventListener("mouseleave", jobMouseLeave);
  });

document.addEventListener("keydown", (e) => {
  // Esc removes existing tooltip.
  if (e.code === "Escape") {
    const existingTooltip = document.querySelector(".job-tooltip");
    if (existingTooltip === null) {
      return;
    }
    existingTooltip.remove();
  }
});

// Prefetch failure info for this page so that clicking the X is fast. We do it
// here instead of loading it from the main request because the payload is large
// and we don't want to block the main view rendering on it.
const urlParams = new URLSearchParams(window.location.search);
const pageParam = urlParams.get("page");
const page = pageParam === null ? 0 : pageParam;
window.jobPromise = fetch("job_info/" + page)
  .then((response) => response.json())
  .then((data) => {
    window.jobInfo = data
    const existingTooltip = document.querySelector(".job-tooltip");
    if (existingTooltip !== null) {
      document.getElementById("loading-job-info").remove();
      existingTooltip.renderJobInfo();
    }
  });
