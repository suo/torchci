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
  const newTooltip = document.createElement("div");
  newTooltip.className = "job-tooltip";
  newTooltip.innerHTML = `[${conclusion}] ${jobName}`;

  const box = jobTarget.getBoundingClientRect();
  newTooltip.style.left = box.x + 20 + window.scrollX + "px";
  newTooltip.style.top = box.y + 20 + window.scrollY + "px";
  document.body.append(newTooltip);

  const id = jobTarget.getAttribute("job-id");
  newTooltip.job_id = id;
  // Retrieve job info from our prefetched global state.
  if (!("jobInfo" in window)) {
    newTooltip.innerHTML += "<div id='loading-job-info'><em>Loading job info...</em></div>";
    return;
  }
  populateJobInfo(newTooltip);
  return newTooltip;
}

// from: https://gist.github.com/g1eb/62d9a48164fe7336fdf4845e22ae3d2c
function convertTime(seconds) {
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


function populateJobInfo(tooltip) {
  if (tooltip.job_id in window.jobInfo) {
    job = window.jobInfo[tooltip.job_id]
    let issueCreateURL = null;
    if (job.failure_line !== null) {
      const match = job.failure_line.match(/^(?:FAIL|ERROR) \[.*\]: (test_.* \(.*Test.*\))/);
      if (match !== null) {
        const issueTitle = encodeURIComponent("DISABLED " + match[1]);
        const examplesURL = `http://hud2.pytorch.org/failure?capture=${encodeURIComponent(job.failure_captures)}`;
        const issueBody = encodeURIComponent(`Platforms: <fill this in or delete. Valid labels are: asan, linux, mac, macos, rocm, win, windows.>

This job was disabled because it is failing on master ([recent examples](${examplesURL})).`);
        issueCreateURL = `https://github.com/pytorch/pytorch/issues/new?title=${issueTitle}&body=${issueBody}`;
      }
    }
    tooltip.innerHTML +=
      `\
    <div>
      <div><em>click to pin this tooltip</em></div>
      <a target="_blank" href=${job.html_url}>Job page</a>
      | <a target="_blank" href=commit/${job.sha}>PR HUD</a>

      ${job.conclusion !== null
        ? `\
          | <a target="_blank" href=${job.log_url}>raw logs</a>
          | Duration: ${convertTime(job.duration_s)}</a>
        `
        : ""}

      ${job.failure_line !== null ?
        `
        | <a target="_blank" href="failure?capture=${encodeURIComponent(job.failure_captures)}">more like this</a>
        ${issueCreateURL !== null ? `| <a target="_blank" href="${issueCreateURL}">disable this test</a>` : ""}
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
      populateJobInfo(existingTooltip);
    }
  });
