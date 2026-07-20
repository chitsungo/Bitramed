import { buildEmptyStateMarkup } from "../ui/markup.js";

function getInitials(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "U";
  return safeValue
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getTimeCellMeta(row, { expiresAt, blockedAt, timeLeftLabel }) {
  const status = String(row?.status || "no_access");

  if (status === "blocked") {
    return {
      secondaryLabel: blockedAt ? "Blocked" : "State",
      secondaryValue: blockedAt || "Restricted",
      secondaryTone: "is-urgent"
    };
  }

  if (status === "expired") {
    return {
      secondaryLabel: "Ended",
      secondaryValue: timeLeftLabel || "Expired",
      secondaryTone: "is-urgent"
    };
  }

  if (status === "active") {
    return {
      secondaryLabel: "Remaining",
      secondaryValue: timeLeftLabel || "Active",
      secondaryTone: "is-safe"
    };
  }

  return {
    secondaryLabel: "State",
    secondaryValue: "Not yet active",
    secondaryTone: ""
  };
}

export function renderAdminAccessMenu({ container, buckets, escapeHtml }) {
  if (!container) return;

  container.innerHTML = (buckets || []).map((bucket) => `
    <button class="admin-choice-card ${escapeHtml(bucket.tone)}" type="button" data-access-category="${escapeHtml(bucket.key)}">
      <div class="admin-choice-inner">
        <div class="admin-choice-badge">${escapeHtml(bucket.orb)}</div>
        <div class="admin-choice-copy">
          <h3 class="admin-choice-title">${escapeHtml(bucket.title)}</h3>
          <p class="admin-choice-subtitle">${escapeHtml(bucket.subtitle)}</p>
        </div>
        <div class="admin-choice-right">
          <span class="admin-choice-count">${escapeHtml(bucket.countLabel || "")}</span>
          <div class="admin-choice-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"></path>
            </svg>
          </div>
        </div>
      </div>
    </button>
  `).join("");
}

export function renderAdminAccessCategoryList({
  container,
  rows,
  escapeHtml,
  formatDateTime,
  getAccessTimeLeftLabel,
  renderAccessActions,
  getAccessStatusMeta
}) {
  if (!container) return;

  if (!(rows || []).length) {
    container.innerHTML = buildEmptyStateMarkup("No users are in this category right now.", escapeHtml);
    return;
  }

  container.innerHTML = rows.map((row) => {
    const status = getAccessStatusMeta(row.status);
    const expiresAt = row.access_expires_at ? formatDateTime(row.access_expires_at) : "Not set";
    const blockedAt = row.blocked_at ? formatDateTime(row.blocked_at) : "";
    const timeLeftLabel = getAccessTimeLeftLabel(row);
    const notes = String(row.notes || "").trim();
    const reason = String(row.block_reason || "").trim();
    const initials = getInitials(row.display_name || row.email || "User");
    const timeCellMeta = getTimeCellMeta(row, { expiresAt, blockedAt, timeLeftLabel });
    const detailNotes = [
      reason ? `Reason: ${reason}` : "",
      notes ? `Notes: ${notes}` : ""
    ].filter(Boolean);

    return `
      <article class="admin-access-row is-${escapeHtml(row.status || "no_access")}">
        <div class="admin-access-card-inner">
          <div class="admin-access-identity">
            <div class="admin-access-initials">${escapeHtml(initials)}</div>
            <div class="admin-access-identity-body">
              <h3 class="admin-access-title">${escapeHtml(row.display_name || row.email || "User")}</h3>
              <p class="admin-access-email">${escapeHtml(row.email || "No email")}</p>
            </div>
            <span class="admin-access-status ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
          </div>

          <div class="admin-access-time-row">
            <div class="admin-access-time-cell">
              <span class="admin-access-time-label">Expires</span>
              <span class="admin-access-time-value">${escapeHtml(expiresAt)}</span>
            </div>
            <div class="admin-access-time-cell">
              <span class="admin-access-time-label">${escapeHtml(timeCellMeta.secondaryLabel)}</span>
              <span class="admin-access-time-value ${escapeHtml(timeCellMeta.secondaryTone)}">${escapeHtml(timeCellMeta.secondaryValue)}</span>
            </div>
          </div>

          ${detailNotes.length ? `
            <div class="admin-access-notes">
              ${detailNotes.map((detail) => `<p class="admin-access-note">${escapeHtml(detail)}</p>`).join("")}
            </div>
          ` : ""}

          <div class="admin-access-actions">
            ${renderAccessActions(row)}
          </div>
        </div>
      </article>
    `;
  }).join("");
}
