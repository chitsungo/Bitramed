export function renderLearnerShell() {
  const root = document.getElementById("app-route-root");
  const page = document.body.dataset.appPage || "home";

  if (!root) return;

  const pageTitles = {
    home: "Bitramed Home",
    modules: "Bitramed Modules",
    subtopics: "Bitramed Subtopics",
    types: "Bitramed Question Types",
    quizzes: "Bitramed Quizzes",
    setup: "Bitramed Quiz Setup",
    quiz: "Bitramed Quiz",
    results: "Bitramed Results",
    account: "Bitramed Account",
    settings: "Bitramed Settings",
    access: "Bitramed Access",
  };

  const viewTemplates = {
    dashboard: `
      <section id="dashboard-view" class="view browse-view" hidden>
        <div class="dashboard-hero-panel">
          <div class="dashboard-hero-copy">
            <div class="browse-eyebrow">
              <span class="browse-eyebrow-line"></span>
              <span class="browse-eyebrow-text">Learning Home</span>
            </div>
            <div id="dashboard-greeting-row" class="dashboard-greeting-row">
              <h2 id="dashboard-greeting" class="dashboard-greeting">Good morning,</h2>
              <p id="dashboard-greeting-name" class="dashboard-greeting-name">Learner.</p>
            </div>
          </div>
        </div>
        <div class="dashboard-summary-strip">
          <div class="dashboard-summary-cell">
            <div id="dashboard-active-years" class="dashboard-summary-value">0</div>
            <div class="dashboard-summary-key">Active Years</div>
          </div>
          <div class="dashboard-summary-cell">
            <div id="dashboard-completed-count" class="dashboard-summary-value">0</div>
            <div class="dashboard-summary-key">Assessments Done</div>
          </div>
          <div class="dashboard-summary-cell">
            <div id="dashboard-average-score" class="dashboard-summary-value good">0%</div>
            <div class="dashboard-summary-key">Avg. Score</div>
          </div>
        </div>
        <div class="browse-section-label">
          <span class="browse-section-title">Years</span>
          <span id="dashboard-section-count" class="browse-section-count">0 years total</span>
        </div>
        <div id="area-grid" class="browse-card-list"></div>
      </section>
    `,
    modules: `
      <section id="modules-view" class="view browse-view" hidden>
        <div class="browse-header">
          <div class="browse-eyebrow">
            <span class="browse-eyebrow-line"></span>
            <span id="modules-page-kicker" class="browse-eyebrow-text">Level</span>
          </div>
          <h2 id="module-page-title" class="browse-page-title">Courses</h2>
          <p id="module-page-subtitle" class="browse-page-subtitle"></p>
        </div>
        <div class="browse-section-label">
          <span class="browse-section-title">Courses</span>
          <span id="modules-section-count" class="browse-section-count">0 total</span>
        </div>
        <div id="module-grid" class="browse-card-list"></div>
      </section>
    `,
    subtopics: `
      <section id="subtopics-view" class="view browse-view" hidden>
        <div class="browse-header">
          <div class="browse-eyebrow">
            <span class="browse-eyebrow-line"></span>
            <span id="subtopics-page-kicker" class="browse-eyebrow-text">Course</span>
          </div>
          <h2 id="subtopics-page-title" class="browse-page-title">Chapters</h2>
          <p id="subtopics-page-subtitle" class="browse-page-subtitle"></p>
        </div>
        <div class="browse-section-label">
          <span class="browse-section-title">Chapters</span>
          <span id="subtopics-section-count" class="browse-section-count">0 total</span>
        </div>
        <div id="subtopics-grid" class="browse-card-list"></div>
      </section>
    `,
    types: `
      <section id="types-view" class="view selection-view" hidden>
        <div class="selection-shell">
          <div class="selection-header">
            <div class="selection-eyebrow selection-page-eyebrow">
              <span class="selection-eyebrow-line"></span>
              <span id="types-page-kicker" class="selection-eyebrow-text">Question formats</span>
              <span class="selection-eyebrow-line"></span>
            </div>
            <h2 id="types-page-title" class="selection-title">Question Type</h2>
            <div class="selection-stats">
              <div class="selection-stat-cell">
                <div id="types-complete-percent" class="selection-stat-value muted">0%</div>
                <div class="selection-stat-key">Mastered</div>
              </div>
              <div class="selection-stat-cell">
                <div id="types-total-questions" class="selection-stat-value">0</div>
                <div class="selection-stat-key">Questions</div>
              </div>
              <div class="selection-stat-cell">
                <div id="types-format-count" class="selection-stat-value">2</div>
                <div class="selection-stat-key">Formats</div>
              </div>
            </div>
          </div>
          <div class="selection-label-row">
            <span class="selection-label-title">Available Formats</span>
            <span class="selection-label-hint">Choose One</span>
          </div>
          <div id="types-grid" class="selection-cards"></div>
        </div>
      </section>
    `,
    quizzes: `
      <section id="quiz-list-view" class="view quizlist-view" hidden>
        <div class="quizlist-shell">
          <div class="quizlist-header">
            <div class="quizlist-header-copy">
              <div class="quizlist-eyebrow">
                <span class="quizlist-eyebrow-line"></span>
                <span id="quiz-list-kicker" class="quizlist-eyebrow-text">Topic</span>
                <span class="quizlist-eyebrow-line"></span>
              </div>
              <h2 id="quiz-list-title" class="quizlist-title">Quizzes</h2>
              <div id="quiz-list-mode-badge" class="quizlist-mode-badge">Format</div>
            </div>
            <div class="quizlist-stat-bar">
              <div class="quizlist-stat-cell">
                <div id="quiz-list-assessment-count" class="quizlist-stat-value">0</div>
                <div class="quizlist-stat-key">Assessments</div>
              </div>
              <div class="quizlist-stat-cell">
                <div id="quiz-list-completed-count" class="quizlist-stat-value">0</div>
                <div class="quizlist-stat-key">Completed</div>
              </div>
              <div class="quizlist-stat-cell">
                <div id="quiz-list-average-score" class="quizlist-stat-value">--</div>
                <div class="quizlist-stat-key">Avg. Score</div>
              </div>
            </div>
          </div>
          <div class="quizlist-section-label">
            <span class="quizlist-section-title">Assessment Ledger</span>
            <span id="quiz-list-section-count" class="quizlist-section-count">0 total</span>
          </div>
          <div id="quiz-list" class="quizlist-cards"></div>
        </div>
      </section>
    `,
    setup: `
      <section id="setup-view" class="view setup-view" hidden>
        <div class="setup-shell">
          <div class="setup-header">
            <div class="setup-header-copy">
              <div id="setup-kicker" class="setup-kicker-badge">Assessment 1</div>
              <h2 id="setup-title" class="setup-title">Quiz Setup</h2>
              <p id="setup-meta" class="setup-meta"></p>
            </div>
            <div class="setup-stat-bar">
              <div class="setup-stat-cell">
                <div id="setup-question-count" class="setup-stat-value">0</div>
                <div class="setup-stat-key">Questions</div>
              </div>
              <div class="setup-stat-cell">
                <div id="setup-attempt-count" class="setup-stat-value">0</div>
                <div class="setup-stat-key">Attempts</div>
              </div>
              <div class="setup-stat-cell">
                <div id="setup-best-score" class="setup-stat-value">--</div>
                <div class="setup-stat-key">Best Score</div>
              </div>
            </div>
          </div>
          <div class="setup-main">
            <div class="setup-mode-panel">
              <div class="setup-section-label">
                <span class="setup-section-title">Choose Your Mode</span>
                <span class="setup-section-hint">Pick one</span>
              </div>
              <div class="setup-mode-actions">
                <button id="btn-start-study" class="setup-mode-card study" type="button">
                  <span class="setup-mode-visual-shell" aria-hidden="true">
                    <svg class="setup-mode-book-icon" viewBox="0 0 24 24">
                      <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2H20v18H8.5A2.5 2.5 0 0 0 6 22z"></path>
                      <path d="M6 22V4.5"></path>
                      <path d="M10 7h6"></path>
                      <path d="M10 11h6"></path>
                      <path d="M10 15h4"></path>
                    </svg>
                  </span>
                  <span class="setup-mode-copy">
                    <span class="setup-mode-name">Study mode</span>
                    <span id="setup-study-note" class="setup-mode-note">Untimed practice with no negative marking. Reset freely and build recall.</span>
                  </span>
                  <span class="setup-mode-trailing">
                    <span id="setup-study-action-label" class="setup-mode-status">Fresh start</span>
                    <span class="setup-mode-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M8 6l10 6-10 6z"/>
                      </svg>
                    </span>
                  </span>
                </button>
                <button id="btn-start-exam" class="setup-mode-card exam" type="button">
                  <span class="setup-mode-visual-shell" aria-hidden="true">
                    <span class="setup-mode-visual setup-mode-visual-exam">
                      <span class="setup-mode-exam-center"></span>
                      <span class="setup-mode-exam-hand"></span>
                    </span>
                  </span>
                  <span class="setup-mode-copy">
                    <span class="setup-mode-name">Exam mode</span>
                    <span id="setup-exam-note" class="setup-mode-note">Strictly timed with negative marking (-1 per wrong answer) for a realistic rehearsal.</span>
                  </span>
                  <span class="setup-mode-trailing">
                    <span id="setup-exam-action-label" class="setup-mode-status">Timed pass</span>
                    <span class="setup-mode-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M8 6l10 6-10 6z"/>
                      </svg>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `,
    quiz: `
      <section id="quiz-view" class="view quiz-session-view" hidden>
        <div class="quiz-session-page">
          <div class="quiz-session-header">
            <div id="quiz-mode-badge" class="quiz-session-mode-badge">Mode</div>
            <div class="quiz-session-assessment-label">
              <span id="quiz-page-kicker" class="quiz-session-assessment-text">Assessment 1</span>
            </div>
            <h2 id="quiz-page-title" class="quiz-session-title">Quiz</h2>
            <p id="quiz-page-meta" class="quiz-session-subtitle"></p>
          </div>

          <div class="quiz-session-stats">
            <div class="quiz-session-stat-cell">
              <div id="quiz-total-count" class="quiz-session-stat-value">0</div>
              <div class="quiz-session-stat-key">Questions</div>
            </div>
            <div class="quiz-session-stat-cell">
              <div id="quiz-answered-count" class="quiz-session-stat-value">0</div>
              <div class="quiz-session-stat-key">Answered</div>
            </div>
            <div class="quiz-session-stat-cell">
              <div id="quiz-mode-stat" class="quiz-session-stat-value">Study</div>
              <div class="quiz-session-stat-key">Mode</div>
            </div>
          </div>

          <div class="quiz-progress-wrap">
            <div class="quiz-progress-meta">
              <span class="quiz-progress-label">Progress</span>
              <span id="quiz-progress-count" class="quiz-progress-count">0 / 0</span>
            </div>
            <div class="quiz-progress-track">
              <div id="quiz-progress-fill" class="quiz-progress-fill" style="width: 0%"></div>
            </div>
          </div>

          <form id="quiz-form" class="quiz-session-form"></form>
        </div>

        <div class="quiz-submit-bar">
          <div class="quiz-submit-inner">
            <button id="btn-submit" class="quiz-submit-btn" type="button" disabled>
              <span id="quiz-progress-copy" class="quiz-submit-progress">0/0 answered</span>
              <span class="quiz-submit-btn-label">Submit Quiz</span>
              <span class="quiz-submit-btn-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h12"></path>
                  <path d="M13 6l6 6-6 6"></path>
                </svg>
              </span>
            </button>
          </div>
        </div>
      </section>
    `,
    results: `
      <section id="results-view" class="view results-page-view" hidden>
        <div class="results-page-shell">
          <div class="results-page-header">
            <div class="results-page-eyebrow">
              <span class="results-page-eyebrow-line"></span>
              <span id="results-page-kicker" class="results-page-eyebrow-text">Assessment result</span>
            </div>
            <h2 id="results-page-title" class="results-page-title">Assessment</h2>
            <p id="results-page-meta" class="results-page-subtitle"></p>
          </div>

          <div class="results-score-hero">
            <div class="results-score-top">
              <div class="results-score-main">
                <div id="final-score" class="results-score-fraction">0/0</div>
                <div class="results-score-label">Score</div>
              </div>
              <div class="results-score-pct-block">
                <div id="progress-text" class="results-score-pct poor">0%</div>
                <div class="results-score-pct-label">Percentage</div>
              </div>
            </div>

            <div class="results-score-bar-wrap">
              <div class="results-score-bar-track" aria-hidden="true">
                <div class="results-score-bar-segments">
                  <div id="results-correct-segment" class="results-score-segment seg-correct"></div>
                  <div id="results-wrong-segment" class="results-score-segment seg-wrong"></div>
                  <div id="results-unanswered-segment" class="results-score-segment seg-unsure"></div>
                </div>
              </div>
            </div>

            <div class="results-score-breakdown">
              <div class="results-breakdown-cell">
                <div id="count-correct" class="results-breakdown-value correct">0</div>
                <div class="results-breakdown-label">Correct</div>
              </div>
              <div class="results-breakdown-cell">
                <div id="count-wrong" class="results-breakdown-value wrong">0</div>
                <div class="results-breakdown-label">Wrong</div>
              </div>
              <div class="results-breakdown-cell">
                <div id="count-unanswered" class="results-breakdown-value unsure">0</div>
                <div class="results-breakdown-label">Unanswered</div>
              </div>
            </div>
          </div>

          <div class="results-meta-row">
            <div class="results-meta-card">
              <div id="results-attempt-count" class="results-meta-value">0</div>
              <div class="results-meta-label">Your Attempts</div>
            </div>
            <div class="results-meta-card">
              <div id="results-mode-label" class="results-meta-value">Study</div>
              <div class="results-meta-label">Mode</div>
            </div>
          </div>

          <div class="results-callout">
            <div class="results-callout-label">Saved to account history</div>
            <div id="results-summary-headline" class="results-callout-headline">Results ready.</div>
            <div id="results-summary-copy" class="results-callout-body">Review the explanations below, then go again when you are ready.</div>
          </div>

          <div class="results-section-header">
            <span class="results-section-title">Question Review</span>
            <span id="results-review-count" class="results-section-count">0 questions</span>
          </div>

          <div id="results-container" class="results-review-list"></div>

          <div id="results-bottom-actions" class="results-bottom-actions">
            <button id="btn-retry-results" class="results-bottom-btn primary" type="button">Retry Quiz</button>
            <button id="btn-results-back-list" class="results-bottom-btn secondary" type="button">Back to Quiz List</button>
          </div>
        </div>
        <div id="results-sticky-bar" class="results-sticky-bar">
          <div class="results-sticky-inner">
            <button id="toggle-review-wrong-btn" class="results-sticky-btn" type="button">
              <span id="results-sticky-label" class="results-sticky-label">0 missed</span>
              <span class="results-sticky-divider" aria-hidden="true">•</span>
              <span id="results-sticky-action" class="results-sticky-action">Review Missed Only</span>
            </button>
          </div>
        </div>
      </section>
    `,
    account: `
      <section id="account-view" class="view account-view" hidden>
        <div class="browse-header account-header">
          <div class="browse-eyebrow">
            <span class="browse-eyebrow-line"></span>
            <span class="browse-eyebrow-text">Account Stats</span>
          </div>
          <h2 id="account-page-title" class="browse-page-title">Account</h2>
          <p id="account-page-subtitle" class="browse-page-subtitle">Your learning progress and quiz history</p>
        </div>
        <div id="account-empty-state" class="account-empty-state" hidden>
          <p class="muted">No quiz history yet. Complete a quiz to see your stats here.</p>
        </div>
        <div id="account-content">
          <div id="account-overview-grid" class="account-overview-grid"></div>
          <div class="account-section">
            <div class="section-head compact">
              <div>
                <h2>Mode Performance</h2>
              </div>
            </div>
            <div id="account-mode-grid" class="account-mode-grid"></div>
          </div>
          <div class="account-section">
            <div class="section-head compact">
              <div>
                <h2>Performance Per Course</h2>
              </div>
            </div>
            <div id="account-course-grid" class="account-course-grid"></div>
          </div>
          <div class="account-section">
            <div class="section-head compact">
              <div>
                <h2>Recent Quiz Activity</h2>
              </div>
            </div>
            <div id="account-recent-list" class="account-recent-list"></div>
          </div>
        </div>
      </section>
    `,
    settings: `
      <section id="settings-view" class="view settings-view" hidden>
        <div class="settings-shell">
          <div class="settings-header">
            <div class="settings-eyebrow">
              <span class="settings-eyebrow-line"></span>
              <span class="settings-eyebrow-text">Settings</span>
              <span class="settings-eyebrow-line"></span>
            </div>
            <h2 id="settings-page-title" class="settings-page-title">Account settings</h2>
            <p id="settings-page-subtitle" class="settings-page-subtitle">Manage account access, appearance preference, and account actions.</p>
            <div class="settings-summary-strip">
              <div class="settings-summary-cell">
                <div id="settings-access-status-value" class="settings-summary-value">Active</div>
                <div class="settings-summary-key">Access</div>
              </div>
              <div class="settings-summary-cell">
                <div id="settings-expiry-value" class="settings-summary-value">--</div>
                <div class="settings-summary-key">Expires</div>
              </div>
              <div class="settings-summary-cell">
                <div id="settings-days-left-value" class="settings-summary-value good">--</div>
                <div class="settings-summary-key">Time Left</div>
              </div>
            </div>
          </div>
          <div class="settings-sections">
            <section class="settings-section">
              <h3 class="settings-section-title">Appearance</h3>
              <div class="settings-row settings-row-theme">
                <span class="settings-row-label">Theme preference</span>
                <label class="settings-theme-toggle" for="theme-mode-toggle">
                  <input id="theme-mode-toggle" class="settings-theme-toggle-input" type="checkbox" aria-label="Toggle dark mode">
                  <span class="settings-theme-toggle-ui" aria-hidden="true">
                    <span class="settings-theme-toggle-option">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="4"></circle>
                        <path d="M12 2v2.5"></path>
                        <path d="M12 19.5V22"></path>
                        <path d="m4.93 4.93 1.77 1.77"></path>
                        <path d="m17.3 17.3 1.77 1.77"></path>
                        <path d="M2 12h2.5"></path>
                        <path d="M19.5 12H22"></path>
                        <path d="m4.93 19.07 1.77-1.77"></path>
                        <path d="m17.3 6.7 1.77-1.77"></path>
                      </svg>
                    </span>
                    <span class="settings-theme-toggle-option">
                      <svg viewBox="0 0 24 24">
                        <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"></path>
                      </svg>
                    </span>
                    <span class="settings-theme-toggle-pill"></span>
                  </span>
                </label>
                <p id="settings-theme-note" class="settings-theme-note" hidden>Light mode is currently active.</p>
              </div>
            </section>

            <section class="settings-section">
              <h3 class="settings-section-title">Subscription</h3>
              <div class="settings-section-rows">
                <div class="settings-row">
                  <div class="settings-row-leading">
                    <span class="settings-row-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                        <path d="m3 7 9 6 9-6"></path>
                      </svg>
                    </span>
                    <span class="settings-row-label">Account Email</span>
                  </div>
                  <span id="settings-email-value" class="settings-row-value">No email</span>
                </div>

                <div class="settings-row">
                  <span class="settings-row-label">Status</span>
                  <span id="settings-status-chip" class="settings-status-chip">Unknown</span>
                </div>

                <div class="settings-row">
                  <span class="settings-row-label">Expiry</span>
                  <span id="settings-expiry-detail-value" class="settings-row-value settings-row-value-muted">Not set</span>
                </div>

                <div class="settings-row">
                  <span class="settings-row-label">Time Left</span>
                  <span id="settings-time-left-detail-value" class="settings-row-value settings-row-value-muted">No expiry date is available yet.</span>
                </div>

                <div id="settings-reason-row" class="settings-row" hidden>
                  <span class="settings-row-label">Reason</span>
                  <span id="settings-reason-value" class="settings-row-value settings-row-value-muted"></span>
                </div>
              </div>
            </section>

            <section class="settings-section">
              <h3 class="settings-section-title">Account Actions</h3>
              <div class="settings-section-rows">
                <div class="settings-row settings-row-action">
                  <span class="settings-row-label">Sign out of this device</span>
                  <button id="settings-signout-btn" class="settings-action-btn" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <path d="m16 17 5-5-5-5"></path>
                      <path d="M21 12H9"></path>
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>

                <div class="settings-row settings-row-action">
                  <span class="settings-row-label">Clear saved quiz history</span>
                  <button id="settings-reset-account-btn" class="settings-action-btn settings-action-btn-danger" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 2v6h6"></path>
                      <path d="M3.5 13a8.5 8.5 0 1 0 2.3-5.8L3 10"></path>
                    </svg>
                    <span>Reset Account</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    `,
    access: `
      <section id="access-view" class="view access-view" hidden>
        <div class="access-shell">
          <div id="access-status-badge" class="access-status-badge is-warning">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 9v4"></path>
              <path d="M12 17h.01"></path>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            </svg>
            <span>Pending Activation</span>
          </div>

          <h2 id="access-title" class="access-page-title">Access Restricted</h2>
          <p id="access-message" class="access-page-subtitle">Your sign-in was successful, but your account does not have an active subscription to access the medical bank.</p>

          <div class="access-identity-pill">
            <div class="access-identity-main">
              <div class="access-identity-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                  <path d="m3 7 9 6 9-6"></path>
                </svg>
              </div>
              <div class="access-identity-copy">
                <span class="access-identity-label">Signed in as</span>
                <span id="access-email-value" class="access-identity-value">account@example.com</span>
              </div>
            </div>

            <div id="access-identity-status" class="access-identity-status is-success">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 12 2 2 4-4"></path>
                <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"></path>
              </svg>
              <span id="access-identity-status-text">Account Verified</span>
            </div>
          </div>

          <div id="access-meta" class="access-meta-list" hidden></div>

          <div class="access-actions">
            <button id="btn-check-access" class="access-primary-btn" type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 2v6h-6"></path>
                <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8"></path>
                <path d="M3 22v-6h6"></path>
                <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16"></path>
              </svg>
              <span>Check Access Again</span>
            </button>

            <button id="btn-contact-support" class="access-secondary-btn" type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3"></path>
                <path d="M12 17h.01"></path>
                <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"></path>
              </svg>
              <span>Contact Support</span>
            </button>
          </div>

          <button id="btn-access-signout" class="access-signout-btn" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <path d="m16 17 5-5-5-5"></path>
              <path d="M21 12H9"></path>
            </svg>
            <span>Sign out and use a different account</span>
          </button>
        </div>
      </section>
    `,
  };

  document.title = pageTitles[page] || "Bitramed";

  const orderedViews = [
    viewTemplates.dashboard,
    viewTemplates.modules,
    viewTemplates.subtopics,
    viewTemplates.types,
    viewTemplates.quizzes,
    viewTemplates.setup,
    viewTemplates.quiz,
    viewTemplates.results,
    viewTemplates.account,
    viewTemplates.settings,
    viewTemplates.access,
  ].join("");

  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <button
            id="brand-home-btn"
            class="brand-home-btn"
            type="button"
            aria-label="Go home"
            title="Home"
            data-topbar-action="home"
          >
            <span class="brand-home-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>
            </span>
            <span class="brand-home-text">Bitramed</span>
          </button>
        </div>

        <div class="topbar-right">
          <button
            id="topbar-user-pill"
            class="topbar-user-pill topbar-user-btn"
            type="button"
            title="Open account stats"
            data-topbar-action="account"
            hidden
          >
            <span id="topbar-user-avatar" class="topbar-user-avatar" aria-hidden="true">A</span>
            <span id="topbar-user-name" class="topbar-user-name">Account</span>
          </button>

          <div class="menu-wrap">
            <button
              id="menu-toggle-btn"
              class="icon-btn menu-toggle-btn"
              aria-label="Open menu"
              aria-expanded="false"
              aria-controls="topbar-menu"
              title="Menu"
              type="button"
              data-topbar-action="toggle-menu"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16"></path>
                <path d="M4 12h16"></path>
                <path d="M4 18h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div id="topbar-menu" class="topbar-menu" aria-hidden="true" role="dialog" aria-label="Main menu">
        <div class="menu-sheet-header">
          <div class="menu-sheet-user">
            <span id="menu-sheet-avatar" class="menu-sheet-avatar" aria-hidden="true">A</span>
            <div class="menu-sheet-user-copy">
              <div id="menu-sheet-name" class="menu-sheet-name">Account</div>
              <div id="menu-sheet-role" class="menu-sheet-role">Bitramed Learner</div>
            </div>
          </div>
          <button
            id="menu-close-btn"
            class="menu-sheet-close"
            type="button"
            aria-label="Close menu"
            title="Close menu"
            data-topbar-action="close-menu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div class="menu-sheet-body">
          <section class="menu-sheet-section">
            <div class="menu-section-title">Current View</div>
            <div class="menu-session-strip">
              <div class="menu-session-left">
                <span id="menu-session-dot" class="menu-session-dot" aria-hidden="true"></span>
                <div class="menu-session-copy">
                  <span id="menu-session-text" class="menu-session-text">Home</span>
                </div>
              </div>
              <span id="menu-session-time" class="menu-session-time">Live</span>
            </div>
          </section>

          <section class="menu-sheet-section">
            <div class="menu-section-title">Navigate</div>
            <div class="menu-sheet-items">
              <button
                id="menu-home-btn"
                class="menu-action-btn menu-sheet-item"
                type="button"
                data-topbar-action="home"
                data-menu-view="home"
              >
                <span class="menu-action-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>
                    <path d="M2 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 20 10v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path>
                  </svg>
                </span>
                <span class="menu-action-copy">
                  <strong>Home</strong>
                </span>
                <span class="menu-item-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>

              <button
                id="menu-account-btn"
                class="menu-action-btn menu-sheet-item"
                type="button"
                data-topbar-action="account"
                data-menu-view="account"
              >
                <span class="menu-action-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <span class="menu-action-copy">
                  <strong>Account</strong>
                </span>
                <span class="menu-item-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>

              <button
                id="menu-settings-btn"
                class="menu-action-btn menu-sheet-item"
                type="button"
                data-topbar-action="settings"
                data-menu-view="settings"
              >
                <span class="menu-action-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </span>
                <span class="menu-action-copy">
                  <strong>Settings</strong>
                </span>
                <span class="menu-item-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>
            </div>
          </section>

          <section class="menu-sheet-section">
            <div class="menu-section-title">Tools</div>
            <div class="menu-sheet-items">
              <button
                id="search-toggle-btn"
                class="menu-action-btn menu-sheet-item"
                type="button"
                data-topbar-action="open-search"
              >
                <span class="menu-action-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m21 21-4.34-4.34"></path>
                    <circle cx="11" cy="11" r="8"></circle>
                  </svg>
                </span>
                <span class="menu-action-copy">
                  <strong>Search</strong>
                </span>
                <span class="menu-item-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>

              <button
                id="refresh-db-btn"
                class="menu-action-btn menu-sheet-item"
                type="button"
                data-topbar-action="refresh"
              >
                <span class="menu-action-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <path d="M8 16H3v5"></path>
                  </svg>
                </span>
                <span class="menu-action-copy">
                  <strong>Refresh content</strong>
                </span>
                <span class="menu-item-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </span>
              </button>
            </div>
          </section>

          <section class="menu-sheet-section menu-sheet-section-footer">
            <button
              id="signout-btn"
              class="menu-action-btn menu-sheet-item is-danger"
              type="button"
              data-topbar-action="signout"
            >
              <span class="menu-action-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <path d="m16 17 5-5-5-5"></path>
                  <path d="M21 12H9"></path>
                </svg>
              </span>
              <span class="menu-action-copy">
                <strong>Sign out</strong>
              </span>
              <span class="menu-item-spacer" aria-hidden="true"></span>
            </button>

            <div class="menu-sheet-footer">
              <span class="menu-sheet-brand">Bitramed</span>
              <span class="menu-sheet-version">v3.0.1</span>
            </div>
          </section>
        </div>
      </div>

      <div id="menu-backdrop" class="menu-backdrop" data-topbar-action="close-menu"></div>
      <div id="search-backdrop" class="search-backdrop" data-topbar-action="close-search"></div>

      <div id="search-overlay" class="search-overlay" aria-hidden="true">
        <div class="search-overlay-inner">
          <div class="search-overlay-head">
            <div class="search-overlay-head-copy">
              <span class="search-overlay-kicker">Quick Search</span>
              <p class="search-overlay-copy">Jump to any year, course, chapter, or assessment.</p>
            </div>
            <span class="search-overlay-shortcut" aria-hidden="true">Esc</span>
          </div>
          <div class="search-bar-row">
            <span class="search-bar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"></circle>
                <path d="m20 20-3.6-3.6"></path>
              </svg>
            </span>
            <input
              id="global-search"
              class="search-input overlay-search-input"
              type="text"
              placeholder="Search a year, course, chapter, or assessment"
              autocomplete="off"
            />
            <button
              id="search-close-btn"
              class="icon-btn close-search-btn"
              aria-label="Close search"
              title="Close"
              type="button"
              data-topbar-action="close-search"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z"/>
              </svg>
            </button>
          </div>
          <div id="search-results" class="search-results"></div>
        </div>
      </div>

      <div id="toast" class="toast" aria-live="polite"></div>

      <main class="main-wrap">
        <section id="loading-view" class="loading-view" aria-live="polite" aria-busy="true">
          <div class="loading-view-stage">
            <div class="loader" aria-hidden="true"></div>
            <p class="loading-view-copy">Loading</p>
          </div>
        </section>
        ${orderedViews}
      </main>
    </div>
  `;
}
