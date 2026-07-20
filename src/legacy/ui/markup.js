export function buildEmptyStateMarkup(message, escapeHtml) {
  return `<p class="muted">${escapeHtml(message || "No data available.")}</p>`;
}

export function buildMetricCardMarkup(card, escapeHtml, className = "admin-metric-card") {
  return `
    <article class="${escapeHtml(
      `${className}${card?.tone ? ` admin-metric-card--${card.tone}` : ""}`
    )}">
      <span class="admin-metric-label">${escapeHtml(card.label || "")}</span>
      <span class="admin-metric-value">${escapeHtml(card.value || "")}</span>
      <span class="admin-metric-note">${escapeHtml(card.note || "")}</span>
    </article>
  `;
}

export function buildProgressRowsMarkup(items, escapeHtml, { emptyMessage = "No data available." } = {}) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!rows.length) {
    return buildEmptyStateMarkup(emptyMessage, escapeHtml);
  }

  const maxValue = Math.max(...rows.map((item) => Number(item.value || 0)), 1);

  return `
    <div class="admin-bar-list">
      ${rows.map((item) => {
        const value = Number(item.value || 0);
        const width = Math.max(8, Math.round((value / maxValue) * 100));
        return `
          <div class="admin-bar-row">
            <div class="admin-bar-head">
              <span class="admin-bar-label">${escapeHtml(item.label || "")}</span>
              <span class="admin-bar-value">${escapeHtml(item.displayValue ?? String(value))}</span>
            </div>
            <div class="admin-bar-track">
              <div class="admin-bar-fill" style="width:${width}%"></div>
            </div>
            ${item.note ? `<div class="admin-bar-note">${escapeHtml(item.note)}</div>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function buildChipListMarkup(items, escapeHtml, className = "admin-surface-chip") {
  return (items || [])
    .filter(Boolean)
    .map((item) => `<span class="${escapeHtml(className)}">${escapeHtml(item)}</span>`)
    .join("");
}
