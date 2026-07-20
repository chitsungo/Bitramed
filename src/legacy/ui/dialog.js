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
  panel.append(heading, copy, form);
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

export function durationPickerDialog({
  title = "Set duration",
  message = "",
  submitLabel = "Continue",
  cancelLabel = "Cancel",
  min = 5,
  max = 20,
  initial = 10,
} = {}) {
  return new Promise((resolve) => {
    const root = ensureDialogRoot();
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    let selected = Math.min(
      safeMax,
      Math.max(safeMin, Number.parseInt(initial, 10) || safeMin)
    );

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
    wheelLabel.textContent = "Minutes";

    const wheelList = document.createElement("div");
    wheelList.className = "dialog-wheel-list";

    const options = [];
    for (let minutes = safeMin; minutes <= safeMax; minutes += 1) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "dialog-wheel-option";
      option.dataset.value = String(minutes);
      option.innerHTML = `<span class="dialog-wheel-value">${minutes}</span><span class="dialog-wheel-unit">min</span>`;
      option.addEventListener("click", () => {
        selected = minutes;
        syncSelection();
        option.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      wheelList.appendChild(option);
      options.push(option);
    }

    const syncSelection = () => {
      options.forEach((option) => {
        const isActive = Number(option.dataset.value) === selected;
        option.classList.toggle("is-selected", isActive);
        option.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    const findNearestSelection = () => {
      const listRect = wheelList.getBoundingClientRect();
      const midpoint = listRect.top + listRect.height / 2;
      let nearestOption = options[0];
      let nearestDistance = Number.POSITIVE_INFINITY;

      options.forEach((option) => {
        const rect = option.getBoundingClientRect();
        const optionMid = rect.top + rect.height / 2;
        const distance = Math.abs(optionMid - midpoint);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestOption = option;
        }
      });

      selected = Number(nearestOption?.dataset.value || selected);
      syncSelection();
    };

    let scrollTimer = null;
    wheelList.addEventListener("scroll", () => {
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        findNearestSelection();
      }, 60);
    });

    wheel.append(wheelLabel, wheelList);
    fields.appendChild(wheel);

    const close = (result) => {
      if (scrollTimer) {
        window.clearTimeout(scrollTimer);
        scrollTimer = null;
      }
      document.removeEventListener("keydown", onKeyDown);
      teardownDialog(root, overlay);
      resolve(result);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close(null);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selected = Math.max(safeMin, selected - 1);
        syncSelection();
        options[selected - safeMin]?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selected = Math.min(safeMax, selected + 1);
        syncSelection();
        options[selected - safeMin]?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }
    };

    cancelButton.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(null);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      close(selected);
    });

    root.appendChild(overlay);
    document.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(() => {
      syncSelection();
      options[selected - safeMin]?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
      panel.focus();
      submitButton.focus();
    });
  });
}

export function formDialog({
  title = "Update",
  message = "",
  submitLabel = "Save",
  cancelLabel = "Cancel",
  danger = false,
  fields = []
} = {}) {
  return new Promise((resolve) => {
    const root = ensureDialogRoot();
    const { overlay, panel, form, fields: fieldsRoot, cancelButton } = buildDialogShell({
      title,
      message,
      submitLabel,
      cancelLabel,
      danger
    });

    const fieldRefs = [];
    const errorNode = document.createElement("div");
    errorNode.className = "dialog-error";
    errorNode.hidden = true;

    fields.forEach((field) => {
      const wrap = document.createElement("label");
      wrap.className = "dialog-field";

      const label = document.createElement("span");
      label.className = "dialog-label";
      label.textContent = field.label;

      const input = field.multiline ? document.createElement("textarea") : document.createElement("input");
      input.className = "dialog-input";
      input.name = field.id;
      input.placeholder = field.placeholder || "";
      input.value = field.value ?? "";
      input.required = !!field.required;
      input.autocomplete = "off";
      if (!field.multiline) {
        input.type = field.type || "text";
      } else {
        input.rows = field.rows || 4;
      }
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);

      wrap.append(label, input);
      fieldsRoot.appendChild(wrap);
      fieldRefs.push({ field, input });
    });

    form.insertBefore(errorNode, form.lastElementChild);

    const close = (result) => {
      document.removeEventListener("keydown", onKeyDown);
      teardownDialog(root, overlay);
      resolve(result);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close(null);
      }
    };

    cancelButton.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(null);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const result = {};
      for (const { field, input } of fieldRefs) {
        const value = String(input.value || "").trim();
        if (field.required && !value) {
          errorNode.hidden = false;
          errorNode.textContent = `${field.label} is required.`;
          input.focus();
          return;
        }

        if (field.type === "number" && value) {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            errorNode.hidden = false;
            errorNode.textContent = `${field.label} must be a positive number.`;
            input.focus();
            return;
          }
          result[field.id] = parsed;
        } else {
          result[field.id] = value || null;
        }
      }

      close(result);
    });

    root.appendChild(overlay);
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => {
      const firstInput = form.querySelector(".dialog-input");
      if (firstInput) {
        firstInput.focus();
      } else {
        panel.focus();
      }
    });
  });
}
