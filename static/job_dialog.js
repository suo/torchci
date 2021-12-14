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
  dialog.innerHTML += "<div class='loading'>Loading…</div>";

  const id = elem.getAttribute("job-id");
  let response = fetch("job_dialog/" + id)
    .then((response) => response.json())
    .then(
      (data) => {
        dialog.querySelector(".loading").remove();
        dialog.innerHTML = data.html;
      },
      (error) => {
        dialog.innerHTML = "Error loading job data";
      }
    )
    .then(() => {
      // Add an event listener to close the dialog when the user clicks outside
      document.addEventListener("click", function cb(event) {
        if (!dialog.contains(event.target)) {
          dialog.remove();
          // Remove this listener when the dialog is removed.
          event.currentTarget.removeEventListener(event.type, cb);
        }
      });
    });
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
    console.log(existingDialog);
    if (existingDialog === null) {
      return;
    }
    existingDialog.remove();
  }
});
