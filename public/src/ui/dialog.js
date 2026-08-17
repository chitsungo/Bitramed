function ensureDialogRoot() {
  let root = document.getElementById("app-dialog-root");
  if (root) return root;

  root = document.createElement("div");
  root.id = "app-dialog-root";
  document.body.appendChild(root);
  return root;
}

function buildDialogShell({
  title = "Confirm",
  message = "",
  submitLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false
}) {
  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";

  const panel = document.createElement("div");
  panel.className = "dialog-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.tabIndex = -1;

  const heading = document.createElement("h2");
  heading.className = "dialog-title";
  heading.textContent = title;

  const copy = document.createElement("p");
  copy.className = "dialog-copy";
  copy.textContent = message;

  const form = document.createElement("form");
  form.className = "dialog-form";

  const fields = document.createElement("div");
  fields.className = "dialog-fields";

  const actions = document.createElement("div");
  actions.className = "dialog-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "dialog-btn secondary";
  cancelButton.textContent = cancelLabel;

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = `dialog-btn primary${danger ? " danger" : ""}`;
  submitButton.textContent = submitLabel;

  actions.append(cancelButton, submitButton);
  form.append(fields, actions);
  panel.appendChild(heading);
  if (message) panel.appendChild(copy);
  panel.appendChild(form);
  overlay.appendChild(panel);

  return {
    overlay,
    panel,
    form,
    fields,
    cancelButton,
    submitButton
  };
}

function teardownDialog(root, overlay) {
  overlay.remove();
  if (!root.childElementCount) {
    root.remove();
  }
}

export function confirmDialog({
  title = "Confirm",
  message = "",
  submitLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false
} = {}) {
  return new Promise((resolve) => {
    const root = ensureDialogRoot();
    const { overlay, panel, form, cancelButton } = buildDialogShell({
      title,
      message,
      submitLabel,
      cancelLabel,
      danger
    });

    const close = (result) => {
      document.removeEventListener("keydown", onKeyDown);
      teardownDialog(root, overlay);
      resolve(result);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close(false);
      }
    };

    cancelButton.addEventListener("click", () => close(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      close(true);
    });

    root.appendChild(overlay);
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => {
      panel.focus();
    });
  });
}
export function quizSettingsDialog({
  title = "Start quiz",
  message = "",
  submitLabel = "Start quiz",
  cancelLabel = "Cancel",
  min = 5,
  max = 30,
  initial = null,
  negativeMarking = false,
} = {}) {
  return new Promise((resolve) => {
    const root = ensureDialogRoot();
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    const parsedInitial = Number.parseInt(initial, 10);
    const optionValues = [
      0,
      ...Array.from(
        { length: safeMax - safeMin + 1 },
        (_, index) => safeMin + index
      ),
    ];
    let selected = Number.isFinite(parsedInitial)
      ? Math.min(safeMax, Math.max(safeMin, parsedInitial))
      : 0;

    const { overlay, panel, form, fields, cancelButton, submitButton } =
      buildDialogShell({
        title,
        message,
        submitLabel,
        cancelLabel,
      });

    const wheel = document.createElement("div");
    wheel.className = "dialog-wheel";

    const wheelLabel = document.createElement("div");
    wheelLabel.className = "dialog-wheel-label";
    wheelLabel.textContent = "Timer";

    const wheelList = document.createElement("div");
    wheelList.className = "dialog-wheel-list";

    const options = [];
    optionValues.forEach((minutes) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "dialog-wheel-option";
      option.dataset.value = String(minutes);
      option.innerHTML = minutes
        ? `<span class="dialog-wheel-value">${minutes}</span><span class="dialog-wheel-unit">min</span>`
        : `<span class="dialog-wheel-value dialog-wheel-value-text">No time</span>`;
      option.addEventListener("click", () => {
        selected = minutes;
        syncSelection();
        option.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      wheelList.appendChild(option);
      options.push(option);
    });

    const syncSelection = () => {
      options.forEach((option) => {
        const isActive = Number(option.dataset.value) === selected;
        option.classList.toggle("is-selected", isActive);
        option.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    const findNearestSelection = () => {
      const listRect = wheelList.getBoundingClientRect();
      const midpoint = listRect.top + wheelList.offsetHeight / 2;
      let nearestOption = options[0];
      let nearestDistance = Number.POSITIVE_INFINITY;

      options.forEach((option) => {
        const rect = option.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - midpoint);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestOption = option;
        }
      });

      selected = Number(nearestOption?.dataset.value || 0);
      syncSelection();
    };

    let scrollTimer = null;
    wheelList.addEventListener("scroll", () => {
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(findNearestSelection, 60);
    });

    const markingRow = document.createElement("div");
    markingRow.className = "dialog-setting-row";
    markingRow.innerHTML = `
      <div class="dialog-setting-copy">
        <div class="dialog-setting-title-row">
          <span class="dialog-setting-title">Negative marking</span>
          <span class="dialog-info-wrap">
            <button class="dialog-info-btn" type="button" aria-label="Negative marking rules" aria-describedby="negative-marking-tooltip">i</button>
            <span id="negative-marking-tooltip" class="dialog-info-tooltip" role="tooltip">Correct answers earn 1 point. Wrong answers lose 1 point. Unanswered questions score 0.</span>
          </span>
        </div>
      </div>
      <label class="dialog-switch">
        <input class="dialog-switch-input" type="checkbox" aria-label="Toggle negative marking">
        <span class="dialog-switch-track" aria-hidden="true"></span>
      </label>
    `;
    const toggleInput = markingRow.querySelector(".dialog-switch-input");
    toggleInput.checked = !!negativeMarking;

    wheel.append(wheelLabel, wheelList);
    fields.append(wheel, markingRow);

    const close = (result) => {
      if (scrollTimer) window.clearTimeout(scrollTimer);
      document.removeEventListener("keydown", onKeyDown);
      teardownDialog(root, overlay);
      resolve(result);
    };

    const moveSelection = (direction) => {
      const currentIndex = Math.max(0, optionValues.indexOf(selected));
      const nextIndex = Math.min(
        optionValues.length - 1,
        Math.max(0, currentIndex + direction)
      );
      selected = optionValues[nextIndex];
      syncSelection();
      options[nextIndex]?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close(null);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
      }
    };

    cancelButton.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(null);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      close({
        durationMinutes: selected || null,
        negativeMarking: toggleInput.checked,
      });
    });

    root.appendChild(overlay);
    document.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(() => {
      syncSelection();
      options[optionValues.indexOf(selected)]?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
      panel.focus();
      submitButton.focus();
    });
  });
}
