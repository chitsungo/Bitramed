import {
  applyDocumentThemePreference,
  createSupabaseClient,
  normalizeThemePreference,
  readStoredThemePreference,
  writeStoredThemePreference,
} from "../core/supabase.js";
import {
  loadUserThemePreference,
  saveUserThemePreference,
} from "../services/preferences-service.js";

export const learnerCore = {
  menuOpenFrame: null,
  menuCloseTimer: null,
  quizCountdownInterval: null,
  quizCountdownDeadline: 0,
  quizSubmissionInFlight: false,
  appDataCacheWriteTimer: null,
  restoringAppDataCache: false,
  appDataCacheVersion: 2,
  state: {
    levelList: [],
    levelIdByName: {},
    areaList: [],
    areasByLevel: {},
    modulesByArea: {},
    subtopicProgressByArea: {},
    quizzesByModule: {},
    quizMap: {},
    quizDetailsById: {},
    questionsByQuizId: {},
    attempts: [],
    attemptsSignature: "",
    attemptsByQuizId: {},
    userStats: null,
    accountSummary: null,
    quizAttemptSummariesById: {},
    moduleTypeCountsByModule: {},
    currentLevel: "",
    currentArea: "",
    currentSub: "",
    currentType: "",
    currentQuizTitle: "",
    currentQuizId: "",
    mode: "study",
    currentExamDurationMinutes: null,
    quizTimeRemainingSeconds: null,
    activeQuestions: [],
    reviewWrongOnly: false,
    currentResultsSnapshot: null,
    refreshInFlight: false,
    supabaseClient: null,
    currentUser: null,
    accessStatus: null,
    themePreference: "light",
    search: {
      indexLoaded: false,
      results: [],
      activeIndex: -1,
    },
    topbar: {
      menuOpen: false,
      searchOpen: false,
    },
  },

  async init() {
    try {
      this.cacheDom();
      this.initSupabaseClient();
      this.applyThemePreference(this.getThemePreference());
      await this.requireSessionOrRedirect();
      await this.loadThemePreference();
      this.bindTopbarEngine();
      this.startMenuSessionClock();
      this.bindAppEvents();
      window.addEventListener("popstate", () => {
        void this.router();
      });
      const restoredCachedState = this.restoreAppDataCache();

      if (restoredCachedState) {
        await this.router();
        void this.loadDatabase({
          showLoading: false,
          rerenderOnComplete: true,
        }).catch(async (error) => {
          await this.handleInitError(error);
        });
        return;
      }

      await this.loadDatabase();
      await this.router();
    } catch (error) {
      await this.handleInitError(error);
    }
  },

  async handleInitError(error) {
    console.error("App init failed:", error);
    if (await this.handleAccessRestriction(error)) {
      return;
    }
    if (
      this.isAuthSessionError(error) ||
      String(error?.message || "") === "No active session."
    ) {
      return;
    }
    this.showFatalLoadError(error?.message || "App initialization failed.");
  },

  getPageStateForView(view) {
    const normalizedView = view === "home" ? "home" : view;
    const titles = {
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

    return {
      bodyPage: normalizedView,
      title: titles[normalizedView] || "Bitramed",
    };
  },

  syncPageState(view) {
    const pageState = this.getPageStateForView(view);
    if (document.body) {
      document.body.dataset.appPage = pageState.bodyPage;
    }
    document.title = pageState.title;
  },

  getAppDataCacheKey() {
    const userId = String(this.state.currentUser?.id || "").trim();
    return userId ? `bitramed:learner-cache:${userId}` : "";
  },

  clearPersistedAppDataCache() {
    const storageKey = this.getAppDataCacheKey();
    if (!storageKey) return;

    try {
      window.sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Learner cache clear failed:", error);
    }
  },

  scheduleAppDataCacheWrite() {
    if (this.restoringAppDataCache || !this.state.currentUser) return;

    if (this.appDataCacheWriteTimer) {
      window.clearTimeout(this.appDataCacheWriteTimer);
    }

    this.appDataCacheWriteTimer = window.setTimeout(() => {
      this.appDataCacheWriteTimer = null;
      this.persistAppDataCache();
    }, 80);
  },

  persistAppDataCache() {
    const storageKey = this.getAppDataCacheKey();
    if (!storageKey) return;

    const snapshot = {
      version: this.appDataCacheVersion,
      savedAt: Date.now(),
      accessStatus: this.state.accessStatus,
      levelList: this.state.levelList,
      levelIdByName: this.state.levelIdByName,
      areaList: this.state.areaList,
      areasByLevel: this.state.areasByLevel,
      modulesByArea: this.state.modulesByArea,
      subtopicProgressByArea: this.state.subtopicProgressByArea,
      quizzesByModule: this.state.quizzesByModule,
      quizMap: this.state.quizMap,
      quizDetailsById: this.state.quizDetailsById,
      attempts: this.state.attempts,
      moduleTypeCountsByModule: this.state.moduleTypeCountsByModule,
      searchIndexLoaded: this.state.search.indexLoaded,
    };

    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch (error) {
      console.error("Learner cache write failed:", error);
    }
  },

  restoreAppDataCache() {
    const storageKey = this.getAppDataCacheKey();
    if (!storageKey) return false;

    try {
      const rawSnapshot = window.sessionStorage.getItem(storageKey);
      if (!rawSnapshot) return false;

      const snapshot = JSON.parse(rawSnapshot);
      const savedAt = Number(snapshot?.savedAt || 0);
      const isFresh = Date.now() - savedAt < 1000 * 60 * 10;
      const isValidVersion = snapshot?.version === this.appDataCacheVersion;

      if (!isFresh || !isValidVersion) {
        window.sessionStorage.removeItem(storageKey);
        return false;
      }

      this.restoringAppDataCache = true;
      this.state.accessStatus = snapshot?.accessStatus || null;
      this.state.levelList = Array.isArray(snapshot?.levelList)
        ? snapshot.levelList
        : [];
      this.state.levelIdByName =
        snapshot?.levelIdByName && typeof snapshot.levelIdByName === "object"
          ? snapshot.levelIdByName
          : {};
      this.state.areaList = Array.isArray(snapshot?.areaList)
        ? snapshot.areaList
        : [];
      this.state.areasByLevel =
        snapshot?.areasByLevel && typeof snapshot.areasByLevel === "object"
          ? snapshot.areasByLevel
          : {};
      this.state.modulesByArea =
        snapshot?.modulesByArea && typeof snapshot.modulesByArea === "object"
          ? snapshot.modulesByArea
          : {};
      this.state.subtopicProgressByArea =
        snapshot?.subtopicProgressByArea &&
        typeof snapshot.subtopicProgressByArea === "object"
          ? snapshot.subtopicProgressByArea
          : {};
      this.state.quizzesByModule =
        snapshot?.quizzesByModule && typeof snapshot.quizzesByModule === "object"
          ? snapshot.quizzesByModule
          : {};
      this.state.quizMap =
        snapshot?.quizMap && typeof snapshot.quizMap === "object"
          ? snapshot.quizMap
          : {};
      this.state.quizDetailsById =
        snapshot?.quizDetailsById &&
        typeof snapshot.quizDetailsById === "object"
          ? snapshot.quizDetailsById
          : {};
      this.state.moduleTypeCountsByModule =
        snapshot?.moduleTypeCountsByModule &&
        typeof snapshot.moduleTypeCountsByModule === "object"
          ? snapshot.moduleTypeCountsByModule
          : {};
      this.state.search.indexLoaded = !!snapshot?.searchIndexLoaded;
      this.setAttemptsData(
        Array.isArray(snapshot?.attempts) ? snapshot.attempts : []
      );
      this.restoringAppDataCache = false;

      return (
        !!this.state.accessStatus ||
        !!this.state.levelList.length ||
        !!this.state.attempts.length
      );
    } catch (error) {
      this.restoringAppDataCache = false;
      console.error("Learner cache restore failed:", error);
      this.clearPersistedAppDataCache();
      return false;
    }
  },

  cacheDom() {
    this.dom = {
      menuToggleBtn: document.getElementById("menu-toggle-btn"),
      topbarMenu: document.getElementById("topbar-menu"),
      menuSheetBody: document.querySelector("#topbar-menu .menu-sheet-body"),
      menuBackdrop: document.getElementById("menu-backdrop"),
      menuSheetAvatar: document.getElementById("menu-sheet-avatar"),
      menuSheetName: document.getElementById("menu-sheet-name"),
      menuSheetRole: document.getElementById("menu-sheet-role"),
      menuSessionDot: document.getElementById("menu-session-dot"),
      menuSessionText: document.getElementById("menu-session-text"),
      menuSessionTime: document.getElementById("menu-session-time"),
      refreshBtn: document.getElementById("refresh-db-btn"),
      signoutBtn: document.getElementById("signout-btn"),
      topbarUserPill: document.getElementById("topbar-user-pill"),
      topbarUserAvatar: document.getElementById("topbar-user-avatar"),
      topbarUserName: document.getElementById("topbar-user-name"),
      searchOverlay: document.getElementById("search-overlay"),
      searchBackdrop: document.getElementById("search-backdrop"),
      searchInput: document.getElementById("global-search"),
      searchResults: document.getElementById("search-results"),
      toast: document.getElementById("toast"),
      loadingView: document.getElementById("loading-view"),
      dashboardGreetingRow: document.getElementById("dashboard-greeting-row"),
      dashboardGreeting: document.getElementById("dashboard-greeting"),
      dashboardGreetingName: document.getElementById("dashboard-greeting-name"),
      dashboardOverallRing: document.getElementById("dashboard-overall-ring"),
      dashboardOverallRingValue: document.getElementById(
        "dashboard-overall-ring-value"
      ),
      dashboardActiveYears: document.getElementById("dashboard-active-years"),
      dashboardCompletedCount: document.getElementById(
        "dashboard-completed-count"
      ),
      dashboardAverageScore: document.getElementById("dashboard-average-score"),
      accessOverallRing: document.getElementById("access-overall-ring"),
      accessOverallRingValue: document.getElementById(
        "access-overall-ring-value"
      ),
      accessOverallLabel: document.getElementById("access-overall-label"),
      accessActiveYears: document.getElementById("access-active-years"),
      accessCompletedCount: document.getElementById("access-completed-count"),
      accessAverageScore: document.getElementById("access-average-score"),
      accessSectionCount: document.getElementById("access-section-count"),
      accessYearGrid: document.getElementById("access-year-grid"),
      areaGrid: document.getElementById("area-grid"),
      moduleGrid: document.getElementById("module-grid"),
      subtopicsGrid: document.getElementById("subtopics-grid"),
      typesPageKicker: document.getElementById("types-page-kicker"),
      typesTotalQuestions: document.getElementById("types-total-questions"),
      typesFormatCount: document.getElementById("types-format-count"),
      typesCompletePercent: document.getElementById("types-complete-percent"),
      quizListView: document.getElementById("quiz-list-view"),
      quizListKicker: document.getElementById("quiz-list-kicker"),
      quizListSubtitle: document.getElementById("quiz-list-subtitle"),
      quizListAssessmentCount: document.getElementById(
        "quiz-list-assessment-count"
      ),
      quizListCompletedCount: document.getElementById(
        "quiz-list-completed-count"
      ),
      quizListAverageScore: document.getElementById("quiz-list-average-score"),
      quizListModeBadge: document.getElementById("quiz-list-mode-badge"),
      quizListModeDescription: document.getElementById(
        "quiz-list-mode-description"
      ),
      quizListSectionCount: document.getElementById("quiz-list-section-count"),
      quizPageKicker: document.getElementById("quiz-page-kicker"),
      quizTotalCount: document.getElementById("quiz-total-count"),
      quizAnsweredCount: document.getElementById("quiz-answered-count"),
      quizModeStat: document.getElementById("quiz-mode-stat"),
      quizProgressCount: document.getElementById("quiz-progress-count"),
      quizProgressFill: document.getElementById("quiz-progress-fill"),
      quizProgressCopy: document.getElementById("quiz-progress-copy"),
      typesGrid: document.getElementById("types-grid"),
      quizList: document.getElementById("quiz-list"),
      quizForm: document.getElementById("quiz-form"),
      quizSubmitBtn: document.getElementById("btn-submit"),
      countCorrect: document.getElementById("count-correct"),
      countWrong: document.getElementById("count-wrong"),
      countUnanswered: document.getElementById("count-unanswered"),
      finalScore: document.getElementById("final-score"),
      resultsAttemptCount: document.getElementById("results-attempt-count"),
      resultsSummaryFill: document.getElementById("results-summary-fill"),
      resultsCorrectSegment: document.getElementById("results-correct-segment"),
      resultsWrongSegment: document.getElementById("results-wrong-segment"),
      resultsUnansweredSegment: document.getElementById(
        "results-unanswered-segment"
      ),
      resultsPageKicker: document.getElementById("results-page-kicker"),
      resultsTypeBadge: document.getElementById("results-type-badge"),
      resultsPageTitle: document.getElementById("results-page-title"),
      resultsPageMeta: document.getElementById("results-page-meta"),
      resultsModeLabel: document.getElementById("results-mode-label"),
      resultsSummaryHeadline: document.getElementById(
        "results-summary-headline"
      ),
      resultsSummaryCopy: document.getElementById("results-summary-copy"),
      resultsReviewCount: document.getElementById("results-review-count"),
      resultsStickyBar: document.getElementById("results-sticky-bar"),
      resultsStickyLabel: document.getElementById("results-sticky-label"),
      resultsStickyAction: document.getElementById("results-sticky-action"),
      resultsBottomActions: document.getElementById("results-bottom-actions"),
      progressFill: document.getElementById("progress-fill"),
      progressText: document.getElementById("progress-text"),
      resultsContainer: document.getElementById("results-container"),
      toggleReviewWrongBtn: document.getElementById("toggle-review-wrong-btn"),
      accountPageTitle: document.getElementById("account-page-title"),
      accountPageSubtitle: document.getElementById("account-page-subtitle"),
      accountEmptyState: document.getElementById("account-empty-state"),
      accountContent: document.getElementById("account-content"),
      accountOverviewGrid: document.getElementById("account-overview-grid"),
      accountModeGrid: document.getElementById("account-mode-grid"),
      accountCourseGrid: document.getElementById("account-course-grid"),
      accountRecentList: document.getElementById("account-recent-list"),
      settingsPageTitle: document.getElementById("settings-page-title"),
      settingsPageSubtitle: document.getElementById("settings-page-subtitle"),
      settingsAccessStatusValue: document.getElementById(
        "settings-access-status-value"
      ),
      settingsExpiryValue: document.getElementById("settings-expiry-value"),
      settingsDaysLeftValue: document.getElementById(
        "settings-days-left-value"
      ),
      settingsAccessMeta: document.getElementById("settings-access-meta"),
      settingsEmailValue: document.getElementById("settings-email-value"),
      settingsStatusChip: document.getElementById("settings-status-chip"),
      settingsExpiryDetailValue: document.getElementById(
        "settings-expiry-detail-value"
      ),
      settingsTimeLeftDetailValue: document.getElementById(
        "settings-time-left-detail-value"
      ),
      settingsReasonRow: document.getElementById("settings-reason-row"),
      settingsReasonValue: document.getElementById("settings-reason-value"),
      themeModeToggle: document.getElementById("theme-mode-toggle"),
      settingsThemeNote: document.getElementById("settings-theme-note"),
      settingsSignoutBtn: document.getElementById("settings-signout-btn"),
      settingsResetAccountBtn: document.getElementById(
        "settings-reset-account-btn"
      ),
      accessView: document.getElementById("access-view"),
      accessStatusBadge: document.getElementById("access-status-badge"),
      accessTitle: document.getElementById("access-title"),
      accessMessage: document.getElementById("access-message"),
      accessMeta: document.getElementById("access-meta"),
      accessEmailValue: document.getElementById("access-email-value"),
      accessIdentityStatus: document.getElementById("access-identity-status"),
      accessIdentityStatusText: document.getElementById(
        "access-identity-status-text"
      ),
    };
    this.defaultLoadingViewHtml = this.dom.loadingView?.innerHTML || "";
  },

  initSupabaseClient() {
    this.state.supabaseClient = createSupabaseClient();
  },

  getSupabase() {
    if (!this.state.supabaseClient) {
      throw new Error("Supabase client is not initialized.");
    }
    return this.state.supabaseClient;
  },

  isAuthSessionError(error) {
    const code = String(error?.code || "")
      .trim()
      .toUpperCase();
    const message = String(error?.message || "").toLowerCase();

    return (
      ["PGRST301"].includes(code) ||
      [
        "auth session missing",
        "jwt expired",
        "invalid jwt",
        "refresh token",
        "session expired",
      ].some((fragment) => message.includes(fragment))
    );
  },

  async requireSessionOrRedirect() {
    const { data, error } = await this.getSupabase().auth.getUser();
    if (error && !this.isAuthSessionError(error)) throw error;

    if (!data.user) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/?next=${encodeURIComponent(nextPath)}`);
      throw new Error("No active session.");
    }

    this.state.currentUser = data.user;
    this.renderTopbarUser();
  },

  async loadAccessStatus() {
    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_my_access_status"),
      12000,
      "Checking account access"
    );
    if (error) {
      if (this.isAuthSessionError(error)) {
        this.state.accessStatus = {
          status: "signed_out",
          hasAccess: false,
          blockReason: "",
          accessExpiresAt: null,
        };
        return this.state.accessStatus;
      }
      throw error;
    }

    this.state.accessStatus = data || {
      status: "no_access",
      hasAccess: false,
    };

    return this.state.accessStatus;
  },

  hasActiveAccess() {
    return !!this.state.accessStatus?.hasAccess;
  },

  isAccessRestrictionError(error) {
    const message = String(error?.message || "").toLowerCase();
    return [
      "does not currently have app access",
      "has been blocked",
      "access period has expired",
      "renew your subscription",
    ].some((fragment) => message.includes(fragment));
  },

  inferAccessStatusFromError(error) {
    const message = String(error?.message || "").toLowerCase();

    if (this.isAuthSessionError(error)) {
      return {
        status: "signed_out",
        hasAccess: false,
        blockReason: "",
        accessExpiresAt: null,
      };
    }

    if (message.includes("blocked")) {
      return {
        status: "blocked",
        hasAccess: false,
        blockReason: "",
        accessExpiresAt: null,
      };
    }

    if (message.includes("expired") || message.includes("renew")) {
      return {
        status: "expired",
        hasAccess: false,
        blockReason: "",
        accessExpiresAt: null,
      };
    }

    return {
      status: "no_access",
      hasAccess: false,
      blockReason: "",
      accessExpiresAt: null,
    };
  },

  async handleAccessRestriction(error) {
    if (this.isAuthSessionError(error)) {
      this.state.accessStatus = this.inferAccessStatusFromError(error);
      this.renderAccessGate();
      return true;
    }

    if (!this.isAccessRestrictionError(error)) return false;

    try {
      await this.loadAccessStatus();
    } catch (statusError) {
      console.error("Access status refresh failed:", statusError);
      this.state.accessStatus = this.inferAccessStatusFromError(error);
    }

    this.renderAccessGate();
    return true;
  },

  getDisplayNameForUser(user) {
    const displayName = String(user?.user_metadata?.display_name || "").trim();
    if (displayName) return displayName;

    const fullName = String(user?.user_metadata?.full_name || "").trim();
    if (fullName) return fullName;

    const email = String(user?.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];

    return "Account";
  },

  renderTopbarUser() {
    const displayName = this.getDisplayNameForUser(this.state.currentUser);
    const initials =
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "B";

    if (this.dom.topbarUserAvatar) {
      this.dom.topbarUserAvatar.textContent = initials;
    }
    if (this.dom.topbarUserName) {
      this.dom.topbarUserName.textContent = displayName;
    }
    if (this.dom.menuSheetAvatar) {
      this.dom.menuSheetAvatar.textContent = initials;
    }
    if (this.dom.menuSheetName) {
      this.dom.menuSheetName.textContent = displayName;
    }
    this.renderMenuSheetContext();
    if (this.dom.topbarUserPill) {
      this.dom.topbarUserPill.hidden = false;
      this.dom.topbarUserPill.title = displayName;
      this.dom.topbarUserPill.setAttribute(
        "aria-label",
        `Open account stats for ${displayName}`
      );
    }
  },

  getMenuRoleLabel() {
    const level = String(this.state.currentLevel || "").trim();
    if (!level) return "Bitramed Learner";
    return `${level} - Medical Student`;
  },

  formatMenuSessionTime(date = new Date()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  },

  pulseMenuSessionDot() {
    if (!this.dom.menuSessionDot) return;
    this.dom.menuSessionDot.classList.remove("is-pulsing");
    void this.dom.menuSessionDot.offsetWidth;
    this.dom.menuSessionDot.classList.add("is-pulsing");
  },

  updateMenuSessionClock({ pulse = false } = {}) {
    if (this.dom.menuSessionTime) {
      this.dom.menuSessionTime.textContent = this.formatMenuSessionTime(
        new Date()
      );
    }
    if (pulse) {
      this.pulseMenuSessionDot();
    }
  },

  stopMenuSessionClock() {
    if (this.menuSessionClockTimeout) {
      window.clearTimeout(this.menuSessionClockTimeout);
      this.menuSessionClockTimeout = null;
    }
    if (this.menuSessionClockInterval) {
      window.clearInterval(this.menuSessionClockInterval);
      this.menuSessionClockInterval = null;
    }
  },

  startMenuSessionClock() {
    this.stopMenuSessionClock();
    this.updateMenuSessionClock();

    const delayToNextSecond = 1000 - (Date.now() % 1000);
    this.menuSessionClockTimeout = window.setTimeout(() => {
      this.updateMenuSessionClock({ pulse: true });
      this.menuSessionClockInterval = window.setInterval(() => {
        this.updateMenuSessionClock({ pulse: true });
      }, 1000);
    }, delayToNextSecond);
  },

  stopSettingsCountdown() {
    if (this.settingsCountdownTimeout) {
      window.clearTimeout(this.settingsCountdownTimeout);
      this.settingsCountdownTimeout = null;
    }
    if (this.settingsCountdownInterval) {
      window.clearInterval(this.settingsCountdownInterval);
      this.settingsCountdownInterval = null;
    }
  },

  formatCountdownUnit(value, singular) {
    const safeValue = Math.max(0, Number(value || 0));
    return `${safeValue} ${singular}${safeValue === 1 ? "" : "s"}`;
  },

  formatAccessCountdownShort(parts = {}) {
    const days = Math.max(0, Number(parts.days || 0));
    const hours = String(Math.max(0, Number(parts.hours || 0))).padStart(
      2,
      "0"
    );
    const minutes = String(Math.max(0, Number(parts.minutes || 0))).padStart(
      2,
      "0"
    );
    const seconds = String(Math.max(0, Number(parts.seconds || 0))).padStart(
      2,
      "0"
    );
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  },

  formatAccessCountdownLong(parts = {}, prefix = "", suffix = "remaining.") {
    const segments = [
      this.formatCountdownUnit(parts.days, "day"),
      this.formatCountdownUnit(parts.hours, "hour"),
      this.formatCountdownUnit(parts.minutes, "minute"),
      this.formatCountdownUnit(parts.seconds, "second"),
    ];

    return [prefix, `${segments.join(", ")} ${suffix}`]
      .filter(Boolean)
      .join(" ")
      .trim();
  },

  renderSettingsCountdown(access = this.state.accessStatus) {
    const countdown = this.getAccessCountdown(access);
    const status = String(countdown.status || access?.status || "no_access");

    if (this.dom.settingsDaysLeftValue) {
      this.dom.settingsDaysLeftValue.textContent = countdown.shortLabel;
      this.dom.settingsDaysLeftValue.classList.remove("good", "fail");
      this.dom.settingsDaysLeftValue.classList.toggle(
        "good",
        status === "active"
      );
      this.dom.settingsDaysLeftValue.classList.toggle(
        "fail",
        ["blocked", "expired"].includes(status)
      );
    }

    if (this.dom.settingsTimeLeftDetailValue) {
      this.dom.settingsTimeLeftDetailValue.textContent = countdown.longLabel;
    }

    return countdown;
  },

  startSettingsCountdown(access = this.state.accessStatus) {
    this.stopSettingsCountdown();

    const countdown = this.renderSettingsCountdown(access);
    if (
      !access?.accessExpiresAt ||
      countdown.days === null ||
      countdown.shortLabel === "Expired"
    ) {
      return countdown;
    }

    const tick = () => {
      const nextCountdown = this.renderSettingsCountdown(access);
      if (nextCountdown.shortLabel === "Expired") {
        this.stopSettingsCountdown();
      }
    };

    const delayToNextSecond = 1000 - (Date.now() % 1000);
    this.settingsCountdownTimeout = window.setTimeout(() => {
      tick();
      this.settingsCountdownInterval = window.setInterval(tick, 1000);
    }, delayToNextSecond);

    return countdown;
  },

  getMenuSessionLabel() {
    const routeRoot =
      window.location.pathname
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean)[0] || "home";
    if (routeRoot === "account") return "Account";
    if (routeRoot === "settings") return "Settings";
    if (this.state.currentQuizTitle) return this.state.currentQuizTitle;
    if (this.state.currentSub) return this.state.currentSub;
    if (this.state.currentArea) return this.state.currentArea;
    if (this.state.currentLevel) return this.state.currentLevel;
    return "Home";
  },

  getMenuCurrentView() {
    const routeRoot =
      window.location.pathname
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean)[0] || "home";
    if (routeRoot === "account") return "account";
    if (routeRoot === "settings") return "settings";
    return "home";
  },

  renderMenuSheetContext() {
    if (this.dom.menuSheetRole) {
      this.dom.menuSheetRole.textContent = this.getMenuRoleLabel();
    }
    if (this.dom.menuSessionText) {
      this.dom.menuSessionText.textContent = this.getMenuSessionLabel();
    }
    this.updateMenuSessionClock();

    const currentView = this.getMenuCurrentView();
    document.querySelectorAll("[data-menu-view]").forEach((element) => {
      const isCurrent = element.getAttribute("data-menu-view") === currentView;
      element.classList.toggle("is-current", isCurrent);
      if (isCurrent) {
        element.setAttribute("aria-current", "page");
      } else {
        element.removeAttribute("aria-current");
      }
    });
  },

  getThemePreference() {
    if (typeof readStoredThemePreference === "function") {
      return readStoredThemePreference();
    }
    return "light";
  },

  applyThemePreference(mode) {
    const safeMode =
      typeof applyDocumentThemePreference === "function"
        ? applyDocumentThemePreference(mode)
        : mode === "dark"
          ? "dark"
          : "light";
    this.state.themePreference = safeMode;
    return safeMode;
  },

  async loadThemePreference() {
    const fallbackMode = this.getThemePreference();
    this.applyThemePreference(fallbackMode);

    const userId = this.state.currentUser?.id;
    if (!userId) return fallbackMode;

    try {
      const theme = await this.withTimeout(
        loadUserThemePreference(this.getSupabase(), userId),
        12000,
        "Loading theme preference"
      );

      const resolvedMode =
        typeof normalizeThemePreference === "function"
          ? normalizeThemePreference(theme)
          : theme === "dark"
            ? "dark"
            : "light";

      if (typeof writeStoredThemePreference === "function") {
        writeStoredThemePreference(resolvedMode);
      }
      this.applyThemePreference(resolvedMode);
      return resolvedMode;
    } catch (error) {
      console.error("Theme preference load failed:", error);
      this.applyThemePreference(fallbackMode);
      return fallbackMode;
    }
  },

  async setThemePreference(mode) {
    const safeMode =
      typeof writeStoredThemePreference === "function"
        ? writeStoredThemePreference(mode)
        : mode === "dark"
          ? "dark"
          : "light";
    this.applyThemePreference(safeMode);

    const userId = this.state.currentUser?.id;
    if (!userId) return safeMode;

    await this.withTimeout(
      saveUserThemePreference(this.getSupabase(), userId, safeMode),
      12000,
      "Saving theme preference"
    );
    return safeMode;
  },

  renderThemeToggle() {
    const mode = this.state.themePreference || this.getThemePreference();
    if (this.dom.themeModeToggle) {
      const isDark = mode === "dark";
      this.dom.themeModeToggle.checked = isDark;
      this.dom.themeModeToggle.setAttribute(
        "aria-checked",
        isDark ? "true" : "false"
      );
    }
    if (this.dom.settingsThemeNote) {
      this.dom.settingsThemeNote.textContent =
        mode === "dark"
          ? "Dark mode is currently active."
          : "Light mode is currently active.";
    }
  },

  getAccessCountdown(access = this.state.accessStatus) {
    const status = String(access?.status || "no_access");
    const expiresAtRaw = access?.accessExpiresAt || null;
    if (!expiresAtRaw) {
      return {
        status,
        days: null,
        hours: null,
        minutes: null,
        seconds: null,
        shortLabel: "Not set",
        longLabel: "No expiry date is available yet.",
      };
    }

    const expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime())) {
      return {
        status,
        days: null,
        hours: null,
        minutes: null,
        seconds: null,
        shortLabel: "Unknown",
        longLabel: "Expiry information could not be read.",
      };
    }

    const diffMs = expiresAt.getTime() - Date.now();
    if (status === "expired" || diffMs <= 0) {
      return {
        status: status === "blocked" ? "blocked" : "expired",
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        shortLabel: "Expired",
        longLabel:
          status === "blocked"
            ? "Access is blocked and the subscription has expired."
            : "Access has expired.",
      };
    }

    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const shortLabel = this.formatAccessCountdownShort({
      days,
      hours,
      minutes,
      seconds,
    });

    if (status === "blocked") {
      return {
        status,
        days,
        hours,
        minutes,
        seconds,
        shortLabel,
        longLabel: this.formatAccessCountdownLong(
          { days, hours, minutes, seconds },
          "Blocked account.",
          "remaining before expiry."
        ),
      };
    }

    return {
      status,
      days,
      hours,
      minutes,
      seconds,
      shortLabel,
      longLabel: this.formatAccessCountdownLong({
        days,
        hours,
        minutes,
        seconds,
      }),
    };
  },

  async signOutUser() {
    const { error } = await this.getSupabase().auth.signOut();
    if (error) {
      this.showToast("Sign out failed.");
      return;
    }
    this.clearPersistedAppDataCache();
    window.location.replace("/");
  },

  openAccessSupport() {
    const email =
      String(this.state.currentUser?.email || "").trim() || "Unknown";
    const status = String(
      this.state.accessStatus?.status || "no_access"
    ).replace(/_/g, " ");
    const reason = String(this.state.accessStatus?.blockReason || "").trim();
    const subject = encodeURIComponent("Bitramed access support");
    const body = encodeURIComponent(
      [
        "Hello Bitramed team,",
        "",
        "I need help with my account access.",
        "",
        `Signed in email: ${email}`,
        `Status: ${status}`,
        reason ? `Reason: ${reason}` : "",
        "",
        "Please assist.",
      ]
        .filter(Boolean)
        .join("\n")
    );

    window.location.href = `mailto:bitramed91@gmail.com?subject=${subject}&body=${body}`;
  },

  async handleTopbarAction(action) {
    switch (action) {
      case "toggle-menu":
        if (this.state.topbar.searchOpen) this.closeSearch();
        this.state.topbar.menuOpen ? this.closeMenu() : this.openMenu();
        break;
      case "close-menu":
        this.closeMenu();
        break;
      case "open-search":
        if (!this.hasActiveAccess()) {
          this.closeMenu();
          this.renderAccessGate();
          break;
        }
        this.closeMenu();
        this.openSearch();
        break;
      case "close-search":
        this.closeSearch();
        break;
      case "refresh":
        this.closeMenu();
        if (!this.hasActiveAccess()) {
          this.renderAccessGate();
          break;
        }
        await this.hardRefreshFromDatabase();
        break;
      case "home":
        this.closeAllTopbarUI();
        if (!this.hasActiveAccess()) {
          this.renderAccessGate();
          break;
        }
        this.reloadHomeRoute();
        break;
      case "account":
        this.closeAllTopbarUI();
        if (!this.hasActiveAccess()) {
          this.renderAccessGate();
          break;
        }
        await this.navigate("account");
        break;
      case "settings":
        this.closeAllTopbarUI();
        if (!this.hasActiveAccess()) {
          this.renderAccessGate();
          break;
        }
        await this.navigate("settings");
        break;
      case "signout":
        this.closeMenu();
        await this.signOutUser();
        break;
      default:
        break;
    }
  },

  bindTopbarAction(id, action) {
    const element = document.getElementById(id);
    if (!element) return;
    element.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this.handleTopbarAction(action);
    };
  },

  bindTopbarEngine() {
    [
      ["brand-home-btn", "home"],
      ["topbar-user-pill", "account"],
      ["menu-toggle-btn", "toggle-menu"],
      ["menu-close-btn", "close-menu"],
      ["menu-home-btn", "home"],
      ["menu-account-btn", "account"],
      ["menu-settings-btn", "settings"],
      ["search-toggle-btn", "open-search"],
      ["refresh-db-btn", "refresh"],
      ["signout-btn", "signout"],
      ["menu-backdrop", "close-menu"],
      ["search-backdrop", "close-search"],
      ["search-close-btn", "close-search"],
    ].forEach(([id, action]) => {
      this.bindTopbarAction(id, action);
    });

    document.addEventListener("click", (event) => {
      const clickedInsideMenu = !!event.target.closest("#topbar-menu");
      const clickedMenuToggle = !!event.target.closest("#menu-toggle-btn");

      if (
        this.state.topbar.menuOpen &&
        !clickedInsideMenu &&
        !clickedMenuToggle
      ) {
        this.closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (this.state.topbar.menuOpen) this.closeMenu();
        if (this.state.topbar.searchOpen) this.closeSearch();
      }
    });

    if (this.dom.searchInput) {
      this.dom.searchInput.addEventListener("input", () => {
        if (!this.hasActiveAccess()) return;
        if (this.state.topbar.searchOpen) {
          this.renderSearchResults();
        }
      });

      this.dom.searchInput.addEventListener("keydown", (event) => {
        if (!this.state.topbar.searchOpen) return;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.moveSearchSelection(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          this.moveSearchSelection(-1);
        } else if (event.key === "Enter") {
          if (this.state.search.activeIndex >= 0) {
            event.preventDefault();
            this.openSearchResultByIndex(this.state.search.activeIndex);
          }
        }
      });
    }
  },

  bindOptionalClick(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.onclick = handler;
  },

  bindAppEvents() {
    this.bindOptionalClick("btn-start-study", () =>
      this.navigate("quiz", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
        title: this.state.currentQuizTitle,
        mode: "study",
      })
    );

    this.bindOptionalClick("btn-start-exam", async () =>
      this.startExamModeFlow()
    );

    this.bindOptionalClick("btn-submit", () => this.handleSubmission());
    if (this.dom.quizForm) {
      this.dom.quizForm.addEventListener("submit", (event) => {
        event.preventDefault();
        this.handleSubmission();
      });
    }

    if (this.dom.toggleReviewWrongBtn) {
      this.dom.toggleReviewWrongBtn.onclick = () => {
        this.toggleResultsReviewFilter();
      };
    }
    this.bindOptionalClick("btn-retry-results", () => {
      this.clearQuizDraft();
      this.navigate("quiz", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
        title: this.state.currentQuizTitle,
        mode: this.state.mode,
        duration:
          this.state.mode === "exam" ? this.state.currentExamDurationMinutes : "",
      });
    });
    this.bindOptionalClick("btn-results-back-list", () => {
      this.clearQuizDraft();
      this.navigate("quizzes", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
      });
    });
    this.bindOptionalClick("btn-check-access", async () => {
      this.showLoadingView();
      try {
        await this.loadAccessStatus();
        if (!this.hasActiveAccess()) {
          this.renderAccessGate();
          return;
        }
        await this.hardRefreshFromDatabase();
      } catch (error) {
        console.error("Access refresh failed:", error);
        this.renderAccessGate();
      }
    });
    this.bindOptionalClick("btn-access-signout", async () =>
      this.signOutUser()
    );
    this.bindOptionalClick("btn-contact-support", () =>
      this.openAccessSupport()
    );
    this.bindOptionalClick("settings-signout-btn", async () =>
      this.signOutUser()
    );

    if (this.dom.settingsResetAccountBtn) {
      this.dom.settingsResetAccountBtn.onclick = async () =>
        this.resetAccountData();
    }

    if (this.dom.themeModeToggle) {
      this.dom.themeModeToggle.onchange = async () => {
        const mode = this.dom.themeModeToggle.checked ? "dark" : "light";
        try {
          await this.setThemePreference(mode);
          this.renderThemeToggle();
          this.showToast(`${mode === "dark" ? "Dark" : "Light"} mode saved.`);
        } catch (error) {
          console.error("Theme preference save failed:", error);
          this.showToast("Could not save theme preference.");
          await this.loadThemePreference();
          this.renderThemeToggle();
        }
      };
    }
  },

  openMenu() {
    if (
      !this.dom.topbarMenu ||
      !this.dom.menuBackdrop ||
      !this.dom.menuToggleBtn
    )
      return;
    if (this.menuCloseTimer) {
      window.clearTimeout(this.menuCloseTimer);
      this.menuCloseTimer = null;
    }
    if (this.menuOpenFrame) {
      window.cancelAnimationFrame(this.menuOpenFrame);
      this.menuOpenFrame = null;
    }
    this.renderMenuSheetContext();
    this.dom.topbarMenu.scrollTop = 0;
    if (this.dom.menuSheetBody) {
      this.dom.menuSheetBody.scrollTop = 0;
    }
    this.state.topbar.menuOpen = true;
    this.dom.topbarMenu.classList.add("is-mounted");
    this.dom.menuBackdrop.classList.add("is-visible");
    this.dom.menuToggleBtn.classList.add("is-active");
    this.dom.menuToggleBtn.setAttribute("aria-expanded", "true");
    this.dom.topbarMenu.setAttribute("aria-hidden", "false");
    this.menuOpenFrame = window.requestAnimationFrame(() => {
      this.menuOpenFrame = window.requestAnimationFrame(() => {
        if (!this.state.topbar.menuOpen) return;
        this.dom.topbarMenu?.classList.add("is-open");
        this.menuOpenFrame = null;
      });
    });
  },

  closeMenu() {
    if (
      !this.dom.topbarMenu ||
      !this.dom.menuBackdrop ||
      !this.dom.menuToggleBtn
    )
      return;
    if (this.menuOpenFrame) {
      window.cancelAnimationFrame(this.menuOpenFrame);
      this.menuOpenFrame = null;
    }
    if (this.menuCloseTimer) {
      window.clearTimeout(this.menuCloseTimer);
      this.menuCloseTimer = null;
    }
    this.state.topbar.menuOpen = false;
    this.dom.topbarMenu.classList.remove("is-open");
    this.dom.menuBackdrop.classList.remove("is-visible");
    this.dom.menuToggleBtn.classList.remove("is-active");
    this.dom.menuToggleBtn.setAttribute("aria-expanded", "false");
    this.dom.topbarMenu.setAttribute("aria-hidden", "true");
    this.dom.topbarMenu.scrollTop = 0;
    if (this.dom.menuSheetBody) {
      this.dom.menuSheetBody.scrollTop = 0;
    }
    this.menuCloseTimer = window.setTimeout(() => {
      if (!this.state.topbar.menuOpen) {
        this.dom.topbarMenu?.classList.remove("is-mounted");
      }
      this.menuCloseTimer = null;
    }, 340);
  },

  openSearch() {
    if (
      !this.dom.searchOverlay ||
      !this.dom.searchBackdrop ||
      !this.dom.searchInput
    )
      return;
    this.state.topbar.searchOpen = true;
    this.dom.searchOverlay.classList.add("is-open");
    this.dom.searchBackdrop.classList.add("is-visible");
    this.dom.searchOverlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      this.dom.searchInput.focus();
      this.renderSearchResults();
    });
  },

  closeSearch() {
    if (!this.dom.searchOverlay || !this.dom.searchBackdrop) return;
    this.state.topbar.searchOpen = false;
    this.dom.searchOverlay.classList.remove("is-open");
    this.dom.searchBackdrop.classList.remove("is-visible");
    this.dom.searchOverlay.setAttribute("aria-hidden", "true");
    this.clearSearchUI();
  },

  closeAllTopbarUI() {
    this.closeMenu();
    this.closeSearch();
  },

  clearSearchUI() {
    if (!this.dom.searchInput || !this.dom.searchResults) return;
    this.dom.searchInput.value = "";
    this.dom.searchInput.blur();
    this.dom.searchResults.classList.remove("has-results");
    this.dom.searchResults.innerHTML = "";
    this.state.search.results = [];
    this.state.search.activeIndex = -1;
  },

  moveSearchSelection(direction) {
    const results = this.state.search.results;
    if (!results.length) return;

    const nextIndex = this.state.search.activeIndex + direction;
    if (nextIndex < 0) {
      this.state.search.activeIndex = results.length - 1;
    } else if (nextIndex >= results.length) {
      this.state.search.activeIndex = 0;
    } else {
      this.state.search.activeIndex = nextIndex;
    }

    this.updateSearchSelection();
  },

  updateSearchSelection() {
    if (!this.dom.searchResults) return;
    const cards = this.dom.searchResults.querySelectorAll(
      "[data-search-index]"
    );
    cards.forEach((card, index) => {
      const isActive = index === this.state.search.activeIndex;
      card.classList.toggle("is-active", isActive);
      if (isActive) {
        card.scrollIntoView({ block: "nearest" });
      }
    });
  },

  openSearchResultByIndex(index) {
    const item = this.state.search.results[index];
    if (!item) return;
    this.closeSearch();
    this.navigate("setup", {
      quizId: item.quizId,
    });
  },

  setRefreshButtonLoading(isLoading) {
    if (!this.dom.refreshBtn) return;
    this.dom.refreshBtn.disabled = isLoading;
    this.dom.refreshBtn.classList.toggle("is-loading", isLoading);
  },

  resetLoadingView() {
    if (this.dom.loadingView && this.defaultLoadingViewHtml) {
      this.dom.loadingView.innerHTML = this.defaultLoadingViewHtml;
    }
  },

  showLoadingView() {
    this.resetLoadingView();
    this.showOnly("loading-view");
  },

  clearLocalCaches() {
    this.state.levelList = [];
    this.state.levelIdByName = {};
    this.state.areaList = [];
    this.state.areasByLevel = {};
    this.state.modulesByArea = {};
    this.state.subtopicProgressByArea = {};
    this.state.quizzesByModule = {};
    this.state.quizMap = {};
    this.state.quizDetailsById = {};
    this.state.questionsByQuizId = {};
    this.state.attempts = [];
    this.state.attemptsSignature = "";
    this.state.attemptsByQuizId = {};
    this.state.userStats = null;
    this.state.activeQuestions = [];
    this.state.accountSummary = null;
    this.state.quizAttemptSummariesById = {};
    this.state.moduleTypeCountsByModule = {};
    this.state.search.indexLoaded = false;
    this.state.search.results = [];
    this.state.search.activeIndex = -1;
    this.clearPersistedAppDataCache();
  },

  async hardRefreshFromDatabase() {
    if (this.state.refreshInFlight) return;
    await this.loadAccessStatus();
    if (!this.hasActiveAccess()) {
      this.clearLocalCaches();
      this.renderAccessGate();
      return;
    }
    this.clearLocalCaches();
    this.showLoadingView();
    await this.refreshDatabase({
      silent: true,
      forceToast: true,
      includePersonalization: true,
    });
    await this.router();
  },

  async loadDatabase({ showLoading = true, rerenderOnComplete = false } = {}) {
    await this.loadAccessStatus();
    if (!this.hasActiveAccess()) {
      this.clearLocalCaches();
      this.renderAccessGate();
      return;
    }

    if (!showLoading) {
      await this.refreshDatabase({
        silent: !rerenderOnComplete,
        forceToast: false,
        includePersonalization: true,
      });
      return;
    }

    this.showLoadingView();
    await Promise.all([this.loadAreaCatalog(), this.loadPersonalizationData()]);
    await this.router();
  },

  withTimeout(promise, ms, label = "Request") {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(new Error(`${label} timed out after ${ms / 1000} seconds.`)),
          ms
        );
      }),
    ]);
  },

  extractLeadingNumber(value) {
    const text = String(value ?? "").trim();
    const match = text.match(/^(\d+)/);
    return match ? Number(match[1]) : null;
  },

  compareDisplayOrder(a, b) {
    const aText = String(a ?? "").trim();
    const bText = String(b ?? "").trim();
    const aNum = this.extractLeadingNumber(aText);
    const bNum = this.extractLeadingNumber(bText);

    if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
    if (aNum !== null && bNum === null) return -1;
    if (aNum === null && bNum !== null) return 1;

    return aText.localeCompare(bText, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  },

  encodeRoutePart(value) {
    return encodeURIComponent(String(value ?? "").trim());
  },

  decodeRoutePart(value) {
    return decodeURIComponent(String(value ?? ""));
  },

  buildPath(view, params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== undefined && value !== null && value !== ""
      )
    );
    const query = new URLSearchParams(cleanParams);

    switch (view) {
      case "home":
        return "/home/";
      case "modules":
        return `/modules/?${new URLSearchParams({
          level: cleanParams.level || "",
          area: cleanParams.area || "",
        }).toString()}`;
      case "subtopics":
        return `/subtopics/?${new URLSearchParams({
          level: cleanParams.level || "",
          area: cleanParams.area || "",
        }).toString()}`;
      case "types":
        return `/types/?${new URLSearchParams({
          level: cleanParams.level || "",
          area: cleanParams.area || "",
          sub: cleanParams.sub || "",
        }).toString()}`;
      case "quizzes":
        return `/quizzes/?${new URLSearchParams({
          level: cleanParams.level || "",
          area: cleanParams.area || "",
          sub: cleanParams.sub || "",
          type: cleanParams.type || "",
        }).toString()}`;
      case "setup": {
        const quizId =
          cleanParams.quizId || this.getQuizIdForRouteParams(cleanParams);
        return quizId
          ? `/setup/?${new URLSearchParams({ quizId }).toString()}`
          : "/home/";
      }
      case "quiz": {
        const quizId =
          cleanParams.quizId || this.getQuizIdForRouteParams(cleanParams);
        return quizId
          ? `/quiz/?${new URLSearchParams({
              quizId,
              mode: cleanParams.mode || "study",
              duration:
                cleanParams.mode === "exam" && cleanParams.duration
                  ? cleanParams.duration
                  : "",
            }).toString()}`
          : "/home/";
      }
      case "results": {
        const quizId =
          cleanParams.quizId || this.getQuizIdForRouteParams(cleanParams);
        return quizId
          ? `/results/?${new URLSearchParams({
              quizId,
              mode: cleanParams.mode || "study",
              duration:
                cleanParams.mode === "exam" && cleanParams.duration
                  ? cleanParams.duration
                  : "",
            }).toString()}`
          : "/home/";
      }
      case "account":
        return "/account/";
      case "settings":
        return "/settings/";
      default:
        return query.toString()
          ? `/home/?${query.toString()}`
          : "/home/";
    }
  },

  reloadHomeRoute() {
    const homePath = this.buildPath("home");
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === homePath) {
      window.location.reload();
      return;
    }
    window.location.assign(homePath);
  },

  getQuizIdForRouteParams(params = {}) {
    const level = params.level || this.state.currentLevel;
    const area = params.area || this.state.currentArea;
    const sub = params.sub || this.state.currentSub;
    const type = params.type || this.state.currentType;
    const title = params.title || this.state.currentQuizTitle;
    return (
      this.state.quizMap[this.buildQuizKey(level, area, sub, type, title)]
        ?.id ||
      this.state.currentQuizId ||
      ""
    );
  },

  async navigate(view, params = {}, options = {}) {
    const path = this.buildPath(view, params);
    if (!path) return;

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === path) {
      await this.router();
      return;
    }

    if (options.replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }

    await this.router();
  },

  async router() {
    if (this.state.currentUser && !this.hasActiveAccess()) {
      this.renderAccessGate();
      return;
    }

    this.stopQuizCountdown?.();

    const segments = window.location.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    const [root = "home"] = segments;
    const params = new URLSearchParams(window.location.search);

    this.state.currentLevel = "";
    this.state.currentArea = "";
    this.state.currentSub = "";
    this.state.currentType = "";
    this.state.currentQuizTitle = "";
    this.state.currentQuizId = "";
    this.state.mode = "study";
    this.state.currentExamDurationMinutes = null;
    this.state.quizTimeRemainingSeconds = null;
    this.state.reviewWrongOnly = false;

    let view = "home";

    if (
      !segments.length ||
      root === "home" ||
      root === "dashboard" ||
      root === "app.html"
    ) {
      view = "home";
    } else if (root === "modules") {
      view = "modules";
      this.state.currentLevel = params.get("level") || "";
      this.state.currentArea = params.get("area") || "";
    } else if (root === "subtopics") {
      view = "subtopics";
      this.state.currentLevel = params.get("level") || "";
      this.state.currentArea = params.get("area") || "";
    } else if (root === "types") {
      view = "types";
      this.state.currentLevel = params.get("level") || "";
      this.state.currentArea = params.get("area") || "";
      this.state.currentSub = params.get("sub") || "";
    } else if (root === "quizzes") {
      view = "quizzes";
      this.state.currentLevel = params.get("level") || "";
      this.state.currentArea = params.get("area") || "";
      this.state.currentSub = params.get("sub") || "";
      this.state.currentType = params.get("type") || "";
    } else if (root === "setup") {
      view = "setup";
      this.state.currentQuizId = params.get("quizId") || "";
    } else if (root === "quiz") {
      view = "quiz";
      this.state.currentQuizId = params.get("quizId") || "";
      this.state.mode = params.get("mode") || "study";
      this.state.currentExamDurationMinutes =
        this.state.mode === "exam"
          ? this.normalizeExamDurationMinutes(params.get("duration"))
          : null;
    } else if (root === "results") {
      view = "results";
      this.state.currentQuizId = params.get("quizId") || "";
      this.state.mode = params.get("mode") || "study";
      this.state.currentExamDurationMinutes =
        this.state.mode === "exam"
          ? this.normalizeExamDurationMinutes(params.get("duration"))
          : null;
    } else if (root === "account") {
      view = "account";
    } else if (root === "settings") {
      view = "settings";
    }

    this.syncPageState(view);

    if (
      ["setup", "quiz", "results"].includes(view) &&
      this.state.currentQuizId
    ) {
      const found = await this.ensureQuizContextFromId(
        this.state.currentQuizId
      );
      if (!found) {
        await this.navigate("home", {}, { replace: true });
        return;
      }
    }

    switch (view) {
      case "account":
        await this.renderAccountView();
        break;
      case "settings":
        await this.renderSettingsView();
        break;
      case "modules":
        await this.renderModules();
        break;
      case "subtopics":
        await this.renderSubtopics();
        break;
      case "types":
        await this.renderTypes();
        break;
      case "quizzes":
        await this.renderQuizList();
        break;
      case "setup":
        await this.renderSetup();
        break;
      case "quiz":
        await this.renderQuiz();
        break;
      case "results":
        this.renderResults();
        break;
      case "home":
      default:
        await this.renderDashboard();
        break;
    }

    this.renderMenuSheetContext();
    window.scrollTo(0, 0);
  },

  showOnly(idToShow) {
    if (idToShow !== "settings-view") {
      this.stopSettingsCountdown();
    }

    document.querySelectorAll(".view, #loading-view").forEach((el) => {
      el.hidden = true;
    });

    const target = document.getElementById(idToShow);
    if (target) target.hidden = false;
  },

  renderAccessGate(statusOverride = null) {
    this.syncPageState("access");
    const access = statusOverride || this.state.accessStatus || {};
    const status = String(access.status || "no_access");
    const expiresAt = access.accessExpiresAt
      ? this.formatDateTime(access.accessExpiresAt)
      : "";
    const reason = String(access.blockReason || "").trim();
    const email = String(this.state.currentUser?.email || "").trim();

    const copyByStatus = {
      active: {
        badge: "Access Active",
        badgeTone: "success",
        title: "Access Available",
        message:
          "Your subscription is active and your account can use the medical bank.",
        identityStatus: "Subscription Active",
        identityTone: "success",
      },
      expired: {
        badge: "Access Expired",
        badgeTone: "warning",
        title: "Access Restricted",
        message:
          "Your subscription period has ended. Renew the account, then use Check Access Again.",
        identityStatus: "Account Verified",
        identityTone: "success",
      },
      blocked: {
        badge: "Access Blocked",
        badgeTone: "danger",
        title: "This account has been restricted.",
        message:
          "An administrator has blocked this account. Contact support to restore access.",
        identityStatus: "Account Verified",
        identityTone: "success",
      },
      no_access: {
        badge: "Pending Activation",
        badgeTone: "warning",
        title: "Access Restricted",
        message:
          "The account has no active subscription",
        identityStatus: "Email Verified",
        identityTone: "success",
      },
      signed_out: {
        badge: "Signed Out",
        badgeTone: "neutral",
        title: "Session Required",
        message: "Sign in again to continue.",
        identityStatus: "Session Needed",
        identityTone: "neutral",
      },
    };

    const copy = copyByStatus[status] || copyByStatus.no_access;
    this.showOnly("access-view");

    if (this.dom.accessStatusBadge) {
      const iconMarkup =
        copy.badgeTone === "success"
          ? `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 12 2 2 4-4"></path>
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"></path>
          </svg>
        `
          : copy.badgeTone === "danger"
            ? `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 9v4"></path>
              <path d="M12 17h.01"></path>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            </svg>
          `
            : copy.badgeTone === "neutral"
              ? `
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 8v4"></path>
                <path d="M12 16h.01"></path>
                <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"></path>
              </svg>
            `
              : `
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              </svg>
            `;
      this.dom.accessStatusBadge.innerHTML = `${iconMarkup}<span>${this.escapeHtml(copy.badge)}</span>`;
      this.dom.accessStatusBadge.className = `access-status-badge is-${copy.badgeTone}`;
    }

    if (this.dom.accessTitle) {
      this.dom.accessTitle.textContent = copy.title;
    }

    if (this.dom.accessMessage) {
      this.dom.accessMessage.textContent = copy.message;
    }

    if (this.dom.accessEmailValue) {
      this.dom.accessEmailValue.textContent = email || "No email available";
    }

    if (this.dom.accessIdentityStatus) {
      this.dom.accessIdentityStatus.className = `access-identity-status is-${copy.identityTone}`;
    }

    if (this.dom.accessIdentityStatusText) {
      this.dom.accessIdentityStatusText.textContent = copy.identityStatus;
    }

    if (this.dom.accessMeta) {
      const chips = [];
      if (expiresAt) {
        chips.push(
          `<span class="access-meta-chip">Expires: ${this.escapeHtml(expiresAt)}</span>`
        );
      }
      if (reason) {
        chips.push(
          `<span class="access-meta-chip">Reason: ${this.escapeHtml(reason)}</span>`
        );
      }
      this.dom.accessMeta.innerHTML = chips.join("");
      this.dom.accessMeta.hidden = !chips.length;
    }
  },
};
