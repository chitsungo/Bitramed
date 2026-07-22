import {
  buildChipListMarkup,
  buildEmptyStateMarkup,
  buildMetricCardMarkup,
  buildProgressRowsMarkup,
} from "../ui/markup.js";

function buildStoryMarkup(executiveBrief, escapeHtml) {
  return `
    <span class="admin-story-kicker">Executive Brief</span>
    <h3 class="admin-story-title">${escapeHtml(
      executiveBrief?.title || "No summary available yet."
    )}</h3>
    <p class="admin-story-copy">${escapeHtml(
      executiveBrief?.body || "No platform summary is available yet."
    )}</p>
    <div class="admin-story-chips">
      ${buildChipListMarkup(
        executiveBrief?.chips || [],
        escapeHtml,
        "admin-story-chip"
      )}
    </div>
  `;
}

function buildSignalCardsMarkup(
  signals,
  escapeHtml,
  className = "admin-surface-card admin-highlight-card admin-signal-card"
) {
  const items = Array.isArray(signals) ? signals : [];
  if (!items.length) {
    return buildEmptyStateMarkup(
      "No action signals are available yet.",
      escapeHtml
    );
  }

  return items
    .map(
      (signal) => `
        <article class="${escapeHtml(
          `app-surface-card ${className}${signal?.tone ? ` admin-signal-card--${signal.tone}` : ""}`
        )}">
          <div class="admin-signal-head">
            <span class="admin-signal-label">${escapeHtml(
              signal.label || ""
            )}</span>
            ${
              signal.value
                ? `<span class="admin-signal-value">${escapeHtml(
                    signal.value
                  )}</span>`
                : ""
            }
          </div>
          <strong class="admin-signal-title">${escapeHtml(
            signal.title || ""
          )}</strong>
          <span class="admin-signal-note">${escapeHtml(
            signal.note || ""
          )}</span>
        </article>
      `
    )
    .join("");
}

