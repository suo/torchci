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

function populateJobInfo(tooltip) {
  if (tooltip.job_id in window.jobInfo) {
    job = window.jobInfo[tooltip.job_id]
    tooltip.innerHTML +=
      `\
    <div>
      <div><em>click to pin this tooltip</em></div>
      <a target="_blank" href=${job.html_url}>Job page</a>
      | <a target="_blank" href=commit/${job.sha}>PR HUD</a>

      ${job.conclusion !== null
        ? `| <a target="_blank" href=${job.log_url}>raw logs</a>`
        : ""}


      ${job.failure_line !== null ?
        `
        | <a target="_blank" href="failure?capture=${encodeURIComponent(job.failure_captures)}">more like this</a>
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
