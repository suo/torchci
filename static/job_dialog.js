function newDialog(jobTarget) {
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
  const newDialog = document.createElement("div");
  newDialog.className = "job-dialog";
  newDialog.innerHTML = `[${conclusion}] ${jobName}`;

  const box = jobTarget.getBoundingClientRect();
  newDialog.style.left = box.x + 20 + window.scrollX + "px";
  newDialog.style.top = box.y + 20 + window.scrollY + "px";
  document.body.append(newDialog);
  return newDialog;
}

function jobMouseOver(event) {
  const elem = event.currentTarget;
  const existingDialog = document.querySelector(".job-dialog");
  if (existingDialog !== null) {
    return;
  }
  // Find the corresponding header name (cellIndex+1 because nth-child is 1-indexed);
  newDialog(elem);
}

function jobMouseLeave(event) {
  const elem = event.currentTarget;
  const existingDialog = document.querySelector(".job-dialog");
  if (
    existingDialog === null ||
    existingDialog.getAttribute("pinned") === "true"
  ) {
    return;
  }
  existingDialog.remove();
}

function jobClick(event) {
  const elem = event.currentTarget;
  if (elem.querySelector(".conclusion-none") !== null) {
    // Don't fetch for non-existent jobs.
    return;
  }
  let dialog = document.querySelector(".job-dialog");

  if (dialog === null) {
    dialog = newDialog(elem);
  }
  dialog.setAttribute("pinned", "true");

  // Retrieve job info from our prefetched global state.
  const id = elem.getAttribute("job-id");
  if (id in window.jobFailuresById) {
    job = window.jobFailuresById[id]
    dialog.innerHTML +=
      `\
    <div>
      <a target="_blank" href=${job.html_url}>Job page</a>
      | <a target="_blank" href=commit/${job.sha}>PR HUD</a>

      ${job.conclusion !== null
        ? `| <a target="_blank" href=${job.log_url}>raw logs</a>`
        : ""}

      ${job.failure_line !== null ?
        `<details>
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

  setTimeout(() => {
    document.addEventListener("click", function cb(event) {
      if (!dialog.contains(event.target)) {
        dialog.remove();
        // Remove this listener when the dialog is removed.
        event.currentTarget.removeEventListener(event.type, cb);
      }
    });
  }, 100);
}
document.querySelectorAll(".dialog-target").forEach(function (element) {
  element.addEventListener("click", jobClick);
  element.addEventListener("mouseover", jobMouseOver);
  element.addEventListener("mouseleave", jobMouseLeave);
});
document
  .querySelectorAll(".dialog-target-no-click")
  .forEach(function (element) {
    element.addEventListener("mouseover", jobMouseOver);
    element.addEventListener("mouseleave", jobMouseLeave);
  });

document.addEventListener("keydown", (e) => {
  // Esc removes existing dialog.
  if (e.code === "Escape") {
    const existingDialog = document.querySelector(".job-dialog");
    if (existingDialog === null) {
      return;
    }
    existingDialog.remove();
  }
});

// Prefetch failure info for this page so that clicking the X is fast. We do it
// here instead of loading it from the main request because the payload is large
// and we don't want to block the main view rendering on it.
const urlParams = new URLSearchParams(window.location.search);
const pageParam = urlParams.get("page");
const page = pageParam === null ? 0 : pageParam;
fetch("failure_infos/" + page)
  .then((response) => response.json())
  .then((data) => {
    window.jobFailuresById = data
  });