function buildFactListMarkup(items, escapeHtml) {
  const facts = (items || []).filter(Boolean);
  if (!facts.length) return "";

  return `
    <ul class="admin-row-facts">
      ${facts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function buildRowNotesMarkup(notes, escapeHtml) {
  const entries = (notes || []).filter(Boolean);
  if (!entries.length) return "";

  return `
    <div class="admin-list-row-notes">
      ${entries.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
    </div>
  `;
}

function buildListRowMarkup(
  {
    rowClassName = "",
    badgeMarkup = "",
    kicker = "",
    title = "",
    subtitle = "",
    score = "",
    detailsMarkup = "",
    facts = [],
    notes = [],
  },
  escapeHtml
) {
  const rowClass = String(rowClassName || "").trim();

  return `
    <li class="admin-list-row ${escapeHtml(rowClass)}">
      <div class="admin-list-row-head">
        <div class="admin-list-row-identity">
          ${badgeMarkup}
          <div class="admin-list-row-copy">
            ${
              kicker
                ? `<span class="admin-list-row-kicker">${escapeHtml(
                    kicker
                  )}</span>`
                : ""
            }
            <h3 class="admin-list-row-title">${escapeHtml(title)}</h3>
            ${
              subtitle
                ? `<p class="admin-list-row-subtitle">${escapeHtml(
                    subtitle
                  )}</p>`
                : ""
            }
          </div>
        </div>
        ${
          score
            ? `<span class="admin-list-row-score">${escapeHtml(score)}</span>`
            : ""
        }
      </div>
      ${detailsMarkup}
      ${buildFactListMarkup(facts, escapeHtml)}
      ${buildRowNotesMarkup(notes, escapeHtml)}
    </li>
  `;
}

function buildAssessmentBreakdownMarkup(user, escapeHtml) {
  const sections = [
    {
      key: "normal",
      label: "Normal",
      average: user.normalAveragePercentage,
      attempts: user.normalAttempts,
    },
    {
      key: "exam",
      label: "Exam",
      average: user.examAveragePercentage,
      attempts: user.examAttempts,
    },
    {
      key: "combined",
      label: "Combined",
      average: user.averagePercentage,
      attempts: user.totalAttempts,
    },
  ];

  return `
    <div class="admin-assessment-breakdown" aria-label="Assessment averages">
      ${sections
        .map(
          (section) => `
            <div class="admin-assessment-metric admin-assessment-metric--${escapeHtml(section.key)}" data-assessment-source="${escapeHtml(section.key)}">
              <span class="admin-assessment-metric-label">${escapeHtml(section.label)}</span>
              <strong class="admin-assessment-metric-value">${escapeHtml(String(section.average))}%</strong>
              <span class="admin-assessment-metric-note">${escapeHtml(String(section.attempts))} attempt${section.attempts === 1 ? "" : "s"}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildDataListMarkup(
  items,
  rowBuilder,
  escapeHtml,
  emptyMessage = "No data available."
) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];

  return `
    <ul class="admin-data-list">
      ${
        rows.length
          ? rows.map((item, index) => rowBuilder(item, index)).join("")
          : `<li class="admin-list-empty">${escapeHtml(
              emptyMessage || "No data available."
            )}</li>`
      }
    </ul>
  `;
}

function buildRankedUsersMarkup(rankedUsers, escapeHtml) {
  return buildDataListMarkup(
    rankedUsers,
    (user) =>
      buildListRowMarkup(
        {
          rowClassName: "admin-ranked-card",
          badgeMarkup: `<span class="admin-ranked-position">#${escapeHtml(
            String(user.rank)
          )}</span>`,
          kicker: "Average score",
          title: user.displayName,
          subtitle: user.email,
          score: `${user.averagePercentage}%`,
          facts: [
            `${user.totalAttempts} attempts`,
            `${user.quizzesDone} assessments`,
            `Normal ${user.normalAveragePercentage}%`,
            `Exam ${user.examAveragePercentage}%`,
            `Best ${user.bestPercentage}%`,
            user.strongestArea !== "No data"
              ? `Top area ${user.strongestArea}`
              : "",
          ],
        },
        escapeHtml
      ),
    escapeHtml,
    "No ranked learner data is available yet."
  );
}

function buildCourseDiagnosticsMarkup(courseDiagnostics, escapeHtml) {
  return buildDataListMarkup(
    courseDiagnostics,
    (course) =>
      buildListRowMarkup(
        {
          rowClassName: "admin-course-card",
          badgeMarkup: `<span class="admin-list-badge admin-list-badge-rank">#${escapeHtml(
            String(course.rank)
          )}</span>`,
          kicker: "Course ranking",
          title: course.area,
          subtitle: course.standing,
          score: `${course.averagePercentage}%`,
          facts: [
            `${course.uniqueUsers} learners`,
            `${course.totalAttempts} attempts`,
            `Best learner ${course.bestUserAverage}%`,
          ],
        },
        escapeHtml
      ),
    escapeHtml,
    "No course analytics are available yet."
  );
}

function buildLearnerWatchlistMarkup(
  learnerWatchlist,
  escapeHtml,
  formatDateTime
) {
  return buildDataListMarkup(
    learnerWatchlist,
    (user) =>
      buildListRowMarkup(
        {
          rowClassName: "admin-user-card admin-watch-item",
          badgeMarkup: `<span class="admin-list-badge admin-list-badge-priority">P${escapeHtml(
            String(user.priority)
          )}</span>`,
          kicker: user.attentionLabel,
          title: user.displayName,
          subtitle: user.email,
          score: `${user.averagePercentage}%`,
          detailsMarkup: buildAssessmentBreakdownMarkup(user, escapeHtml),
          facts: [
            `${user.quizzesDone} assessments completed`,
            `Best ${user.bestPercentage}%`,
            `Strongest ${user.strongestArea}`,
          ],
          notes: [
            `Weakest: ${user.weakestArea}`,
            `Last active: ${formatDateTime(user.latestActivity)}`,
          ],
        },
        escapeHtml
      ),
    escapeHtml,
    "No learners with quiz history are available yet."
  );
}

function buildRecentActivityMarkup(
  recentActivity,
  escapeHtml,
  formatDateTime,
  formatModeLabel
) {
  return buildDataListMarkup(
    recentActivity,
    (attempt) =>
      buildListRowMarkup(
        {
          rowClassName: "admin-activity-card",
          badgeMarkup: `<span class="admin-list-badge admin-list-badge-mode">${escapeHtml(
            attempt.assessmentKind === "past_paper"
              ? "Past Paper"
              : formatModeLabel(attempt.mode)
          )}</span>`,
          kicker:
            attempt.assessmentKind === "past_paper"
              ? "Exam attempt"
              : "Normal quiz attempt",
          title: attempt.quizTitle,
          subtitle: `${attempt.displayName} - ${attempt.area}`,
          score: `${attempt.percentage}%`,
          facts: [
            `${attempt.score}/${attempt.totalQuestions}`,
            attempt.assessmentKind === "past_paper"
              ? attempt.durationMinutes
                ? `${attempt.durationMinutes} min`
                : "No time limit"
              : "",
            attempt.assessmentKind === "past_paper"
              ? attempt.negativeMarking
                ? "Negative marking"
                : "Standard marking"
              : "",
            attempt.timedOut ? "Timed out" : "",
            formatDateTime(attempt.completedAt),
          ],
        },
        escapeHtml
      ),
    escapeHtml,
    "No recent platform activity is available yet."
  );
}

export function renderAdminStatsView({
  dom,
  model,
  escapeHtml,
  formatDateTime,
  formatModeLabel,
}) {
  if (!dom || !model) return;

  if (dom.adminStoryCard) {
    dom.adminStoryCard.innerHTML = buildStoryMarkup(
      model.executiveBrief,
      escapeHtml
    );
  }

  if (dom.adminMenuBrief) {
    dom.adminMenuBrief.innerHTML = buildStoryMarkup(
      model.executiveBrief,
      escapeHtml
    );
  }

  if (dom.adminMenuSignals) {
    dom.adminMenuSignals.innerHTML = buildSignalCardsMarkup(
      model.signals.slice(0, 3),
      escapeHtml,
      "admin-surface-card admin-highlight-card admin-signal-card admin-menu-signal-card"
    );
  }

  if (dom.adminOverviewGrid) {
    dom.adminOverviewGrid.innerHTML = model.pulseCards
      .map((card) => buildMetricCardMarkup(card, escapeHtml))
      .join("");
  }

  if (dom.adminHealthChart) {
    dom.adminHealthChart.innerHTML = buildProgressRowsMarkup(
      model.operatingRows,
      escapeHtml,
      {
        emptyMessage: "No operating snapshot is available yet.",
      }
    );
  }

  if (dom.adminCourseChart) {
    dom.adminCourseChart.innerHTML = buildProgressRowsMarkup(
      model.courseComparison,
      escapeHtml,
      {
        emptyMessage: "No course comparison data is available yet.",
      }
    );
  }

  if (dom.adminCourseSectionCount) {
    dom.adminCourseSectionCount.textContent = `${model.courseDiagnostics.length} tracked`;
  }

  if (dom.adminCourseGrid) {
    dom.adminCourseGrid.innerHTML = buildCourseDiagnosticsMarkup(
      model.courseDiagnostics,
      escapeHtml
    );
  }

  if (dom.adminUserHighlights) {
    dom.adminUserHighlights.innerHTML = buildSignalCardsMarkup(
      model.signals,
      escapeHtml
    );
  }

  if (dom.adminRankedSectionCount) {
    dom.adminRankedSectionCount.textContent = `${
      (model.topRankedUsers || []).length
    } learners`;
  }

  if (dom.adminRankedUsers) {
    dom.adminRankedUsers.innerHTML = buildRankedUsersMarkup(
      model.topRankedUsers || [],
      escapeHtml
    );
  }

  if (dom.adminUserSectionCount) {
    dom.adminUserSectionCount.textContent = `${model.learnerWatchlist.length} learners shown`;
  }

  if (dom.adminUserList) {
    dom.adminUserList.innerHTML = buildLearnerWatchlistMarkup(
      model.learnerWatchlist,
      escapeHtml,
      formatDateTime
    );
  }

  if (dom.adminRecentSectionCount) {
    dom.adminRecentSectionCount.textContent = `${model.recentActivity.length} recent attempts`;
  }

  if (dom.adminRecentList) {
    dom.adminRecentList.innerHTML = buildRecentActivityMarkup(
      model.recentActivity,
      escapeHtml,
      formatDateTime,
      formatModeLabel
    );
  }
}
