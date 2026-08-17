//#region public/src/core/supabase.js
var e = "https://frlujqujvpqwvtavofdq.supabase.co", t = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybHVqcXVqdnBxd3Z0YXZvZmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ2MjgsImV4cCI6MjA4ODg0MDYyOH0.doxi3B9llGw9_z90A23AZDucStRSVvCaxWXXqeJKHXE", n = "bitramed:theme-preference", r = "(prefers-color-scheme: dark)";
function i() {
	let n = String(e).trim(), r = String(t).trim();
	if (!window.supabase || typeof window.supabase.createClient != "function") throw Error("Library did not load.");
	return window.supabase.createClient(n, r);
}
function a(e) {
	return e === "dark" ? "dark" : "light";
}
function o() {
	try {
		if (window.matchMedia && window.matchMedia(r).matches) return "dark";
	} catch (e) {
		console.error("System theme preference read failed:", e);
	}
	return "light";
}
function s() {
	try {
		let e = window.localStorage.getItem(n);
		return e === "dark" || e === "light";
	} catch (e) {
		return console.error("Theme preference availability check failed:", e), !1;
	}
}
function c() {
	try {
		let e = window.localStorage.getItem(n);
		if (e === "dark" || e === "light") return e;
	} catch (e) {
		console.error("Theme preference read failed:", e);
	}
	return o();
}
function l(e) {
	let t = a(e);
	try {
		window.localStorage.setItem(n, t);
	} catch (e) {
		console.error("Theme preference write failed:", e);
	}
	return t;
}
function u(e) {
	let t = a(e);
	return document.documentElement.classList.toggle("dark-mode", t === "dark"), document.body && document.body.classList.toggle("dark-mode", t === "dark"), document.documentElement.style.colorScheme = t, t;
}
function d() {
	let e = () => {
		u(c());
	}, t = () => {
		s() || u(o());
	};
	document.body ? e() : document.addEventListener("DOMContentLoaded", e, { once: !0 });
	try {
		if (window.matchMedia) {
			let e = window.matchMedia(r);
			typeof e.addEventListener == "function" ? e.addEventListener("change", t) : typeof e.addListener == "function" && e.addListener(t);
		}
	} catch (e) {
		console.error("System theme preference watch failed:", e);
	}
}
d();
//#endregion
//#region public/src/services/preferences-service.js
async function f(e, t) {
	if (!t) return null;
	let { data: n, error: r } = await e.from("user_preferences").select("theme").eq("user_id", t).maybeSingle();
	if (r) throw r;
	return n?.theme ?? null;
}
async function p(e, t, n) {
	if (!t) return;
	let { error: r } = await e.from("user_preferences").upsert({
		user_id: t,
		theme: n
	}, { onConflict: "user_id" });
	if (r) throw r;
}
//#endregion
//#region public/src/apps/learner-core.js
var m = {
	menuOpenFrame: null,
	menuCloseTimer: null,
	quizCountdownInterval: null,
	quizCountdownDeadline: 0,
	quizSubmissionInFlight: !1,
	routeNavigationInFlight: !1,
	routeTransitionDurationMs: 210,
	routeLoadingDelayMs: 160,
	routeTransitionSequence: 0,
	routeTransitionPromise: Promise.resolve(),
	pendingLoadingTimer: null,
	pendingLoadingResolve: null,
	appDataCacheWriteTimer: null,
	restoringAppDataCache: !1,
	accessStatusLoadPromise: null,
	homeBootstrapLoadPromise: null,
	homeBootstrapUnavailable: !1,
	homeBootstrapLoadedThisPage: !1,
	shellBootstrapLoadPromise: null,
	routeDataLoadPromises: null,
	routeDataGeneration: 0,
	assessmentProgressCache: null,
	assessmentProgressLoadPromises: null,
	assessmentProgressPendingWrites: null,
	assessmentSettingsById: null,
	appDataCacheVersion: 3,
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
		pastPaperAttempts: [],
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
		negativeMarking: !1,
		quizTimeRemainingSeconds: null,
		activeQuestions: [],
		reviewWrongOnly: !1,
		currentResultsSnapshot: null,
		refreshInFlight: !1,
		supabaseClient: null,
		currentUser: null,
		accessStatus: null,
		themePreference: "light",
		routeData: {
			yearByLevel: {},
			coursesByLevel: {},
			subtopicsByCourse: {},
			typesBySubtopic: {},
			quizzesByType: {},
			accountByKey: {},
			searchByQuery: {}
		},
		homeDashboard: {
			loaded: !1,
			generatedAt: "",
			stats: null,
			levelProgressByName: {}
		},
		search: {
			indexLoaded: !1,
			results: [],
			activeIndex: -1,
			pagesByQuery: {},
			requestSequence: 0
		},
		pastPapers: {
			years: [],
			yearsLoaded: !1,
			topicsByYear: {},
			examsByTopic: {},
			unitsBySetId: {},
			reviewsByAttemptId: {},
			currentYear: "",
			currentTopic: "",
			currentSetId: "",
			currentAttemptId: "",
			durationMinutes: null,
			negativeMarking: !1,
			timeRemainingSeconds: null,
			activeUnits: [],
			activeExam: null
		},
		topbar: {
			menuOpen: !1,
			searchOpen: !1
		}
	},
	async init() {
		try {
			this.cacheDom(), this.initSupabaseClient(), this.applyThemePreference(this.getThemePreference()), await this.requireSessionOrRedirect(), this.bindTopbarEngine(), this.startMenuSessionClock(), this.bindAppEvents(), this.bindRoutePressFeedback(), window.addEventListener("popstate", () => {
				this.router();
			}), window.addEventListener("pageshow", (e) => {
				e.persisted && (this.clearLocalCaches(), this.loadDatabase().catch((e) => {
					this.handleInitError(e);
				}));
			});
			let e = this.restoreAppDataCache();
			await this.loadDatabase({
				showLoading: !e,
				routeOnComplete: !1
			}), await this.router();
		} catch (e) {
			await this.handleInitError(e);
		}
	},
	async handleInitError(e) {
		if (console.error("App init failed:", e), String(e?.message || "") !== "No active session.") {
			if (this.isAuthSessionError(e)) {
				this.clearPersistedAppDataCache();
				try {
					await this.getSupabase().auth.signOut({ scope: "local" });
				} catch {}
				let e = `${window.location.pathname}${window.location.search}`;
				window.location.replace(`/?next=${encodeURIComponent(e)}`);
				return;
			}
			await this.handleAccessRestriction(e) || this.showFatalLoadError(e?.message || "App initialization failed.");
		}
	},
	getPageStateForView(e) {
		let t = e === "home" ? "home" : e;
		return {
			bodyPage: t === "past-paper-review" ? "results" : t,
			title: {
				home: "Bitramed Home",
				year: "Bitramed Year",
				modules: "Bitramed Modules",
				subtopics: "Bitramed Subtopics",
				types: "Bitramed Question Types",
				quizzes: "Bitramed Quizzes",
				quiz: "Bitramed Quiz",
				results: "Bitramed Results",
				"past-paper-topics": "Bitramed Past Papers",
				"past-paper-exams": "Bitramed Past Paper Exams",
				"past-paper-session": "Bitramed Past Paper",
				"past-paper-review": "Bitramed Past Paper Result",
				account: "Bitramed Account",
				settings: "Bitramed Settings",
				access: "Bitramed Access"
			}[t] || "Bitramed"
		};
	},
	syncPageState(e) {
		let t = this.getPageStateForView(e);
		document.body && (document.body.dataset.appPage = t.bodyPage), document.title = t.title;
	},
	getAppDataCacheKey() {
		let e = String(this.state.currentUser?.id || "").trim();
		return e ? `bitramed:learner-cache:${e}` : "";
	},
	clearPersistedAppDataCache() {
		this.appDataCacheWriteTimer && (window.clearTimeout(this.appDataCacheWriteTimer), this.appDataCacheWriteTimer = null);
		let e = this.getAppDataCacheKey();
		if (e) try {
			window.sessionStorage.removeItem(e);
		} catch (e) {
			console.error("Learner cache clear failed:", e);
		}
	},
	scheduleAppDataCacheWrite() {
		this.restoringAppDataCache || !this.state.currentUser || (this.appDataCacheWriteTimer && window.clearTimeout(this.appDataCacheWriteTimer), this.appDataCacheWriteTimer = window.setTimeout(() => {
			this.appDataCacheWriteTimer = null, this.persistAppDataCache();
		}, 500));
	},
	persistAppDataCache() {
		let e = this.getAppDataCacheKey();
		if (!e) return;
		let t = {
			version: this.appDataCacheVersion,
			savedAt: Date.now(),
			levelList: this.state.levelList,
			levelIdByName: this.state.levelIdByName,
			homeDashboard: this.state.homeDashboard,
			pastPaperYears: this.state.pastPapers?.years || []
		};
		try {
			window.sessionStorage.setItem(e, JSON.stringify(t));
		} catch (e) {
			console.error("Learner cache write failed:", e);
		}
	},
	restoreAppDataCache() {
		let e = this.getAppDataCacheKey();
		if (!e) return !1;
		try {
			let t = window.sessionStorage.getItem(e);
			if (!t) return !1;
			let n = JSON.parse(t), r = Number(n?.savedAt || 0), i = Date.now() - r < 1e3 * 60 * 10, a = n?.version === this.appDataCacheVersion;
			return !i || !a ? (window.sessionStorage.removeItem(e), !1) : (this.restoringAppDataCache = !0, this.state.accessStatus = null, this.state.levelList = Array.isArray(n?.levelList) ? n.levelList : [], this.state.levelIdByName = n?.levelIdByName && typeof n.levelIdByName == "object" ? n.levelIdByName : {}, this.state.homeDashboard = n?.homeDashboard && typeof n.homeDashboard == "object" ? {
				...this.state.homeDashboard,
				...n.homeDashboard,
				levelProgressByName: n.homeDashboard.levelProgressByName || {}
			} : this.state.homeDashboard, this.state.pastPapers.years = Array.isArray(n?.pastPaperYears) ? n.pastPaperYears : [], this.state.pastPapers.yearsLoaded = Array.isArray(n?.pastPaperYears), this.restoringAppDataCache = !1, !!this.state.homeDashboard?.loaded || !!this.state.levelList.length);
		} catch (e) {
			return this.restoringAppDataCache = !1, console.error("Learner cache restore failed:", e), this.clearPersistedAppDataCache(), !1;
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
			dashboardOverallRingValue: document.getElementById("dashboard-overall-ring-value"),
			dashboardActiveYears: document.getElementById("dashboard-active-years"),
			dashboardCompletedCount: document.getElementById("dashboard-completed-count"),
			dashboardAverageScore: document.getElementById("dashboard-average-score"),
			accessOverallRing: document.getElementById("access-overall-ring"),
			accessOverallRingValue: document.getElementById("access-overall-ring-value"),
			accessOverallLabel: document.getElementById("access-overall-label"),
			accessActiveYears: document.getElementById("access-active-years"),
			accessCompletedCount: document.getElementById("access-completed-count"),
			accessAverageScore: document.getElementById("access-average-score"),
			accessSectionCount: document.getElementById("access-section-count"),
			accessYearGrid: document.getElementById("access-year-grid"),
			areaGrid: document.getElementById("area-grid"),
			yearOptionGrid: document.getElementById("year-option-grid"),
			moduleGrid: document.getElementById("module-grid"),
			subtopicsGrid: document.getElementById("subtopics-grid"),
			pastPaperTopicsGrid: document.getElementById("past-paper-topics-grid"),
			pastPaperExamsGrid: document.getElementById("past-paper-exams-grid"),
			pastPaperForm: document.getElementById("past-paper-form"),
			pastPaperSubmitBtn: document.getElementById("btn-submit-past-paper"),
			pastPaperReviewList: document.getElementById("past-paper-review-list"),
			typesPageKicker: document.getElementById("types-page-kicker"),
			typesTotalQuestions: document.getElementById("types-total-questions"),
			typesFormatCount: document.getElementById("types-format-count"),
			typesCompletePercent: document.getElementById("types-complete-percent"),
			quizListView: document.getElementById("quiz-list-view"),
			quizListKicker: document.getElementById("quiz-list-kicker"),
			quizListSubtitle: document.getElementById("quiz-list-subtitle"),
			quizListAssessmentCount: document.getElementById("quiz-list-assessment-count"),
			quizListCompletedCount: document.getElementById("quiz-list-completed-count"),
			quizListAverageScore: document.getElementById("quiz-list-average-score"),
			quizListModeBadge: document.getElementById("quiz-list-mode-badge"),
			quizListModeDescription: document.getElementById("quiz-list-mode-description"),
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
			resultsUnansweredSegment: document.getElementById("results-unanswered-segment"),
			resultsPageKicker: document.getElementById("results-page-kicker"),
			resultsTypeBadge: document.getElementById("results-type-badge"),
			resultsPageTitle: document.getElementById("results-page-title"),
			resultsPageMeta: document.getElementById("results-page-meta"),
			resultsModeLabel: document.getElementById("results-mode-label"),
			resultsSummaryHeadline: document.getElementById("results-summary-headline"),
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
			settingsAccessStatusValue: document.getElementById("settings-access-status-value"),
			settingsExpiryValue: document.getElementById("settings-expiry-value"),
			settingsDaysLeftValue: document.getElementById("settings-days-left-value"),
			settingsAccessMeta: document.getElementById("settings-access-meta"),
			settingsEmailValue: document.getElementById("settings-email-value"),
			settingsStatusChip: document.getElementById("settings-status-chip"),
			settingsExpiryDetailValue: document.getElementById("settings-expiry-detail-value"),
			settingsTimeLeftDetailValue: document.getElementById("settings-time-left-detail-value"),
			settingsReasonRow: document.getElementById("settings-reason-row"),
			settingsReasonValue: document.getElementById("settings-reason-value"),
			themeModeToggle: document.getElementById("theme-mode-toggle"),
			settingsThemeNote: document.getElementById("settings-theme-note"),
			settingsSignoutBtn: document.getElementById("settings-signout-btn"),
			settingsResetAccountBtn: document.getElementById("settings-reset-account-btn"),
			accessView: document.getElementById("access-view"),
			accessStatusBadge: document.getElementById("access-status-badge"),
			accessTitle: document.getElementById("access-title"),
			accessMessage: document.getElementById("access-message"),
			accessMeta: document.getElementById("access-meta"),
			accessEmailValue: document.getElementById("access-email-value"),
			accessIdentityStatus: document.getElementById("access-identity-status"),
			accessIdentityStatusText: document.getElementById("access-identity-status-text")
		}, this.defaultLoadingViewHtml = this.dom.loadingView?.innerHTML || "";
	},
	initSupabaseClient() {
		this.state.supabaseClient = i();
	},
	getSupabase() {
		if (!this.state.supabaseClient) throw Error("Supabase client is not initialized.");
		return this.state.supabaseClient;
	},
	isAuthSessionError(e) {
		let t = String(e?.code || "").trim().toUpperCase(), n = String(e?.message || "").toLowerCase();
		return ["PGRST301", "28000"].includes(t) || [
			"authentication is required",
			"auth session missing",
			"jwt expired",
			"invalid jwt",
			"refresh token",
			"session expired"
		].some((e) => n.includes(e));
	},
	async requireSessionOrRedirect() {
		let e = this.getSupabase().auth, { data: t, error: n } = typeof e.getSession == "function" ? await e.getSession() : await e.getUser();
		if (n && !this.isAuthSessionError(n)) throw n;
		let r = t?.session?.user || t?.user || null;
		if (!r) {
			let e = `${window.location.pathname}${window.location.search}`;
			throw window.location.replace(`/?next=${encodeURIComponent(e)}`), Error("No active session.");
		}
		this.state.currentUser = r, this.renderTopbarUser();
	},
	async loadAccessStatus() {
		if (this.accessStatusLoadPromise) return this.accessStatusLoadPromise;
		let e = (async () => {
			let { data: e, error: t } = await this.withTimeout(this.getSupabase().rpc("app_my_access_status"), 12e3, "Checking account access");
			if (t) {
				if (this.isAuthSessionError(t)) return this.state.accessStatus = {
					status: "signed_out",
					hasAccess: !1,
					blockReason: "",
					accessExpiresAt: null
				}, this.state.accessStatus;
				throw t;
			}
			return this.state.accessStatus = e || {
				status: "no_access",
				hasAccess: !1
			}, this.state.accessStatus;
		})();
		this.accessStatusLoadPromise = e;
		try {
			return await e;
		} finally {
			this.accessStatusLoadPromise === e && (this.accessStatusLoadPromise = null);
		}
	},
	hasActiveAccess() {
		return !!this.state.accessStatus?.hasAccess;
	},
	isAccessRestrictionError(e) {
		let t = String(e?.message || "").toLowerCase();
		return [
			"does not currently have app access",
			"has been blocked",
			"access period has expired",
			"renew your subscription"
		].some((e) => t.includes(e));
	},
	inferAccessStatusFromError(e) {
		let t = String(e?.message || "").toLowerCase();
		return this.isAuthSessionError(e) ? {
			status: "signed_out",
			hasAccess: !1,
			blockReason: "",
			accessExpiresAt: null
		} : t.includes("blocked") ? {
			status: "blocked",
			hasAccess: !1,
			blockReason: "",
			accessExpiresAt: null
		} : t.includes("expired") || t.includes("renew") ? {
			status: "expired",
			hasAccess: !1,
			blockReason: "",
			accessExpiresAt: null
		} : {
			status: "no_access",
			hasAccess: !1,
			blockReason: "",
			accessExpiresAt: null
		};
	},
	async handleAccessRestriction(e) {
		if (this.isAuthSessionError(e)) return this.state.accessStatus = this.inferAccessStatusFromError(e), this.renderAccessGate(), !0;
		if (!this.isAccessRestrictionError(e)) return !1;
		try {
			await this.loadAccessStatus();
		} catch (t) {
			console.error("Access status refresh failed:", t), this.state.accessStatus = this.inferAccessStatusFromError(e);
		}
		return this.renderAccessGate(), !0;
	},
	getDisplayNameForUser(e) {
		let t = String(e?.user_metadata?.display_name || "").trim();
		if (t) return t;
		let n = String(e?.user_metadata?.full_name || "").trim();
		if (n) return n;
		let r = String(e?.email || "").trim();
		return r.includes("@") ? r.split("@")[0] : "Account";
	},
	renderTopbarUser() {
		let e = this.getDisplayNameForUser(this.state.currentUser), t = e.split(/\s+/).filter(Boolean).slice(0, 2).map((e) => e.charAt(0).toUpperCase()).join("") || "B";
		this.dom.topbarUserAvatar && (this.dom.topbarUserAvatar.textContent = t), this.dom.topbarUserName && (this.dom.topbarUserName.textContent = e), this.dom.menuSheetAvatar && (this.dom.menuSheetAvatar.textContent = t), this.dom.menuSheetName && (this.dom.menuSheetName.textContent = e), this.renderMenuSheetContext(), this.dom.topbarUserPill && (this.dom.topbarUserPill.hidden = !1, this.dom.topbarUserPill.title = e, this.dom.topbarUserPill.setAttribute("aria-label", `Open account stats for ${e}`));
	},
	getMenuRoleLabel() {
		let e = String(this.state.currentLevel || "").trim();
		return e ? `${e} - Medical Student` : "Bitramed Learner";
	},
	formatMenuSessionTime(e = /* @__PURE__ */ new Date()) {
		return new Intl.DateTimeFormat(void 0, {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: !1
		}).format(e);
	},
	pulseMenuSessionDot() {
		this.dom.menuSessionDot && (this.dom.menuSessionDot.classList.remove("is-pulsing"), this.dom.menuSessionDot.offsetWidth, this.dom.menuSessionDot.classList.add("is-pulsing"));
	},
	updateMenuSessionClock({ pulse: e = !1 } = {}) {
		this.dom.menuSessionTime && (this.dom.menuSessionTime.textContent = this.formatMenuSessionTime(/* @__PURE__ */ new Date())), e && this.pulseMenuSessionDot();
	},
	stopMenuSessionClock() {
		this.menuSessionClockTimeout && (window.clearTimeout(this.menuSessionClockTimeout), this.menuSessionClockTimeout = null), this.menuSessionClockInterval && (window.clearInterval(this.menuSessionClockInterval), this.menuSessionClockInterval = null);
	},
	startMenuSessionClock() {
		this.stopMenuSessionClock(), this.updateMenuSessionClock();
		let e = 1e3 - Date.now() % 1e3;
		this.menuSessionClockTimeout = window.setTimeout(() => {
			this.updateMenuSessionClock({ pulse: !0 }), this.menuSessionClockInterval = window.setInterval(() => {
				this.updateMenuSessionClock({ pulse: !0 });
			}, 1e3);
		}, e);
	},
	stopSettingsCountdown() {
		this.settingsCountdownTimeout && (window.clearTimeout(this.settingsCountdownTimeout), this.settingsCountdownTimeout = null), this.settingsCountdownInterval && (window.clearInterval(this.settingsCountdownInterval), this.settingsCountdownInterval = null);
	},
	formatCountdownUnit(e, t) {
		let n = Math.max(0, Number(e || 0));
		return `${n} ${t}${n === 1 ? "" : "s"}`;
	},
	formatAccessCountdownShort(e = {}) {
		return `${Math.max(0, Number(e.days || 0))}d ${String(Math.max(0, Number(e.hours || 0))).padStart(2, "0")}h ${String(Math.max(0, Number(e.minutes || 0))).padStart(2, "0")}m ${String(Math.max(0, Number(e.seconds || 0))).padStart(2, "0")}s`;
	},
	formatAccessCountdownLong(e = {}, t = "", n = "remaining.") {
		return [t, `${[
			this.formatCountdownUnit(e.days, "day"),
			this.formatCountdownUnit(e.hours, "hour"),
			this.formatCountdownUnit(e.minutes, "minute"),
			this.formatCountdownUnit(e.seconds, "second")
		].join(", ")} ${n}`].filter(Boolean).join(" ").trim();
	},
	renderSettingsCountdown(e = this.state.accessStatus) {
		let t = this.getAccessCountdown(e), n = String(t.status || e?.status || "no_access");
		return this.dom.settingsDaysLeftValue && (this.dom.settingsDaysLeftValue.textContent = t.shortLabel, this.dom.settingsDaysLeftValue.classList.remove("good", "fail"), this.dom.settingsDaysLeftValue.classList.toggle("good", n === "active"), this.dom.settingsDaysLeftValue.classList.toggle("fail", ["blocked", "expired"].includes(n))), this.dom.settingsTimeLeftDetailValue && (this.dom.settingsTimeLeftDetailValue.textContent = t.longLabel), t;
	},
	startSettingsCountdown(e = this.state.accessStatus) {
		this.stopSettingsCountdown();
		let t = this.renderSettingsCountdown(e);
		if (!e?.accessExpiresAt || t.days === null || t.shortLabel === "Expired") return t;
		let n = () => {
			this.renderSettingsCountdown(e).shortLabel === "Expired" && this.stopSettingsCountdown();
		}, r = 1e3 - Date.now() % 1e3;
		return this.settingsCountdownTimeout = window.setTimeout(() => {
			n(), this.settingsCountdownInterval = window.setInterval(n, 1e3);
		}, r), t;
	},
	getMenuSessionLabel() {
		let e = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)[0] || "home";
		return e === "account" ? "Account" : e === "settings" ? "Settings" : this.state.currentQuizTitle ? this.state.currentQuizTitle : this.state.currentSub ? this.state.currentSub : this.state.currentArea ? this.state.currentArea : this.state.currentLevel ? this.state.currentLevel : "Home";
	},
	getMenuCurrentView() {
		let e = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)[0] || "home";
		return e === "account" ? "account" : e === "settings" ? "settings" : "home";
	},
	renderMenuSheetContext() {
		this.dom.menuSheetRole && (this.dom.menuSheetRole.textContent = this.getMenuRoleLabel()), this.dom.menuSessionText && (this.dom.menuSessionText.textContent = this.getMenuSessionLabel()), this.updateMenuSessionClock();
		let e = this.getMenuCurrentView();
		document.querySelectorAll("[data-menu-view]").forEach((t) => {
			let n = t.getAttribute("data-menu-view") === e;
			t.classList.toggle("is-current", n), n ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current");
		});
	},
	getThemePreference() {
		return typeof c == "function" ? c() : "light";
	},
	applyThemePreference(e) {
		let t = typeof u == "function" ? u(e) : e === "dark" ? "dark" : "light";
		return this.state.themePreference = t, t;
	},
	async loadThemePreference() {
		let e = this.getThemePreference();
		this.applyThemePreference(e);
		let t = this.state.currentUser?.id;
		if (!t) return e;
		try {
			let e = await this.withTimeout(f(this.getSupabase(), t), 12e3, "Loading theme preference"), n = typeof a == "function" ? a(e) : e === "dark" ? "dark" : "light";
			return typeof l == "function" && l(n), this.applyThemePreference(n), n;
		} catch (t) {
			return console.error("Theme preference load failed:", t), this.applyThemePreference(e), e;
		}
	},
	async setThemePreference(e) {
		let t = typeof l == "function" ? l(e) : e === "dark" ? "dark" : "light";
		this.applyThemePreference(t);
		let n = this.state.currentUser?.id;
		return n && await this.withTimeout(p(this.getSupabase(), n, t), 12e3, "Saving theme preference"), t;
	},
	renderThemeToggle() {
		let e = this.state.themePreference || this.getThemePreference();
		if (this.dom.themeModeToggle) {
			let t = e === "dark";
			this.dom.themeModeToggle.checked = t, this.dom.themeModeToggle.setAttribute("aria-checked", t ? "true" : "false");
		}
		this.dom.settingsThemeNote && (this.dom.settingsThemeNote.textContent = e === "dark" ? "Dark mode is currently active." : "Light mode is currently active.");
	},
	getAccessCountdown(e = this.state.accessStatus) {
		let t = String(e?.status || "no_access"), n = e?.accessExpiresAt || null;
		if (!n) return {
			status: t,
			days: null,
			hours: null,
			minutes: null,
			seconds: null,
			shortLabel: "Not set",
			longLabel: "No expiry date is available yet."
		};
		let r = new Date(n);
		if (Number.isNaN(r.getTime())) return {
			status: t,
			days: null,
			hours: null,
			minutes: null,
			seconds: null,
			shortLabel: "Unknown",
			longLabel: "Expiry information could not be read."
		};
		let i = r.getTime() - Date.now();
		if (t === "expired" || i <= 0) return {
			status: t === "blocked" ? "blocked" : "expired",
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			shortLabel: "Expired",
			longLabel: t === "blocked" ? "Access is blocked and the subscription has expired." : "Access has expired."
		};
		let a = Math.max(0, Math.floor(i / 1e3)), o = Math.floor(a / 86400), s = Math.floor(a % 86400 / 3600), c = Math.floor(a % 3600 / 60), l = a % 60, u = this.formatAccessCountdownShort({
			days: o,
			hours: s,
			minutes: c,
			seconds: l
		});
		return t === "blocked" ? {
			status: t,
			days: o,
			hours: s,
			minutes: c,
			seconds: l,
			shortLabel: u,
			longLabel: this.formatAccessCountdownLong({
				days: o,
				hours: s,
				minutes: c,
				seconds: l
			}, "Blocked account.", "remaining before expiry.")
		} : {
			status: t,
			days: o,
			hours: s,
			minutes: c,
			seconds: l,
			shortLabel: u,
			longLabel: this.formatAccessCountdownLong({
				days: o,
				hours: s,
				minutes: c,
				seconds: l
			})
		};
	},
	async signOutUser() {
		let { error: e } = await this.getSupabase().auth.signOut();
		if (e) {
			this.showToast("Sign out failed.");
			return;
		}
		this.clearPersistedAppDataCache(), window.location.replace("/");
	},
	openAccessSupport() {
		let e = String(this.state.currentUser?.email || "").trim() || "Unknown", t = String(this.state.accessStatus?.status || "no_access").replace(/_/g, " "), n = String(this.state.accessStatus?.blockReason || "").trim(), r = encodeURIComponent([
			"Hello Bitramed team,",
			"",
			"I need help with my account access.",
			"",
			`Signed in email: ${e}`,
			`Status: ${t}`,
			n ? `Reason: ${n}` : "",
			"",
			"Please assist."
		].filter(Boolean).join("\n"));
		window.location.href = `mailto:bitramed91@gmail.com?subject=Bitramed%20access%20support&body=${r}`;
	},
	async handleTopbarAction(e) {
		switch (e) {
			case "toggle-menu":
				this.state.topbar.searchOpen && this.closeSearch(), this.state.topbar.menuOpen ? this.closeMenu() : this.openMenu();
				break;
			case "close-menu":
				this.closeMenu();
				break;
			case "open-search":
				if (!this.hasActiveAccess()) {
					this.closeMenu(), this.renderAccessGate();
					break;
				}
				this.closeMenu(), this.openSearch();
				break;
			case "close-search":
				this.closeSearch();
				break;
			case "refresh":
				if (this.closeMenu(), !this.hasActiveAccess()) {
					this.renderAccessGate();
					break;
				}
				await this.hardRefreshFromDatabase();
				break;
			case "home":
				if (this.closeAllTopbarUI(), !this.hasActiveAccess()) {
					this.renderAccessGate();
					break;
				}
				this.reloadHomeRoute();
				break;
			case "account":
				if (this.closeAllTopbarUI(), !this.hasActiveAccess()) {
					this.renderAccessGate();
					break;
				}
				await this.navigate("account");
				break;
			case "settings":
				if (this.closeAllTopbarUI(), !this.hasActiveAccess()) {
					this.renderAccessGate();
					break;
				}
				await this.navigate("settings");
				break;
			case "signout":
				this.closeMenu(), await this.signOutUser();
				break;
			default: break;
		}
	},
	bindTopbarAction(e, t) {
		let n = document.getElementById(e);
		n && (n.onclick = async (e) => {
			e.preventDefault(), e.stopPropagation(), await this.handleTopbarAction(t);
		});
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
			["search-close-btn", "close-search"]
		].forEach(([e, t]) => {
			this.bindTopbarAction(e, t);
		}), document.addEventListener("click", (e) => {
			let t = !!e.target.closest("#topbar-menu"), n = !!e.target.closest("#menu-toggle-btn");
			this.state.topbar.menuOpen && !t && !n && this.closeMenu();
		}), document.addEventListener("keydown", (e) => {
			e.key === "Escape" && (this.state.topbar.menuOpen && this.closeMenu(), this.state.topbar.searchOpen && this.closeSearch());
		}), this.dom.searchInput && (this.dom.searchInput.addEventListener("input", () => {
			this.hasActiveAccess() && this.state.topbar.searchOpen && (window.clearTimeout(this.searchRenderTimer), this.searchRenderTimer = window.setTimeout(() => {
				this.searchRenderTimer = null, this.renderSearchResults();
			}, 160));
		}), this.dom.searchInput.addEventListener("keydown", (e) => {
			this.state.topbar.searchOpen && (e.key === "ArrowDown" ? (e.preventDefault(), this.moveSearchSelection(1)) : e.key === "ArrowUp" ? (e.preventDefault(), this.moveSearchSelection(-1)) : e.key === "Enter" && this.state.search.activeIndex >= 0 && (e.preventDefault(), this.openSearchResultByIndex(this.state.search.activeIndex)));
		}));
	},
	bindOptionalClick(e, t) {
		let n = document.getElementById(e);
		n && (n.onclick = t);
	},
	bindRoutePressFeedback() {
		document.addEventListener("click", (e) => {
			let t = e.target.closest?.(".browse-card-button, .selection-card, .quizlist-card");
			!t || t.disabled || t.classList.contains("is-static") || (t.classList.add("is-route-pressed"), window.setTimeout(() => {
				t.classList.remove("is-route-pressed");
			}, 260));
		}, !0);
	},
	bindAppEvents() {
		this.bindOptionalClick("btn-submit", () => this.handleSubmission()), this.dom.quizForm && this.dom.quizForm.addEventListener("submit", (e) => {
			e.preventDefault(), this.handleSubmission();
		}), this.dom.toggleReviewWrongBtn && (this.dom.toggleReviewWrongBtn.onclick = () => {
			this.toggleResultsReviewFilter();
		});
		let e = (e) => {
			e && e.addEventListener("click", (t) => {
				let n = t.target.closest?.(".result-explanation-toggle");
				if (!n || !e.contains(n)) return;
				let r = n.closest(".result-explanation"), i = r?.querySelector(".result-explanation-panel"), a = n.querySelector(".result-explanation-toggle-text");
				if (!r || !i) return;
				let o = r.dataset.open === "true";
				r.dataset.open = o ? "false" : "true", n.setAttribute("aria-expanded", o ? "false" : "true"), i.setAttribute("aria-hidden", o ? "true" : "false"), a && (a.textContent = o ? r.dataset.closedLabel || "VIEW EXPLANATION" : r.dataset.hideLabel || "HIDE");
			});
		};
		e(this.dom.resultsContainer), e(this.dom.pastPaperReviewList), this.bindOptionalClick("btn-retry-results", () => {
			this.clearQuizDraft(), this.navigate("quiz", {
				level: this.state.currentLevel,
				area: this.state.currentArea,
				sub: this.state.currentSub,
				type: this.state.currentType,
				title: this.state.currentQuizTitle,
				mode: this.state.mode,
				duration: this.state.currentExamDurationMinutes || "",
				negativeMarking: this.state.negativeMarking
			});
		}), this.bindOptionalClick("btn-results-back-list", () => {
			this.clearQuizDraft(), this.navigate("quizzes", {
				level: this.state.currentLevel,
				area: this.state.currentArea,
				sub: this.state.currentSub,
				type: this.state.currentType
			});
		}), this.bindOptionalClick("btn-check-access", async () => {
			this.showLoadingView();
			try {
				if (await this.loadAccessStatus(), !this.hasActiveAccess()) {
					this.renderAccessGate();
					return;
				}
				await this.hardRefreshFromDatabase();
			} catch (e) {
				console.error("Access refresh failed:", e), this.renderAccessGate();
			}
		}), this.bindOptionalClick("btn-access-signout", async () => this.signOutUser()), this.bindOptionalClick("btn-contact-support", () => this.openAccessSupport()), this.bindOptionalClick("settings-signout-btn", async () => this.signOutUser()), this.dom.settingsResetAccountBtn && (this.dom.settingsResetAccountBtn.onclick = async () => this.resetAccountData()), this.dom.themeModeToggle && (this.dom.themeModeToggle.onchange = async () => {
			let e = this.dom.themeModeToggle.checked ? "dark" : "light";
			try {
				await this.setThemePreference(e), this.renderThemeToggle(), this.showToast(`${e === "dark" ? "Dark" : "Light"} mode saved.`);
			} catch (e) {
				console.error("Theme preference save failed:", e), this.showToast("Could not save theme preference."), await this.loadThemePreference(), this.renderThemeToggle();
			}
		});
	},
	openMenu() {
		!this.dom.topbarMenu || !this.dom.menuBackdrop || !this.dom.menuToggleBtn || (this.menuCloseTimer && (window.clearTimeout(this.menuCloseTimer), this.menuCloseTimer = null), this.menuOpenFrame && (window.cancelAnimationFrame(this.menuOpenFrame), this.menuOpenFrame = null), this.renderMenuSheetContext(), this.dom.topbarMenu.scrollTop = 0, this.dom.menuSheetBody && (this.dom.menuSheetBody.scrollTop = 0), this.state.topbar.menuOpen = !0, this.dom.topbarMenu.classList.add("is-mounted"), this.dom.menuBackdrop.classList.add("is-visible"), this.dom.menuToggleBtn.classList.add("is-active"), this.dom.menuToggleBtn.setAttribute("aria-expanded", "true"), this.dom.topbarMenu.setAttribute("aria-hidden", "false"), this.menuOpenFrame = window.requestAnimationFrame(() => {
			this.menuOpenFrame = window.requestAnimationFrame(() => {
				this.state.topbar.menuOpen && (this.dom.topbarMenu?.classList.add("is-open"), this.menuOpenFrame = null);
			});
		}));
	},
	closeMenu() {
		!this.dom.topbarMenu || !this.dom.menuBackdrop || !this.dom.menuToggleBtn || (this.menuOpenFrame && (window.cancelAnimationFrame(this.menuOpenFrame), this.menuOpenFrame = null), this.menuCloseTimer && (window.clearTimeout(this.menuCloseTimer), this.menuCloseTimer = null), this.state.topbar.menuOpen = !1, this.dom.topbarMenu.classList.remove("is-open"), this.dom.menuBackdrop.classList.remove("is-visible"), this.dom.menuToggleBtn.classList.remove("is-active"), this.dom.menuToggleBtn.setAttribute("aria-expanded", "false"), this.dom.topbarMenu.setAttribute("aria-hidden", "true"), this.dom.topbarMenu.scrollTop = 0, this.dom.menuSheetBody && (this.dom.menuSheetBody.scrollTop = 0), this.menuCloseTimer = window.setTimeout(() => {
			this.state.topbar.menuOpen || this.dom.topbarMenu?.classList.remove("is-mounted"), this.menuCloseTimer = null;
		}, 340));
	},
	openSearch() {
		!this.dom.searchOverlay || !this.dom.searchBackdrop || !this.dom.searchInput || (this.state.topbar.searchOpen = !0, this.dom.searchOverlay.classList.add("is-open"), this.dom.searchBackdrop.classList.add("is-visible"), this.dom.searchOverlay.setAttribute("aria-hidden", "false"), requestAnimationFrame(() => {
			this.dom.searchInput.focus(), this.renderSearchResults();
		}));
	},
	closeSearch() {
		!this.dom.searchOverlay || !this.dom.searchBackdrop || (this.state.topbar.searchOpen = !1, this.searchRenderTimer && (window.clearTimeout(this.searchRenderTimer), this.searchRenderTimer = null), this.dom.searchOverlay.classList.remove("is-open"), this.dom.searchBackdrop.classList.remove("is-visible"), this.dom.searchOverlay.setAttribute("aria-hidden", "true"), this.clearSearchUI());
	},
	closeAllTopbarUI() {
		this.closeMenu(), this.closeSearch();
	},
	clearSearchUI() {
		!this.dom.searchInput || !this.dom.searchResults || (this.dom.searchInput.value = "", this.dom.searchInput.blur(), this.dom.searchResults.classList.remove("has-results"), this.dom.searchResults.innerHTML = "", this.state.search.results = [], this.state.search.activeIndex = -1);
	},
	moveSearchSelection(e) {
		let t = this.state.search.results;
		if (!t.length) return;
		let n = this.state.search.activeIndex + e;
		n < 0 ? this.state.search.activeIndex = t.length - 1 : n >= t.length ? this.state.search.activeIndex = 0 : this.state.search.activeIndex = n, this.updateSearchSelection();
	},
	updateSearchSelection() {
		this.dom.searchResults && this.dom.searchResults.querySelectorAll("[data-search-index]").forEach((e, t) => {
			let n = t === this.state.search.activeIndex;
			e.classList.toggle("is-active", n), n && e.scrollIntoView({ block: "nearest" });
		});
	},
	async openSearchResultByIndex(e) {
		let t = this.state.search.results[e];
		t && (this.closeSearch(), await this.openQuizSettings(t.quizId));
	},
	setRefreshButtonLoading(e) {
		this.dom.refreshBtn && (this.dom.refreshBtn.disabled = e, this.dom.refreshBtn.classList.toggle("is-loading", e));
	},
	resetLoadingView() {
		this.dom.loadingView && this.defaultLoadingViewHtml && (this.dom.loadingView.innerHTML = this.defaultLoadingViewHtml);
	},
	showLoadingView() {
		this.resetLoadingView(), this.showOnly("loading-view");
	},
	clearLocalCaches() {
		this.cancelPendingAssessmentProgressWrites?.(), this.homeBootstrapUnavailable = !1, this.homeBootstrapLoadedThisPage = !1, this.routeDataGeneration += 1, this.state.levelList = [], this.state.levelIdByName = {}, this.state.areaList = [], this.state.areasByLevel = {}, this.state.modulesByArea = {}, this.state.subtopicProgressByArea = {}, this.state.quizzesByModule = {}, this.state.quizMap = {}, this.state.quizDetailsById = {}, this.state.questionsByQuizId = {}, this.state.attempts = [], this.state.attemptsSignature = "", this.state.attemptsByQuizId = {}, this.state.pastPaperAttempts = [], this.state.userStats = null, this.state.routeData = {
			yearByLevel: {},
			coursesByLevel: {},
			subtopicsByCourse: {},
			typesBySubtopic: {},
			quizzesByType: {},
			accountByKey: {},
			searchByQuery: {}
		}, this.routeDataLoadPromises = null, this.initialRoutePrefetch = null, this.assessmentProgressCache = null, this.assessmentProgressLoadPromises = null, this.assessmentSettingsById = null, this.state.homeDashboard = {
			loaded: !1,
			generatedAt: "",
			stats: null,
			levelProgressByName: {}
		}, this.state.activeQuestions = [], this.state.accountSummary = null, this.state.quizAttemptSummariesById = {}, this.state.moduleTypeCountsByModule = {}, this.resetPastPaperState?.(), this.state.search.indexLoaded = !1, this.state.search.results = [], this.state.search.activeIndex = -1, this.state.search.pagesByQuery = {}, this.state.search.requestSequence = 0, this.clearPersistedAppDataCache();
	},
	async hardRefreshFromDatabase() {
		if (!this.state.refreshInFlight) {
			this.state.refreshInFlight = !0, this.setRefreshButtonLoading(!0);
			try {
				if (this.clearLocalCaches(), this.showLoadingView(), await this.loadDatabase({
					showLoading: !1,
					routeOnComplete: !1
				}), !this.hasActiveAccess()) {
					this.renderAccessGate();
					return;
				}
				this.showToast("Database refreshed."), await this.router();
			} finally {
				this.state.refreshInFlight = !1, this.setRefreshButtonLoading(!1);
			}
		}
	},
	shouldLoadHomepageBootstrap() {
		return (window.location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)[0] || "home") === "home";
	},
	async loadDatabase({ showLoading: e = !0, routeOnComplete: t = !0 } = {}) {
		e && this.showLoadingView();
		let n = this.shouldLoadHomepageBootstrap(), r = n ? null : this.prefetchInitialRouteData?.();
		return r && r.catch(() => void 0), (n ? await this.loadHomeBootstrap?.() : await this.loadShellBootstrap?.()) ? this.hasActiveAccess() ? (t && await this.router(), !0) : (this.clearLocalCaches(), this.renderAccessGate(), !0) : (await Promise.all([this.loadThemePreference(), this.loadAccessStatus()]), this.hasActiveAccess() ? (n && await Promise.all([this.loadAreaCatalog(), this.loadPastPaperYears?.(!0)]), t && await this.router(), !1) : (this.clearLocalCaches(), this.renderAccessGate(), !1));
	},
	withTimeout(e, t, n = "Request") {
		return new Promise((r, i) => {
			let a = window.setTimeout(() => {
				i(/* @__PURE__ */ Error(`${n} timed out after ${t / 1e3} seconds.`));
			}, t);
			Promise.resolve(e).then((e) => {
				window.clearTimeout(a), r(e);
			}, (e) => {
				window.clearTimeout(a), i(e);
			});
		});
	},
	extractLeadingNumber(e) {
		let t = String(e ?? "").trim().match(/^(\d+)/);
		return t ? Number(t[1]) : null;
	},
	compareDisplayOrder(e, t) {
		let n = String(e ?? "").trim(), r = String(t ?? "").trim(), i = this.extractLeadingNumber(n), a = this.extractLeadingNumber(r);
		return i !== null && a !== null && i !== a ? i - a : i !== null && a === null ? -1 : i === null && a !== null ? 1 : n.localeCompare(r, void 0, {
			numeric: !0,
			sensitivity: "base"
		});
	},
	encodeRoutePart(e) {
		return encodeURIComponent(String(e ?? "").trim());
	},
	decodeRoutePart(e) {
		return decodeURIComponent(String(e ?? ""));
	},
	buildPath(e, t = {}) {
		let n = Object.fromEntries(Object.entries(t).filter(([, e]) => e != null && e !== "")), r = new URLSearchParams(n);
		switch (e) {
			case "home": return "/home/";
			case "year": return `/year/?${new URLSearchParams({ year: n.year || n.level || "" }).toString()}`;
			case "modules": return `/modules/?${new URLSearchParams({
				level: n.level || "",
				area: n.area || ""
			}).toString()}`;
			case "subtopics": return `/subtopics/?${new URLSearchParams({
				level: n.level || "",
				area: n.area || ""
			}).toString()}`;
			case "types": return `/types/?${new URLSearchParams({
				level: n.level || "",
				area: n.area || "",
				sub: n.sub || ""
			}).toString()}`;
			case "quizzes": return `/quizzes/?${new URLSearchParams({
				level: n.level || "",
				area: n.area || "",
				sub: n.sub || "",
				type: n.type || ""
			}).toString()}`;
			case "quiz": {
				let e = n.quizId || this.getQuizIdForRouteParams(n), t = Object.hasOwn(n, "negativeMarking") ? n.negativeMarking === !0 || n.negativeMarking === "true" || n.negativeMarking === "1" : n.mode === "exam", r = n.duration || t ? "exam" : "study";
				return e ? `/quiz/?${new URLSearchParams({
					quizId: e,
					mode: r,
					duration: n.duration || "",
					negative: t ? "1" : "0"
				}).toString()}` : "/home/";
			}
			case "results": {
				let e = n.quizId || this.getQuizIdForRouteParams(n), t = Object.hasOwn(n, "negativeMarking") ? n.negativeMarking === !0 || n.negativeMarking === "true" || n.negativeMarking === "1" : n.mode === "exam", r = n.duration || t ? "exam" : "study";
				return e ? `/results/?${new URLSearchParams({
					quizId: e,
					mode: r,
					duration: n.duration || "",
					negative: t ? "1" : "0"
				}).toString()}` : "/home/";
			}
			case "past-paper-topics": return `/past-papers/?${new URLSearchParams({ year: n.year || n.level || "" }).toString()}`;
			case "past-paper-exams": return `/past-papers/exams/?${new URLSearchParams({
				year: n.year || n.level || "",
				topic: n.topic || n.area || ""
			}).toString()}`;
			case "past-paper-session": return n.setId ? `/past-papers/session/?${new URLSearchParams({
				setId: n.setId,
				year: n.year || "",
				topic: n.topic || "",
				duration: n.duration || "",
				negative: n.negativeMarking === !0 || n.negativeMarking === "true" || n.negativeMarking === "1" ? "1" : "0"
			}).toString()}` : "/home/";
			case "past-paper-review": return n.attemptId ? `/past-papers/review/?${new URLSearchParams({
				attemptId: n.attemptId,
				duration: n.duration || "",
				negative: n.negativeMarking === !0 || n.negativeMarking === "true" || n.negativeMarking === "1" ? "1" : "0"
			}).toString()}` : "/home/";
			case "account": return "/account/";
			case "settings": return "/settings/";
			default: return r.toString() ? `/home/?${r.toString()}` : "/home/";
		}
	},
	reloadHomeRoute() {
		let e = this.buildPath("home");
		if (`${window.location.pathname}${window.location.search}` === e) {
			window.location.reload();
			return;
		}
		window.location.assign(e);
	},
	getQuizIdForRouteParams(e = {}) {
		let t = e.level || this.state.currentLevel, n = e.area || this.state.currentArea, r = e.sub || this.state.currentSub, i = e.type || this.state.currentType, a = e.title || this.state.currentQuizTitle;
		return this.state.quizMap[this.buildQuizKey(t, n, r, i, a)]?.id || this.state.currentQuizId || "";
	},
	async navigate(e, t = {}, n = {}) {
		if (this.routeNavigationInFlight && !n.replace) return;
		let r = this.buildPath(e, t);
		if (r) {
			if (`${window.location.pathname}${window.location.search}` === r) {
				await this.router();
				return;
			}
			this.routeNavigationInFlight = !0, document.body.classList.add("route-navigation-pending");
			try {
				n.replace ? window.history.replaceState({}, "", r) : window.history.pushState({}, "", r), await this.router(), await this.waitForRouteTransition();
			} finally {
				this.routeNavigationInFlight = !1, document.body.classList.remove("route-navigation-pending");
			}
		}
	},
	async router() {
		if (this.state.currentUser && !this.hasActiveAccess()) {
			this.renderAccessGate();
			return;
		}
		this.stopQuizCountdown?.(), this.stopPastPaperCountdown?.();
		let e = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean), [t = "home"] = e, n = new URLSearchParams(window.location.search), r = (e) => String(n.get(e) || "").trim();
		this.state.currentLevel = "", this.state.currentArea = "", this.state.currentSub = "", this.state.currentType = "", this.state.currentQuizTitle = "", this.state.currentQuizId = "", this.state.mode = "study", this.state.currentExamDurationMinutes = null, this.state.negativeMarking = !1, this.state.quizTimeRemainingSeconds = null, this.state.reviewWrongOnly = !1;
		let i = this.getPastPaperState?.();
		i && (i.currentYear = "", i.currentTopic = "", i.currentSetId = "", i.currentAttemptId = "", i.durationMinutes = null, i.negativeMarking = !1, i.timeRemainingSeconds = null);
		let a = "home";
		if (!e.length || t === "home" || t === "dashboard" || t === "app.html") a = "home";
		else if (t === "year") a = "year", this.state.currentLevel = r("year");
		else if (t === "modules") a = "modules", this.state.currentLevel = r("level"), this.state.currentArea = r("area");
		else if (t === "subtopics") a = "subtopics", this.state.currentLevel = r("level"), this.state.currentArea = r("area");
		else if (t === "types") a = "types", this.state.currentLevel = r("level"), this.state.currentArea = r("area"), this.state.currentSub = r("sub");
		else if (t === "quizzes") a = "quizzes", this.state.currentLevel = r("level"), this.state.currentArea = r("area"), this.state.currentSub = r("sub"), this.state.currentType = r("type").toLowerCase();
		else if (t === "quiz") a = "quiz", this.state.currentQuizId = r("quizId"), this.state.currentExamDurationMinutes = this.normalizeQuizDurationMinutes(n.get("duration")), this.state.negativeMarking = n.has("negative") ? n.get("negative") === "1" : n.get("mode") === "exam", this.state.mode = this.state.currentExamDurationMinutes || this.state.negativeMarking ? "exam" : "study";
		else if (t === "results") a = "results", this.state.currentQuizId = r("quizId"), this.state.currentExamDurationMinutes = this.normalizeQuizDurationMinutes(n.get("duration")), this.state.negativeMarking = n.has("negative") ? n.get("negative") === "1" : n.get("mode") === "exam", this.state.mode = this.state.currentExamDurationMinutes || this.state.negativeMarking ? "exam" : "study";
		else if (t === "past-papers") {
			let [, t = "topics"] = e;
			t === "exams" ? (a = "past-paper-exams", this.state.currentLevel = r("year"), this.state.currentArea = r("topic"), i && (i.currentYear = this.state.currentLevel, i.currentTopic = this.state.currentArea)) : t === "session" ? (a = "past-paper-session", i && (i.currentSetId = r("setId"), i.currentYear = r("year"), i.currentTopic = r("topic"), i.durationMinutes = this.normalizeQuizDurationMinutes(n.get("duration")), i.negativeMarking = n.get("negative") === "1")) : t === "review" ? (a = "past-paper-review", i && (i.currentAttemptId = r("attemptId"), i.durationMinutes = this.normalizeQuizDurationMinutes(n.get("duration")), i.negativeMarking = n.get("negative") === "1")) : (a = "past-paper-topics", this.state.currentLevel = r("year"), i && (i.currentYear = this.state.currentLevel));
		} else t === "account" ? a = "account" : t === "settings" && (a = "settings");
		if (this.syncPageState(a), ["quiz", "results"].includes(a) && !this.state.currentQuizId) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		if (a === "results" && this.state.currentQuizId) {
			let e = this.consumeInitialRoutePrefetch?.("results");
			if (e && await e, !await this.ensureQuizContextFromId(this.state.currentQuizId)) {
				await this.navigate("home", {}, { replace: !0 });
				return;
			}
		}
		switch (a) {
			case "account":
				await this.renderAccountView();
				break;
			case "settings":
				await this.renderSettingsView();
				break;
			case "year":
				await this.renderYearHub();
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
			case "quiz":
				await this.renderQuiz();
				break;
			case "results":
				this.renderResults();
				break;
			case "past-paper-topics":
				await this.renderPastPaperTopics();
				break;
			case "past-paper-exams":
				await this.renderPastPaperExams();
				break;
			case "past-paper-session":
				await this.renderPastPaperSession();
				break;
			case "past-paper-review":
				await this.renderPastPaperReview();
				break;
			default:
				if (!this.state.homeDashboard?.loaded && !this.homeBootstrapUnavailable && (this.showLoadingView(), await this.loadHomeBootstrap?.(), !this.hasActiveAccess())) {
					this.renderAccessGate();
					return;
				}
				await this.renderDashboard();
				break;
		}
		this.renderMenuSheetContext(), await this.waitForRouteTransition();
	},
	getRouteViews() {
		return Array.from(document.querySelectorAll(".view, #loading-view"));
	},
	getActiveRouteView() {
		return this.getRouteViews().find((e) => !e.hidden) || null;
	},
	prefersReducedRouteMotion() {
		return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
	},
	getRouteTransitionDuration() {
		return this.prefersReducedRouteMotion() ? 1 : this.routeTransitionDurationMs;
	},
	wait(e) {
		return new Promise((t) => {
			window.setTimeout(t, e);
		});
	},
	nextRouteFrame() {
		return new Promise((e) => {
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(e);
			});
		});
	},
	scrollToRouteTop() {
		window.scrollTo({
			top: 0,
			left: 0,
			behavior: "auto"
		});
	},
	cancelPendingLoadingReveal() {
		this.pendingLoadingTimer && (window.clearTimeout(this.pendingLoadingTimer), this.pendingLoadingTimer = null), this.pendingLoadingResolve && (this.pendingLoadingResolve(), this.pendingLoadingResolve = null);
	},
	cleanupRouteViewClasses(e) {
		e && e.classList.remove("view-entering", "view-active", "view-exiting");
	},
	async revealRouteView(e, t) {
		let n = document.getElementById(e);
		if (!n) return;
		let r = this.getRouteViews(), i = this.getActiveRouteView(), a = this.getRouteTransitionDuration();
		if (document.body.classList.add("route-transitioning"), i && i !== n) {
			if (i.setAttribute("aria-hidden", "true"), i.classList.remove("view-entering"), i.classList.add("view-active", "view-exiting"), await this.wait(a), t !== this.routeTransitionSequence) return;
			i.hidden = !0, this.cleanupRouteViewClasses(i);
		}
		e !== "loading-view" && this.scrollToRouteTop(), r.forEach((e) => {
			e !== n && (e.hidden = !0, e.setAttribute("aria-hidden", "true"), this.cleanupRouteViewClasses(e));
		}), n.hidden = !1, n.setAttribute("aria-hidden", "false"), n.classList.remove("view-exiting", "view-active"), n.classList.add("view-entering"), await this.nextRouteFrame(), t === this.routeTransitionSequence && (n.classList.add("view-active"), await this.wait(a), t === this.routeTransitionSequence && (n.classList.remove("view-entering"), n.classList.add("view-active"), document.body.classList.remove("route-transitioning")));
	},
	waitForRouteTransition() {
		return this.routeTransitionPromise || Promise.resolve();
	},
	showOnly(e) {
		e !== "settings-view" && this.stopSettingsCountdown();
		let t = document.getElementById(e);
		if (!t) return Promise.resolve();
		let n = e === "loading-view", r = !!this.pendingLoadingTimer || !!this.pendingLoadingResolve, i = document.body.classList.contains("route-transitioning");
		!n && (r || i) && (++this.routeTransitionSequence, this.cancelPendingLoadingReveal(), document.body.classList.remove("route-transitioning"));
		let a = this.getActiveRouteView();
		if (a === t && !t.hidden) return t.setAttribute("aria-hidden", "false"), this.cleanupRouteViewClasses(t), t.classList.add("view-active"), this.routeTransitionPromise = Promise.resolve(), this.routeTransitionPromise;
		let o = ++this.routeTransitionSequence;
		return n && this.cancelPendingLoadingReveal(), n && a && !a.hidden ? (this.routeTransitionPromise = new Promise((t) => {
			this.pendingLoadingResolve = t, this.pendingLoadingTimer = window.setTimeout(() => {
				this.pendingLoadingTimer = null, this.pendingLoadingResolve = null, this.revealRouteView(e, o).then(t);
			}, this.routeLoadingDelayMs);
		}), this.routeTransitionPromise) : (this.routeTransitionPromise = this.revealRouteView(e, o), this.routeTransitionPromise);
	},
	renderAccessGate(e = null) {
		this.syncPageState("access");
		let t = e || this.state.accessStatus || {}, n = String(t.status || "no_access"), r = t.accessExpiresAt ? this.formatDateTime(t.accessExpiresAt) : "", i = String(t.blockReason || "").trim(), a = String(this.state.currentUser?.email || "").trim(), o = {
			active: {
				badge: "Access Active",
				badgeTone: "success",
				title: "Access Available",
				message: "Your subscription is active and your account can use the medical bank.",
				identityStatus: "Subscription Active",
				identityTone: "success"
			},
			expired: {
				badge: "Access Expired",
				badgeTone: "warning",
				title: "Access Restricted",
				message: "Your subscription period has ended. Renew the account, then use Check Access Again.",
				identityStatus: "Account Verified",
				identityTone: "success"
			},
			blocked: {
				badge: "Access Blocked",
				badgeTone: "danger",
				title: "This account has been restricted.",
				message: "An administrator has blocked this account. Contact support to restore access.",
				identityStatus: "Account Verified",
				identityTone: "success"
			},
			no_access: {
				badge: "Pending Activation",
				badgeTone: "warning",
				title: "Access Restricted",
				message: "The account has no active subscription",
				identityStatus: "Email Verified",
				identityTone: "success"
			},
			signed_out: {
				badge: "Signed Out",
				badgeTone: "neutral",
				title: "Session Required",
				message: "Sign in again to continue.",
				identityStatus: "Session Needed",
				identityTone: "neutral"
			}
		}, s = o[n] || o.no_access;
		if (this.showOnly("access-view"), this.dom.accessStatusBadge) {
			let e = s.badgeTone === "success" ? "\n          <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n            <path d=\"m9 12 2 2 4-4\"></path>\n            <path d=\"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z\"></path>\n          </svg>\n        " : s.badgeTone === "danger" ? "\n            <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n              <path d=\"M12 9v4\"></path>\n              <path d=\"M12 17h.01\"></path>\n              <path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z\"></path>\n            </svg>\n          " : s.badgeTone === "neutral" ? "\n              <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                <path d=\"M12 8v4\"></path>\n                <path d=\"M12 16h.01\"></path>\n                <path d=\"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z\"></path>\n              </svg>\n            " : "\n              <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                <path d=\"M12 9v4\"></path>\n                <path d=\"M12 17h.01\"></path>\n                <path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z\"></path>\n              </svg>\n            ";
			this.dom.accessStatusBadge.innerHTML = `${e}<span>${this.escapeHtml(s.badge)}</span>`, this.dom.accessStatusBadge.className = `access-status-badge is-${s.badgeTone}`;
		}
		if (this.dom.accessTitle && (this.dom.accessTitle.textContent = s.title), this.dom.accessMessage && (this.dom.accessMessage.textContent = s.message), this.dom.accessEmailValue && (this.dom.accessEmailValue.textContent = a || "No email available"), this.dom.accessIdentityStatus && (this.dom.accessIdentityStatus.className = `access-identity-status is-${s.identityTone}`), this.dom.accessIdentityStatusText && (this.dom.accessIdentityStatusText.textContent = s.identityStatus), this.dom.accessMeta) {
			let e = [];
			r && e.push(`<span class="access-meta-chip">Expires: ${this.escapeHtml(r)}</span>`), i && e.push(`<span class="access-meta-chip">Reason: ${this.escapeHtml(i)}</span>`), this.dom.accessMeta.innerHTML = e.join(""), this.dom.accessMeta.hidden = !e.length;
		}
	}
}, h = {
	sba: {
		label: "Single Best Answer",
		short: "SBA",
		className: "sba-border"
	},
	tf: {
		label: "True / False",
		short: "T/F",
		className: "tf-border"
	}
}, g = [
	"user_id",
	"assessment_kind",
	"assessment_id",
	"progress_key",
	"mode",
	"duration_minutes",
	"negative_marking",
	"context",
	"progress_data",
	"timer_expires_at",
	"updated_at"
].join(", ");
async function _(e, t, n, r, i = "") {
	if (!t || !n || !r) return {
		data: null,
		error: null
	};
	let a = e.from("user_assessment_progress").select(g).eq("user_id", t).eq("assessment_kind", n).eq("assessment_id", String(r));
	return a = i ? a.eq("progress_key", i) : a.order("updated_at", { ascending: !1 }).limit(1), a.maybeSingle();
}
async function v(e, t, n, r, i) {
	return !t || !n || !r ? {
		data: null,
		error: null
	} : e.from("user_assessment_progress").upsert({
		user_id: t,
		assessment_kind: n,
		assessment_id: String(r),
		progress_key: i.progressKey,
		mode: i.mode === "exam" ? "exam" : "study",
		duration_minutes: i.durationMinutes || null,
		negative_marking: !!i.negativeMarking,
		context: i.context || {},
		progress_data: i.progressData || {},
		timer_expires_at: i.timerExpiresAt || null
	}, { onConflict: "user_id,assessment_kind,assessment_id,progress_key" });
}
async function y(e, t, n, r, i) {
	return !t || !n || !r || !i ? {
		data: null,
		error: null
	} : e.from("user_assessment_progress").delete().eq("user_id", t).eq("assessment_kind", n).eq("assessment_id", String(r)).eq("progress_key", i);
}
async function b(e, t) {
	return t ? e.from("user_assessment_progress").delete().eq("user_id", t) : {
		data: null,
		error: null
	};
}
//#endregion
//#region public/src/services/home-bootstrap-service.js
async function x(e) {
	return e.rpc("app_home_bootstrap");
}
async function S(e) {
	return e.rpc("app_shell_bootstrap");
}
//#endregion
//#region public/src/ui/dialog.js
function C() {
	let e = document.getElementById("app-dialog-root");
	return e || (e = document.createElement("div"), e.id = "app-dialog-root", document.body.appendChild(e), e);
}
function w({ title: e = "Confirm", message: t = "", submitLabel: n = "Confirm", cancelLabel: r = "Cancel", danger: i = !1 }) {
	let a = document.createElement("div");
	a.className = "dialog-overlay";
	let o = document.createElement("div");
	o.className = "dialog-panel", o.setAttribute("role", "dialog"), o.setAttribute("aria-modal", "true"), o.tabIndex = -1;
	let s = document.createElement("h2");
	s.className = "dialog-title", s.textContent = e;
	let c = document.createElement("p");
	c.className = "dialog-copy", c.textContent = t;
	let l = document.createElement("form");
	l.className = "dialog-form";
	let u = document.createElement("div");
	u.className = "dialog-fields";
	let d = document.createElement("div");
	d.className = "dialog-actions";
	let f = document.createElement("button");
	f.type = "button", f.className = "dialog-btn secondary", f.textContent = r;
	let p = document.createElement("button");
	return p.type = "submit", p.className = `dialog-btn primary${i ? " danger" : ""}`, p.textContent = n, d.append(f, p), l.append(u, d), o.appendChild(s), t && o.appendChild(c), o.appendChild(l), a.appendChild(o), {
		overlay: a,
		panel: o,
		form: l,
		fields: u,
		cancelButton: f,
		submitButton: p
	};
}
function T(e, t) {
	t.remove(), e.childElementCount || e.remove();
}
function E({ title: e = "Confirm", message: t = "", submitLabel: n = "Confirm", cancelLabel: r = "Cancel", danger: i = !1 } = {}) {
	return new Promise((a) => {
		let o = C(), { overlay: s, panel: c, form: l, cancelButton: u } = w({
			title: e,
			message: t,
			submitLabel: n,
			cancelLabel: r,
			danger: i
		}), d = (e) => {
			document.removeEventListener("keydown", f), T(o, s), a(e);
		}, f = (e) => {
			e.key === "Escape" && d(!1);
		};
		u.addEventListener("click", () => d(!1)), s.addEventListener("click", (e) => {
			e.target === s && d(!1);
		}), l.addEventListener("submit", (e) => {
			e.preventDefault(), d(!0);
		}), o.appendChild(s), document.addEventListener("keydown", f), requestAnimationFrame(() => {
			c.focus();
		});
	});
}
function D({ title: e = "Start quiz", message: t = "", submitLabel: n = "Start quiz", cancelLabel: r = "Cancel", min: i = 5, max: a = 30, initial: o = null, negativeMarking: s = !1 } = {}) {
	return new Promise((c) => {
		let l = C(), u = Math.min(i, a), d = Math.max(i, a), f = Number.parseInt(o, 10), p = [0, ...Array.from({ length: d - u + 1 }, (e, t) => u + t)], m = Number.isFinite(f) ? Math.min(d, Math.max(u, f)) : 0, { overlay: h, panel: g, form: _, fields: v, cancelButton: y, submitButton: b } = w({
			title: e,
			message: t,
			submitLabel: n,
			cancelLabel: r
		}), x = document.createElement("div");
		x.className = "dialog-wheel";
		let S = document.createElement("div");
		S.className = "dialog-wheel-label", S.textContent = "Timer";
		let E = document.createElement("div");
		E.className = "dialog-wheel-list";
		let D = [];
		p.forEach((e) => {
			let t = document.createElement("button");
			t.type = "button", t.className = "dialog-wheel-option", t.dataset.value = String(e), t.innerHTML = e ? `<span class="dialog-wheel-value">${e}</span><span class="dialog-wheel-unit">min</span>` : "<span class=\"dialog-wheel-value dialog-wheel-value-text\">No time</span>", t.addEventListener("click", () => {
				m = e, O(), t.scrollIntoView({
					block: "center",
					behavior: "smooth"
				});
			}), E.appendChild(t), D.push(t);
		});
		let O = () => {
			D.forEach((e) => {
				let t = Number(e.dataset.value) === m;
				e.classList.toggle("is-selected", t), e.setAttribute("aria-pressed", t ? "true" : "false");
			});
		}, k = () => {
			let e = E.getBoundingClientRect().top + E.offsetHeight / 2, t = D[0], n = Infinity;
			D.forEach((r) => {
				let i = r.getBoundingClientRect(), a = Math.abs(i.top + i.height / 2 - e);
				a < n && (n = a, t = r);
			}), m = Number(t?.dataset.value || 0), O();
		}, A = null;
		E.addEventListener("scroll", () => {
			A && window.clearTimeout(A), A = window.setTimeout(k, 60);
		});
		let j = document.createElement("div");
		j.className = "dialog-setting-row", j.innerHTML = "\n      <div class=\"dialog-setting-copy\">\n        <div class=\"dialog-setting-title-row\">\n          <span class=\"dialog-setting-title\">Negative marking</span>\n          <span class=\"dialog-info-wrap\">\n            <button class=\"dialog-info-btn\" type=\"button\" aria-label=\"Negative marking rules\" aria-describedby=\"negative-marking-tooltip\">i</button>\n            <span id=\"negative-marking-tooltip\" class=\"dialog-info-tooltip\" role=\"tooltip\">Correct answers earn 1 point. Wrong answers lose 1 point. Unanswered questions score 0.</span>\n          </span>\n        </div>\n      </div>\n      <label class=\"dialog-switch\">\n        <input class=\"dialog-switch-input\" type=\"checkbox\" aria-label=\"Toggle negative marking\">\n        <span class=\"dialog-switch-track\" aria-hidden=\"true\"></span>\n      </label>\n    ";
		let M = j.querySelector(".dialog-switch-input");
		M.checked = !!s, x.append(S, E), v.append(x, j);
		let N = (e) => {
			A && window.clearTimeout(A), document.removeEventListener("keydown", F), T(l, h), c(e);
		}, P = (e) => {
			let t = Math.max(0, p.indexOf(m)), n = Math.min(p.length - 1, Math.max(0, t + e));
			m = p[n], O(), D[n]?.scrollIntoView({
				block: "center",
				behavior: "smooth"
			});
		}, F = (e) => {
			e.key === "Escape" ? N(null) : e.key === "ArrowUp" ? (e.preventDefault(), P(-1)) : e.key === "ArrowDown" && (e.preventDefault(), P(1));
		};
		y.addEventListener("click", () => N(null)), h.addEventListener("click", (e) => {
			e.target === h && N(null);
		}), _.addEventListener("submit", (e) => {
			e.preventDefault(), N({
				durationMinutes: m || null,
				negativeMarking: M.checked
			});
		}), l.appendChild(h), document.addEventListener("keydown", F), requestAnimationFrame(() => {
			O(), D[p.indexOf(m)]?.scrollIntoView({
				block: "center",
				behavior: "auto"
			}), g.focus(), b.focus();
		});
	});
}
//#endregion
//#region public/src/apps/learner-features.js
var O = {
	assessmentProgressWriteQueue: Promise.resolve(),
	assessmentProgressUnavailable: !1,
	ensureRouteDataState() {
		return this.state.routeData || (this.state.routeData = {
			yearByLevel: {},
			coursesByLevel: {},
			subtopicsByCourse: {},
			typesBySubtopic: {},
			quizzesByType: {},
			accountByKey: {},
			searchByQuery: {}
		}), this.routeDataLoadPromises || (this.routeDataLoadPromises = {}), this.state.routeData;
	},
	getScopedRouteDataKey(...e) {
		return JSON.stringify(e.map((e) => String(e ?? "").trim()));
	},
	requireScopedRouteParts(e, t) {
		let n = Object.fromEntries(Object.entries(t).map(([e, t]) => [e, String(t ?? "").trim()]));
		if (Object.values(n).some((e) => !e)) throw Error(`${e} requires complete route parameters.`);
		return n;
	},
	assertScopedRouteContext(e, t, n) {
		for (let [r, i] of Object.entries(t)) if (String(e?.[r] ?? "").trim() !== String(i).trim()) throw Error(`${n} returned data for a different route.`);
	},
	rememberInitialRoutePrefetch(e, t) {
		let n = Promise.resolve(t);
		return this.initialRoutePrefetch = {
			location: `${window.location.pathname}${window.location.search}`,
			routeKey: e,
			promise: n
		}, n;
	},
	consumeInitialRoutePrefetch(e) {
		let t = this.initialRoutePrefetch;
		return !t || t.routeKey !== e || t.location !== `${window.location.pathname}${window.location.search}` ? null : (this.initialRoutePrefetch = null, t.promise);
	},
	async loadScopedRouteData({ cacheName: e, cacheKey: t, rpcName: n, params: r = {}, label: i, normalize: a, force: o = !1 }) {
		let s = this.ensureRouteDataState(), c = Number(this.routeDataGeneration || 0);
		s[e] || (s[e] = {});
		let l = s[e];
		if (!o && l && Object.hasOwn(l, t)) return l[t];
		let u = `${c}:${e}:${t}`, d = this.routeDataLoadPromises[u];
		if (d) {
			if (!o) return d;
			try {
				await d;
			} catch {}
		}
		let f = (async () => {
			let { data: o, error: l } = await this.withTimeout(this.getSupabase().rpc(n, r), 12e3, i);
			if (l) throw l;
			if (!o || Array.isArray(o) || typeof o != "object" || Number(o.schemaVersion) !== 1) throw Error(`${i} returned an invalid response.`);
			let u = a(o);
			return Number(this.routeDataGeneration || 0) === c && (s[e][t] = u), u;
		})();
		this.routeDataLoadPromises[u] = f;
		try {
			return await f;
		} finally {
			this.routeDataLoadPromises?.[u] === f && delete this.routeDataLoadPromises[u];
		}
	},
	async refreshDatabase() {
		return this.hardRefreshFromDatabase();
	},
	prefetchInitialRouteData() {
		let e = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean), [t = "home"] = e, n = new URLSearchParams(window.location.search), r = (e) => String(n.get(e) || "").trim();
		switch (t) {
			case "year": {
				let e = r("year");
				return e ? this.loadYearOverview(e) : null;
			}
			case "modules": {
				let e = r("level");
				return e ? this.loadBrowseCourses(e) : null;
			}
			case "subtopics": {
				let e = r("level"), t = r("area");
				return e && t ? this.loadBrowseSubtopics(e, t) : null;
			}
			case "types": {
				let e = r("level"), t = r("area"), n = r("sub");
				return e && t && n ? this.loadBrowseTypes(e, t, n) : null;
			}
			case "quizzes": {
				let e = r("level"), t = r("area"), n = r("sub"), i = r("type").toLowerCase();
				return e && t && n && ["sba", "tf"].includes(i) ? this.loadBrowseQuizzes(e, t, n, i) : null;
			}
			case "quiz": {
				let e = r("quizId");
				return e ? (this.state.currentQuizId = e, this.state.currentExamDurationMinutes = this.normalizeQuizDurationMinutes(n.get("duration")), this.state.negativeMarking = n.has("negative") ? n.get("negative") === "1" : n.get("mode") === "exam", this.state.mode = this.state.currentExamDurationMinutes || this.state.negativeMarking ? "exam" : "study", this.rememberInitialRoutePrefetch("quiz", this.loadQuizSessionPage(e))) : null;
			}
			case "results": {
				let e = r("quizId");
				return e ? (this.state.currentQuizId = e, this.rememberInitialRoutePrefetch("results", this.loadQuizDescriptorsByIds([e]))) : null;
			}
			case "past-papers": {
				let [, t = "topics"] = e, i = this.getPastPaperState();
				if (t === "exams") {
					let e = r("year"), t = r("topic");
					return !e || !t ? null : (i.currentYear = e, i.currentTopic = t, this.rememberInitialRoutePrefetch("past-paper-exams", this.ensurePastPaperExamsLoaded(e, t)));
				}
				if (t === "session") {
					let e = r("setId");
					return e ? (i.currentSetId = e, i.currentYear = r("year"), i.currentTopic = r("topic"), i.durationMinutes = this.normalizeQuizDurationMinutes(n.get("duration")), i.negativeMarking = n.get("negative") === "1", this.rememberInitialRoutePrefetch("past-paper-session", this.loadPastPaperSessionPage(e))) : null;
				}
				if (t === "review") {
					let e = r("attemptId");
					return e ? this.rememberInitialRoutePrefetch("past-paper-review", this.loadPastPaperAttemptReview(e)) : null;
				}
				let a = r("year");
				return a ? (i.currentYear = a, this.rememberInitialRoutePrefetch("past-paper-topics", this.ensurePastPaperTopicsLoaded(a))) : null;
			}
			case "account": return this.loadAccountPage();
			default: return null;
		}
	},
	async loadAreaCatalog() {
		let e = await this.fetchLevelCourseCatalogRows();
		this.setAreaCatalogFromRows(e);
	},
	isRpcUnavailable(e) {
		let t = String(e?.code || "").trim(), n = String(e?.message || "").toLowerCase();
		return [
			"PGRST202",
			"PGRST205",
			"42883",
			"42P01"
		].includes(t) || n.includes("could not find the function") || n.includes("does not exist") || n.includes("schema cache");
	},
	async fetchLevelCourseCatalogRows() {
		let { data: e, error: t } = await this.withTimeout(this.getSupabase().rpc("app_level_course_catalog"), 12e3, "Loading levels and courses");
		if (t) throw t;
		return e || [];
	},
	setAreaCatalogFromRows(e) {
		let t = e.map((e) => ({
			id: e.level_id,
			name: String(e.level || "").trim(),
			displayOrder: Number(e.display_order || 0)
		})).filter((e) => e.id && e.name).filter((e, t, n) => n.findIndex((t) => t.id === e.id) === t).sort((e, t) => e.displayOrder === t.displayOrder ? this.compareDisplayOrder(e.name, t.name) : e.displayOrder - t.displayOrder), n = Object.fromEntries(t.map((e) => [e.id, e.name])), r = {};
		t.forEach((e) => {
			r[e.name] = [];
		}), e.map((e) => ({
			id: e.course_id,
			name: String(e.area || "").trim(),
			levelId: e.level_id || ""
		})).filter((e) => e.id && e.name && e.levelId && n[e.levelId]).sort((e, t) => this.compareDisplayOrder(e.name, t.name)).forEach((e) => {
			let t = n[e.levelId];
			r[t] || (r[t] = []), r[t].push(e);
		}), this.state.levelList = t, this.state.levelIdByName = Object.fromEntries(t.map((e) => [e.name, e.id])), this.state.areasByLevel = r, this.state.areaList = t.flatMap((e) => r[e.name] || []), this.scheduleAppDataCacheWrite();
	},
	isHomeBootstrapUnavailable(e) {
		let t = String(e?.code || "").trim().toUpperCase(), n = String(e?.message || "").toLowerCase();
		return t === "PGRST202" || n.includes("app_home_bootstrap") && (t === "42883" || n.includes("could not find the function") || n.includes("does not exist") || n.includes("schema cache"));
	},
	isHomeBootstrapPayload(e) {
		return !!e && !Array.isArray(e) && typeof e == "object" && Number(e.schemaVersion) === 1 && !!e.access && typeof e.access == "object" && !!e.dashboard && typeof e.dashboard == "object" && Array.isArray(e.dashboard.levels) && Array.isArray(e.dashboard.pastPaperYears);
	},
	isShellBootstrapPayload(e) {
		return !!e && !Array.isArray(e) && typeof e == "object" && Number(e.schemaVersion) === 1 && !!e.access && typeof e.access == "object";
	},
	applyShellBootstrap(e) {
		let t = e.access || {};
		this.state.accessStatus = {
			...t,
			hasAccess: !!(t.hasAccess ?? t.has_access),
			accessExpiresAt: t.accessExpiresAt ?? t.access_expires_at ?? null,
			blockReason: t.blockReason ?? t.block_reason ?? ""
		};
		let n = e.themePreference;
		if (n === "dark" || n === "light") {
			let e = l(a(n));
			this.applyThemePreference(e);
		}
	},
	applyHomeBootstrap(e) {
		this.applyShellBootstrap(e), this.homeBootstrapLoadedThisPage = !0;
		let t = e.dashboard || {}, n = (t.levels || []).map((e) => ({
			id: e.levelId || e.level_id || "",
			name: String(e.name || e.level || "").trim(),
			displayOrder: Number(e.displayOrder ?? e.display_order ?? 0),
			courseCount: Number(e.courseCount ?? e.course_count ?? 0),
			doneCount: Number(e.doneCount ?? e.done_count ?? 0),
			totalCount: Number(e.totalCount ?? e.total_count ?? 0),
			percent: Number(e.percent || 0)
		})).filter((e) => e.id && e.name).sort((e, t) => e.displayOrder === t.displayOrder ? this.compareDisplayOrder(e.name, t.name) : e.displayOrder - t.displayOrder);
		this.state.levelList = n.map(({ id: e, name: t, displayOrder: n }) => ({
			id: e,
			name: t,
			displayOrder: n
		})), this.state.levelIdByName = Object.fromEntries(n.map((e) => [e.name, e.id])), this.state.areasByLevel = Object.fromEntries(n.map((e) => [e.name, Array.isArray(this.state.areasByLevel[e.name]) ? this.state.areasByLevel[e.name] : []])), this.state.areaList = this.state.levelList.flatMap((e) => this.state.areasByLevel[e.name] || []), this.state.homeDashboard = {
			loaded: !0,
			generatedAt: e.generatedAt || "",
			stats: {
				activeYears: Number(t.activeYears || 0),
				completedCount: Number(t.completedCount || 0),
				averageScore: Number(t.averageScore || 0)
			},
			levelProgressByName: Object.fromEntries(n.map((e) => [e.name, {
				doneCount: e.doneCount,
				totalCount: e.totalCount,
				courseCount: e.courseCount,
				percent: e.percent
			}]))
		};
		let r = this.getPastPaperState?.();
		r && (r.years = this.normalizePastPaperYearRows(t.pastPaperYears), r.yearsLoaded = !0), this.scheduleAppDataCacheWrite();
	},
	async loadHomeBootstrap() {
		if (this.homeBootstrapLoadPromise) return this.homeBootstrapLoadPromise;
		let e = (async () => {
			let { data: e, error: t } = await this.withTimeout(x(this.getSupabase()), 12e3, "Loading homepage");
			if (t) {
				if (this.isHomeBootstrapUnavailable(t)) return this.homeBootstrapUnavailable = !0, !1;
				throw t;
			}
			if (!this.isHomeBootstrapPayload(e)) throw Error("The homepage bootstrap response is invalid.");
			return this.applyHomeBootstrap(e), this.homeBootstrapUnavailable = !1, !0;
		})();
		this.homeBootstrapLoadPromise = e;
		try {
			return await e;
		} finally {
			this.homeBootstrapLoadPromise === e && (this.homeBootstrapLoadPromise = null);
		}
	},
	async loadShellBootstrap() {
		if (this.shellBootstrapLoadPromise) return this.shellBootstrapLoadPromise;
		let e = (async () => {
			let { data: e, error: t } = await this.withTimeout(S(this.getSupabase()), 12e3, "Loading application access");
			if (t) {
				if (this.isRpcUnavailable(t)) return !1;
				throw t;
			}
			if (!this.isShellBootstrapPayload(e)) throw Error("The application bootstrap response is invalid.");
			return this.applyShellBootstrap(e), !0;
		})();
		this.shellBootstrapLoadPromise = e;
		try {
			return await e;
		} finally {
			this.shellBootstrapLoadPromise === e && (this.shellBootstrapLoadPromise = null);
		}
	},
	async loadYearOverview(e, t = !1) {
		let { level: n } = this.requireScopedRouteParts("Year overview", { level: e }), r = this.getScopedRouteDataKey(n);
		return this.loadScopedRouteData({
			cacheName: "yearByLevel",
			cacheKey: r,
			rpcName: "app_year_overview",
			params: { p_level: n },
			label: "Loading year overview",
			force: t,
			normalize: (e) => {
				this.assertScopedRouteContext(e, { level: n }, "Year overview");
				let t = e.normal || null, r = e.pastPaper || e.past_paper || null, i = t ? {
					levelId: t.levelId || t.level_id || "",
					courseCount: Number(t.courseCount ?? t.course_count ?? 0),
					doneCount: Number(t.doneCount ?? t.done_count ?? 0),
					totalCount: Number(t.totalCount ?? t.total_count ?? 0),
					percent: Number(t.percent || 0)
				} : null, a = r && this.normalizePastPaperYearRows([r])[0] || null;
				return {
					level: String(e.level || n).trim(),
					normal: i,
					pastPaper: a
				};
			}
		});
	},
	async loadBrowseCourses(e, t = !1) {
		let { level: n } = this.requireScopedRouteParts("Course page", { level: e }), r = this.getScopedRouteDataKey(n), i = Number(this.routeDataGeneration || 0), a = await this.loadScopedRouteData({
			cacheName: "coursesByLevel",
			cacheKey: r,
			rpcName: "app_browse_courses",
			params: { p_level: n },
			label: "Loading courses",
			force: t,
			normalize: (e) => (this.assertScopedRouteContext(e, { level: n }, "Course page"), {
				level: n,
				courses: (Array.isArray(e.courses) ? e.courses : []).map((e) => {
					let t = Number(e.doneCount ?? e.done_count ?? 0), n = Number(e.totalCount ?? e.total_count ?? 0);
					return {
						id: e.courseId || e.course_id || "",
						name: String(e.name || e.area || "").trim(),
						summary: {
							moduleCount: Number(e.moduleCount ?? e.module_count ?? 0),
							doneCount: t,
							totalCount: n,
							percent: Number(e.percent ?? (n ? Math.round(t / n * 100) : 0))
						}
					};
				}).filter((e) => e.id && e.name).sort((e, t) => this.compareDisplayOrder(e.name, t.name))
			})
		});
		return Number(this.routeDataGeneration || 0) === i ? (this.state.areasByLevel[n] = a.courses.map(({ id: e, name: t }) => ({
			id: e,
			name: t
		})), this.state.areaList = Object.values(this.state.areasByLevel).flat().filter((e, t, n) => e?.id && n.findIndex((t) => t.id === e.id) === t), a) : a;
	},
	async loadBrowseSubtopics(e, t, n = !1) {
		let { level: r, area: i } = this.requireScopedRouteParts("Subtopic page", {
			level: e,
			area: t
		}), a = this.getScopedRouteDataKey(r, i), o = Number(this.routeDataGeneration || 0), s = await this.loadScopedRouteData({
			cacheName: "subtopicsByCourse",
			cacheKey: a,
			rpcName: "app_browse_subtopics",
			params: {
				p_level: r,
				p_area: i
			},
			label: "Loading subtopics",
			force: n,
			normalize: (e) => (this.assertScopedRouteContext(e, {
				level: r,
				area: i
			}, "Subtopic page"), {
				level: r,
				area: i,
				courseId: e.courseId || e.course_id || "",
				subtopics: (Array.isArray(e.subtopics) ? e.subtopics : []).map((e) => {
					let t = Number(e.doneCount ?? e.done_count ?? 0), n = Number(e.totalCount ?? e.total_count ?? 0);
					return {
						id: e.subtopicId || e.subtopic_id || "",
						name: String(e.name || e.subtopic_name || "").trim(),
						summary: {
							doneCount: t,
							totalCount: n,
							percent: Number(e.percent ?? (n ? Math.round(t / n * 100) : 0))
						}
					};
				}).filter((e) => e.id && e.name).sort((e, t) => this.compareDisplayOrder(e.name, t.name))
			})
		});
		if (Number(this.routeDataGeneration || 0) !== o) return s;
		let c = this.getAreaCacheKey(r, i);
		return this.state.modulesByArea[c] = s.subtopics.map(({ id: e, name: t }) => ({
			id: e,
			name: t,
			areaId: s.courseId
		})), this.state.subtopicProgressByArea[c] = Object.fromEntries(s.subtopics.map((e) => [e.name, e.summary])), s;
	},
	async loadBrowseTypes(e, t, n, r = !1) {
		let { level: i, area: a, sub: o } = this.requireScopedRouteParts("Question-format page", {
			level: e,
			area: t,
			sub: n
		}), s = this.getScopedRouteDataKey(i, a, o);
		return this.loadScopedRouteData({
			cacheName: "typesBySubtopic",
			cacheKey: s,
			rpcName: "app_browse_types",
			params: {
				p_level: i,
				p_area: a,
				p_sub: o
			},
			label: "Loading question formats",
			force: r,
			normalize: (e) => {
				this.assertScopedRouteContext(e, {
					level: i,
					area: a,
					sub: o
				}, "Question-format page");
				let t = Object.fromEntries((Array.isArray(e.types) ? e.types : []).map((e) => [e.type === "tf" ? "tf" : "sba", e])), n = ["sba", "tf"].map((e) => {
					let n = t[e] || {}, r = Number(n.quizCount ?? n.quiz_count ?? 0), i = Number(n.completedCount ?? n.completed_count ?? 0);
					return {
						type: e,
						quizCount: r,
						questionCount: Number(n.questionCount ?? n.question_count ?? 0),
						completedCount: i,
						percent: Number(n.percent ?? (r ? Math.round(i / r * 100) : 0))
					};
				}), r = Number(e.totalQuizCount ?? e.total_quiz_count ?? n.reduce((e, t) => e + t.quizCount, 0)), s = Number(e.completedQuizCount ?? e.completed_quiz_count ?? n.reduce((e, t) => e + t.completedCount, 0));
				return {
					level: i,
					area: a,
					sub: o,
					totalQuestions: Number(e.totalQuestions ?? e.total_questions ?? n.reduce((e, t) => e + t.questionCount, 0)),
					totalQuizCount: r,
					completedQuizCount: s,
					percent: Number(e.percent ?? (r ? Math.round(s / r * 100) : 0)),
					types: n
				};
			}
		});
	},
	async loadBrowseQuizzes(e, t, n, r, i = !1) {
		let { level: a, area: o, sub: s, type: c } = this.requireScopedRouteParts("Assessment page", {
			level: e,
			area: t,
			sub: n,
			type: r
		});
		if (!["sba", "tf"].includes(c)) throw Error("Assessment page received an invalid question type.");
		let l = this.getScopedRouteDataKey(a, o, s, c), u = Number(this.routeDataGeneration || 0), d = await this.loadScopedRouteData({
			cacheName: "quizzesByType",
			cacheKey: l,
			rpcName: "app_browse_quizzes",
			params: {
				p_level: a,
				p_area: o,
				p_sub: s,
				p_type: c
			},
			label: "Loading assessments",
			force: i,
			normalize: (e) => {
				this.assertScopedRouteContext(e, {
					level: a,
					area: o,
					sub: s,
					type: c
				}, "Assessment page");
				let t = (Array.isArray(e.quizzes) ? e.quizzes : []).map((e) => ({
					id: e.quizId || e.quiz_id || "",
					title: String(e.title || e.quiz_title || "").trim(),
					count: Number(e.questionCount ?? e.question_count ?? 0),
					totalAttempts: Number(e.totalAttempts ?? e.total_attempts ?? 0),
					bestPercentage: e.bestPercentage === null || e.best_percentage === null || e.bestPercentage === void 0 && e.best_percentage === void 0 ? null : Number(e.bestPercentage ?? e.best_percentage ?? 0)
				})).filter((e) => e.id && e.title).sort((e, t) => this.compareDisplayOrder(e.title, t.title)), n = e.summary || {}, r = Number(n.completedCount ?? n.completed_count ?? t.filter((e) => e.totalAttempts > 0).length);
				return {
					level: a,
					area: o,
					sub: s,
					type: c,
					topicIndex: Math.max(1, Number(e.topicIndex ?? e.topic_index ?? 1)),
					summary: {
						assessmentCount: Number(n.assessmentCount ?? n.assessment_count ?? t.length),
						completedCount: r,
						averageBestPercentage: n.averageBestPercentage === null || n.average_best_percentage === null || n.averageBestPercentage === void 0 && n.average_best_percentage === void 0 ? null : Number(n.averageBestPercentage ?? n.average_best_percentage ?? 0)
					},
					quizzes: t
				};
			}
		});
		if (Number(this.routeDataGeneration || 0) !== u) return d;
		let f = this.getModuleCacheKey(a, o, s), p = this.state.quizzesByModule[f] || {
			sba: {},
			tf: {}
		};
		return p[c] = Object.fromEntries(d.quizzes.map((e) => [e.title, {
			id: e.id,
			count: e.count
		}])), this.state.quizzesByModule[f] = p, d.quizzes.forEach((e, t) => {
			this.registerQuizDescriptor({
				level: a,
				quizId: e.id,
				area: o,
				sub: s,
				type: c,
				title: e.title,
				count: e.count,
				quizIndex: t + 1
			});
		}), d;
	},
	getEmptyAccountPage() {
		let e = {
			attemptsCount: 0,
			assessmentsDoneCount: 0,
			averagePercentage: 0
		};
		return {
			attemptsCount: 0,
			quizzesDoneCount: 0,
			averagePercentage: 0,
			bestAttempt: null,
			sectionStats: {
				normal: { ...e },
				exam: { ...e },
				combined: { ...e }
			},
			courseStats: [],
			recentAttempts: []
		};
	},
	normalizeAccountAttempt(e) {
		return !e || typeof e != "object" ? null : {
			id: e.id || e.attemptKey || e.attempt_key || "",
			quizId: e.quizId || e.quiz_id || "",
			setId: e.setId || e.set_id || "",
			assessmentKind: e.assessmentKind === "past_paper" || e.assessment_kind === "past_paper" ? "past_paper" : "quiz",
			level: String(e.level || "").trim(),
			area: String(e.area || "").trim(),
			sub: String(e.sub || "").trim(),
			quizTitle: String(e.quizTitle || e.quiz_title || e.title || "").trim(),
			mode: e.mode === "exam" ? "exam" : "study",
			score: Number(e.score || 0),
			totalQuestions: Number(e.totalQuestions ?? e.total_questions ?? e.totalMarks ?? 0),
			correctCount: Number(e.correctCount ?? e.correct_count ?? 0),
			wrongCount: Number(e.wrongCount ?? e.wrong_count ?? 0),
			unansweredCount: Number(e.unansweredCount ?? e.unanswered_count ?? 0),
			percentage: Number(e.percentage || 0),
			completedAt: e.completedAt || e.completed_at || ""
		};
	},
	normalizeAccountPage(e) {
		let t = e?.summary || e || {}, n = this.getEmptyAccountPage(), r = (e) => {
			let n = t.sectionStats?.[e] || t.section_stats?.[e] || {};
			return {
				attemptsCount: Number(n.attemptsCount ?? n.attempts_count ?? 0),
				assessmentsDoneCount: Number(n.assessmentsDoneCount ?? n.assessments_done_count ?? 0),
				averagePercentage: Number(n.averagePercentage ?? n.average_percentage ?? 0)
			};
		}, i = e?.history?.items || t.recentAttempts || t.recent_attempts || [];
		return {
			...n,
			attemptsCount: Number(t.attemptsCount ?? t.attempts_count ?? 0),
			quizzesDoneCount: Number(t.quizzesDoneCount ?? t.quizzes_done_count ?? t.assessmentsDoneCount ?? t.assessments_done_count ?? 0),
			averagePercentage: Number(t.averagePercentage ?? t.average_percentage ?? 0),
			bestAttempt: this.normalizeAccountAttempt(t.bestAttempt || t.best_attempt),
			sectionStats: {
				normal: r("normal"),
				exam: r("exam"),
				combined: r("combined")
			},
			courseStats: (t.courseStats || t.course_stats || []).map((e) => ({
				area: String(e.area || "Unknown course").trim(),
				attempts: Number(e.attempts || 0),
				quizzesDone: Number(e.quizzesDone ?? e.quizzes_done ?? e.assessmentsDone ?? e.assessments_done ?? 0),
				averagePercentage: Number(e.averagePercentage ?? e.average_percentage ?? 0),
				bestAttempt: this.normalizeAccountAttempt(e.bestAttempt || e.best_attempt)
			})).sort((e, t) => t.averagePercentage - e.averagePercentage || this.compareDisplayOrder(e.area, t.area)),
			recentAttempts: i.map((e) => this.normalizeAccountAttempt(e)).filter(Boolean).slice(0, 10)
		};
	},
	async loadAccountPage(e = !1) {
		return this.loadScopedRouteData({
			cacheName: "accountByKey",
			cacheKey: "first-page",
			rpcName: "app_account_page",
			params: { p_limit: 10 },
			label: "Loading account",
			force: e,
			normalize: (e) => this.normalizeAccountPage(e)
		});
	},
	async loadQuizSearchPage(e, t = !1) {
		let n = String(e ?? "").trim(), r = this.normalizeSearchText ? this.normalizeSearchText(n) : n.toLowerCase(), i = Number(this.routeDataGeneration || 0), a = await this.loadScopedRouteData({
			cacheName: "searchByQuery",
			cacheKey: r,
			rpcName: "app_quiz_search",
			params: {
				p_query: r,
				p_limit: r ? 18 : 12
			},
			label: "Searching assessments",
			force: t,
			normalize: (e) => ({
				displayQuery: n,
				browseMode: !!(e.browseMode ?? e.browse_mode ?? !n),
				totalItems: Number(e.totalItems ?? e.total_items ?? 0),
				totalMatches: Number(e.totalMatches ?? e.total_matches ?? 0),
				results: (Array.isArray(e.results) ? e.results : []).map((e) => ({
					quizId: e.quizId || e.quiz_id || "",
					level: String(e.level || "").trim(),
					area: String(e.area || "").trim(),
					sub: String(e.sub || "").trim(),
					type: e.type === "tf" || e.question_type === "tf" ? "tf" : "sba",
					title: String(e.title || e.quiz_title || "").trim(),
					count: Number(e.count ?? e.questionCount ?? e.question_count ?? 0)
				})).filter((e) => e.quizId && e.title)
			})
		});
		return Number(this.routeDataGeneration || 0) === i && a.results.forEach((e) => {
			this.registerQuizDescriptor({
				level: e.level,
				quizId: e.quizId,
				area: e.area,
				sub: e.sub,
				type: e.type,
				title: e.title,
				count: e.count
			});
		}), a;
	},
	applyQuizContextPayload(e) {
		if (!e || Array.isArray(e) || typeof e != "object" || Number(e.schemaVersion) !== 1) throw Error("Quiz context returned an invalid response.");
		let t = e.descriptor;
		if (!t || typeof t != "object") return null;
		let n = t.quiz_id || t.quizId || "", r = this.registerQuizDescriptor({
			quizId: n,
			level: t.level,
			area: t.area,
			sub: t.sub,
			type: t.question_type || t.type,
			title: t.quiz_title || t.title,
			count: t.question_count ?? t.count
		});
		if (r) {
			let t = (Array.isArray(e.siblings) ? e.siblings : []).map((e) => ({
				quizId: e.quizId || e.quiz_id || "",
				title: String(e.title || e.quiz_title || "").trim()
			})).filter((e) => e.quizId && e.title).sort((e, t) => this.compareDisplayOrder(e.title, t.title));
			r.quizIndex = Math.max(1, t.findIndex((e) => e.quizId === n) + 1);
		}
		return r;
	},
	async loadQuizDescriptorsByIds(e, t = "Loading quiz details") {
		let n = [...new Set((e || []).filter(Boolean))].filter((e) => !this.state.quizDetailsById[e]);
		n.length && await Promise.all(n.map(async (e) => {
			let { data: n, error: r } = await this.withTimeout(this.getSupabase().rpc("app_quiz_context", { p_quiz_id: e }), 12e3, t);
			if (r) throw r;
			this.applyQuizContextPayload(n);
		}));
	},
	async ensureQuizContextFromId(e) {
		if (!e) return !1;
		this.state.quizDetailsById[e] || await this.loadQuizDescriptorsByIds([e]);
		let t = this.state.quizDetailsById[e];
		return t ? (this.state.currentQuizId = t.quizId, this.state.currentLevel = t.level, this.state.currentArea = t.area, this.state.currentSub = t.sub, this.state.currentType = t.type, this.state.currentQuizTitle = t.title, !0) : !1;
	},
	buildAttemptsSignature(e) {
		return (e || []).map((e) => [
			e?.id ? `id:${e.id}` : "",
			e?.quizId || "",
			e?.mode || "",
			Number(e?.score || 0),
			Number(e?.totalQuestions || 0),
			Number(e?.correctCount || 0),
			Number(e?.wrongCount || 0),
			Number(e?.unansweredCount || 0),
			Number(e?.percentage || 0),
			e?.completedAt || ""
		].join("|||")).join("::::");
	},
	invalidateAttemptDerivedCaches() {
		this.routeDataGeneration += 1, this.state.subtopicProgressByArea = {}, this.state.accountSummary = null, this.state.quizAttemptSummariesById = {};
		let e = this.ensureRouteDataState();
		e.yearByLevel = {}, e.coursesByLevel = {}, e.subtopicsByCourse = {}, e.typesBySubtopic = {}, e.quizzesByType = {}, e.accountByKey = {};
	},
	invalidatePastPaperDerivedCaches() {
		this.routeDataGeneration += 1;
		let e = this.ensureRouteDataState();
		e.yearByLevel = {}, e.accountByKey = {};
		let t = this.getPastPaperState?.();
		t && (t.yearsLoaded = !1, t.topicsByYear = {}, t.examsByTopic = {});
	},
	invalidateHomeDashboardData() {
		this.homeBootstrapLoadedThisPage = !1, this.state.homeDashboard = {
			loaded: !1,
			generatedAt: "",
			stats: null,
			levelProgressByName: {}
		}, this.clearPersistedAppDataCache?.();
	},
	setAttemptsData(e) {
		let t = this.normalizeAttempts(e), n = this.buildAttemptsSignature(t), r = n !== this.state.attemptsSignature;
		this.state.attempts = t, this.state.attemptsSignature = n, this.state.attemptsByQuizId = this.groupAttemptsByQuizId(t), this.state.userStats = this.buildUserStats(t, this.state.pastPaperAttempts || []), r && !this.restoringAppDataCache && this.invalidateAttemptDerivedCaches(), this.scheduleAppDataCacheWrite();
	},
	setPastPaperAttemptsData(e) {
		let t = /* @__PURE__ */ new Set();
		this.state.pastPaperAttempts = (e || []).filter((e) => {
			let n = String(e?.id || `past_paper:${e?.setId || ""}:${e?.completedAt || ""}`);
			return t.has(n) ? !1 : (t.add(n), !0);
		}).sort((e, t) => new Date(t?.completedAt || 0).getTime() - new Date(e?.completedAt || 0).getTime()), this.state.userStats = this.buildUserStats(this.state.attempts || [], this.state.pastPaperAttempts), this.state.accountSummary = null, this.scheduleAppDataCacheWrite();
	},
	normalizeAttempts(e) {
		let t = /* @__PURE__ */ new Set();
		return (e || []).filter((e) => {
			let n = e?.id ? `id:${e.id}` : [
				e?.quizId || "",
				e?.mode || "",
				e?.completedAt || "",
				e?.score || 0,
				e?.percentage || 0
			].join("|||");
			return t.has(n) ? !1 : (t.add(n), !0);
		}).sort((e, t) => new Date(t?.completedAt || 0).getTime() - new Date(e?.completedAt || 0).getTime());
	},
	groupAttemptsByQuizId(e) {
		let t = {};
		return (e || []).forEach((e) => {
			t[e.quizId] || (t[e.quizId] = []), t[e.quizId].push(e);
		}), t;
	},
	getQuizDescriptorById(e) {
		return this.state.quizDetailsById[e] || null;
	},
	getAttemptsForQuizId(e) {
		return this.state.attemptsByQuizId[e] || [];
	},
	getAttemptStatsForQuizId(e) {
		let t = this.getAttemptsForQuizId(e);
		if (!t.length) return null;
		let n = (e) => {
			let n = t.filter((t) => t.mode === e);
			return n.length ? {
				latest: n[0],
				best: n.reduce((e, t) => !e || t.percentage > e.percentage || t.percentage === e.percentage && t.score > e.score ? t : e, null),
				attempts: n.length
			} : null;
		};
		return {
			totalAttempts: t.length,
			latest: t[0],
			study: n("study"),
			exam: n("exam")
		};
	},
	formatModeLabel(e) {
		return e === "exam" ? "Exam" : "Study";
	},
	formatQuizSettingsLabel(e) {
		let t = this.normalizeQuizDurationMinutes(e?.context?.durationMinutes), n = e?.negativeMarking ?? e?.context?.negativeMarking ?? e?.mode === "exam";
		return `${t ? `${t} min` : "No time"} · ${n ? "Negative marking" : "Standard marking"}`;
	},
	formatAttemptScore(e) {
		return e ? `${e.score}/${e.totalQuestions} (${e.percentage}%)` : "No attempts";
	},
	formatDateTime(e) {
		if (!e) return "Unknown date";
		let t = new Date(e);
		return Number.isNaN(t.getTime()) ? "Unknown date" : new Intl.DateTimeFormat(void 0, {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(t);
	},
	registerQuizDescriptor({ quizId: e, level: t, area: n, sub: r, type: i, title: a, count: o, quizIndex: s }) {
		if (!e) return null;
		let c = String(t || "").trim() || "Unknown level", l = String(n || "").trim() || "Unknown course", u = String(r || "").trim() || "Unknown module", d = i === "tf" ? "tf" : "sba", f = String(a || "").trim() || "Review Quiz", p = Number(o || 0);
		return this.state.quizMap[this.buildQuizKey(c, l, u, d, f)] = {
			id: e,
			count: p
		}, this.state.quizDetailsById[e] = {
			level: c,
			area: l,
			sub: u,
			type: d,
			title: f,
			quizId: e,
			count: p,
			quizIndex: Math.max(1, Number(s || 1))
		}, this.state.quizDetailsById[e];
	},
	calculateAveragePercentage(e) {
		if (!e.length) return 0;
		let t = e.reduce((e, t) => e + Number(t.percentage || 0), 0);
		return Math.round(t / e.length);
	},
	buildUserStats(e, t = []) {
		let n = (e || []).map((e) => ({
			...e,
			assessmentKind: "quiz",
			section: "normal"
		})), r = (t || []).map((e) => ({
			...e,
			assessmentKind: "past_paper",
			section: "exam",
			mode: "exam"
		})), i = [...n, ...r].sort((e, t) => new Date(t?.completedAt || 0).getTime() - new Date(e?.completedAt || 0).getTime()), a = /* @__PURE__ */ new Set(), o = {
			study: [],
			exam: []
		}, s = {};
		i.forEach((e) => {
			e.assessmentKind === "past_paper" && e?.setId ? a.add(`past_paper:${e.setId}`) : e?.quizId && a.add(`quiz:${e.quizId}`), e.assessmentKind === "quiz" && o[e.mode] && o[e.mode].push(e);
			let t = this.getQuizDescriptorById(e.quizId), n = e.level || t?.level || "", r = e.area || t?.area || "Unknown course", i = n ? `${n} - ${r}` : r;
			s[i] || (s[i] = []), s[i].push(e);
		});
		let c = i.reduce((e, t) => !e || t.percentage > e.percentage || t.percentage === e.percentage && t.score > e.score ? t : e, null), l = Object.entries(s).map(([e, t]) => ({
			area: e,
			attempts: t.length,
			quizzesDone: new Set(t.map((e) => e.assessmentKind === "past_paper" ? e.setId ? `past_paper:${e.setId}` : "" : e.quizId ? `quiz:${e.quizId}` : "").filter(Boolean)).size,
			averagePercentage: this.calculateAveragePercentage(t),
			bestAttempt: t.reduce((e, t) => !e || t.percentage > e.percentage || t.percentage === e.percentage && t.score > e.score ? t : e, null)
		})).sort((e, t) => t.averagePercentage === e.averagePercentage ? this.compareDisplayOrder(e.area, t.area) : t.averagePercentage - e.averagePercentage);
		return {
			attemptsCount: i.length,
			quizzesDoneCount: a.size,
			averagePercentage: this.calculateAveragePercentage(i),
			bestAttempt: c,
			sectionStats: {
				normal: {
					attemptsCount: n.length,
					assessmentsDoneCount: new Set(n.map((e) => e.quizId).filter(Boolean)).size,
					averagePercentage: this.calculateAveragePercentage(n)
				},
				exam: {
					attemptsCount: r.length,
					assessmentsDoneCount: new Set(r.map((e) => e.setId).filter(Boolean)).size,
					averagePercentage: this.calculateAveragePercentage(r)
				},
				combined: {
					attemptsCount: i.length,
					assessmentsDoneCount: a.size,
					averagePercentage: this.calculateAveragePercentage(i)
				}
			},
			modeStats: {
				study: {
					attemptsCount: o.study.length,
					averagePercentage: this.calculateAveragePercentage(o.study)
				},
				exam: {
					attemptsCount: o.exam.length,
					averagePercentage: this.calculateAveragePercentage(o.exam)
				}
			},
			courseStats: l,
			recentAttempts: i.slice(0, 10)
		};
	},
	async getQuizAttemptSummary(e, t = !1) {
		if (!e) return null;
		if (!t && this.state.quizAttemptSummariesById[e]) return this.state.quizAttemptSummariesById[e];
		let { data: n, error: r } = await this.withTimeout(this.getSupabase().rpc("app_quiz_attempt_summary", { p_quiz_id: e }), 12e3, "Loading quiz attempt summary");
		if (r) throw r;
		return this.state.quizAttemptSummariesById[e] = n || null, this.state.quizAttemptSummariesById[e];
	},
	getCachedQuizAttemptCount(e) {
		let t = this.state.quizAttemptSummariesById[e]?.totalAttempts;
		if (t != null && Number.isFinite(Number(t))) return Number(t);
		for (let t of Object.values(this.state.routeData?.quizzesByType || {})) {
			let n = t?.quizzes?.find((t) => t.id === e);
			if (n) return Number(n.totalAttempts || 0);
		}
		let n = this.getAttemptsForQuizId(e);
		return n.length ? n.length : null;
	},
	async saveAttemptRecord(e) {
		let t = this.state.currentUser?.id;
		if (!t) return {
			success: !1,
			error: /* @__PURE__ */ Error("No active user.")
		};
		let n = this.getCachedQuizAttemptCount(e.quizId), { data: r, error: i } = await this.withTimeout(this.getSupabase().from("quiz_attempts").insert({
			user_id: t,
			quiz_id: e.quizId,
			mode: e.mode,
			score: e.score,
			total_questions: e.totalQuestions,
			correct_count: e.correctCount,
			wrong_count: e.wrongCount,
			unanswered_count: e.unansweredCount,
			percentage: e.percentage
		}).select("id, user_id, quiz_id, mode, score, total_questions, correct_count, wrong_count, unanswered_count, percentage, completed_at").single(), 12e3, "Saving quiz result");
		if (i) return {
			success: !1,
			error: i
		};
		let a = {
			id: r.id,
			userId: r.user_id,
			quizId: r.quiz_id,
			mode: r.mode === "exam" ? "exam" : "study",
			score: Number(r.score || 0),
			totalQuestions: Number(r.total_questions || 0),
			correctCount: Number(r.correct_count || 0),
			wrongCount: Number(r.wrong_count || 0),
			unansweredCount: Number(r.unanswered_count || 0),
			percentage: Number(r.percentage || 0),
			completedAt: r.completed_at || ""
		};
		this.setAttemptsData([a, ...this.state.attempts]), this.state.accountSummary = null, delete this.state.quizAttemptSummariesById[e.quizId], this.invalidateHomeDashboardData();
		let o = n === null ? null : n + 1;
		if (o === null) try {
			let t = await this.getQuizAttemptSummary(e.quizId, !0);
			o = Number(t?.totalAttempts || 1);
		} catch (t) {
			console.error("Quiz attempt count refresh failed:", t), o = this.getAttemptsForQuizId(e.quizId).length || 1;
		}
		return {
			success: !0,
			attempt: a,
			attemptCount: o
		};
	},
	async resetAccountData() {
		let e = this.state.currentUser?.id;
		if (!e || !await E({
			title: "Reset account history",
			message: "This will delete your saved quiz and exam attempts, drafts, and performance stats.",
			submitLabel: "Reset account",
			danger: !0
		})) return;
		let t = this.dom.settingsResetAccountBtn;
		t && (t.disabled = !0, t.textContent = "Resetting...");
		try {
			this.cancelPendingAssessmentProgressWrites(), await this.assessmentProgressWriteQueue.catch(() => void 0);
			let t = await this.withTimeout(this.getSupabase().rpc("app_reset_account_history"), 12e3, "Resetting account history");
			if (t.error && this.isRpcUnavailable(t.error)) {
				let [t, n] = await Promise.all([this.withTimeout(this.getSupabase().from("quiz_attempts").delete().eq("user_id", e), 12e3, "Resetting quiz history"), this.withTimeout(b(this.getSupabase(), e), 12e3, "Resetting saved progress")]);
				if (t.error) throw t.error;
				if (n.error) throw n.error;
			} else if (t.error) throw t.error;
			this.setAttemptsData([]), this.setPastPaperAttemptsData([]), this.invalidateAttemptDerivedCaches(), this.invalidatePastPaperDerivedCaches(), this.invalidateHomeDashboardData(), this.state.accountSummary = null, this.state.quizAttemptSummariesById = {}, this.showToast("Account history reset."), this.router();
		} catch (e) {
			if (console.error("Account reset failed:", e), await this.handleAccessRestriction(e)) return;
			this.showToast("Account reset failed.");
		} finally {
			t && (t.disabled = !1, t.textContent = "Reset Account");
		}
	},
	getAreaCacheKey(e, t) {
		return `${e}|||${t}`;
	},
	getModuleCacheKey(e, t, n) {
		return `${e}|||${t}|||${n}`;
	},
	buildQuizKey(e, t, n, r, i) {
		return `${e}|||${t}|||${n}|||${r}|||${i}`;
	},
	getCurrentQuizMeta() {
		if (this.state.currentQuizId && this.state.quizDetailsById[this.state.currentQuizId]) {
			let e = this.state.quizDetailsById[this.state.currentQuizId];
			return {
				id: e.quizId,
				count: e.count
			};
		}
		return this.state.quizMap[this.buildQuizKey(this.state.currentLevel, this.state.currentArea, this.state.currentSub, this.state.currentType, this.state.currentQuizTitle)] || null;
	},
	getCurrentQuizIndex(e = this.state.currentType) {
		let t = this.state.quizDetailsById[this.state.currentQuizId], n = Number(t?.quizIndex || 0);
		if (n > 0) return n;
		let r = this.state.quizzesByModule[this.getModuleCacheKey(this.state.currentLevel, this.state.currentArea, this.state.currentSub)] || {}, i = Object.entries(r?.[e] || {}).sort(([e], [t]) => this.compareDisplayOrder(e, t)).map(([e, t]) => ({
			...t,
			title: e
		}));
		return Math.max(0, i.findIndex((e) => e.id === this.state.currentQuizId || e.title === this.state.currentQuizTitle)) + 1;
	},
	normalizeQuizQuestionRows(e, t = this.state.currentType) {
		let n = t === "tf" ? "tf" : "sba";
		return (Array.isArray(e) ? e : []).map((e) => {
			let t = [
				e.option_a,
				e.option_b,
				e.option_c,
				e.option_d,
				e.option_e
			].filter((e) => e && String(e).trim()).map((e) => String(e).trim()), r = n === "tf" ? this.normalizeTfAnswer(e.correct_answer) : this.normalizeSbaAnswer(e.correct_answer, t);
			return {
				key: this.buildQuestionIdentity(e, n, t, r),
				q: String(e.question_text || "").trim(),
				a: r,
				exp: e.explanation ? String(e.explanation).trim() : "",
				img: e.image_url ? String(e.image_url).trim() : "",
				options: n === "sba" ? t : null,
				type: n
			};
		});
	},
	showFatalLoadError() {
		this.showOnly("loading-view"), this.dom.loadingView && (this.dom.loadingView.setAttribute("aria-busy", "false"), this.dom.loadingView.innerHTML = "\n      <div class=\"load-error-card\" role=\"alert\">\n        <h2>Couldn't connect</h2>\n        <p>Check your internet connection and try again.</p>\n        <button id=\"btn-retry-load\" class=\"load-error-retry-btn\" type=\"button\">Retry</button>\n      </div>\n    ", document.getElementById("btn-retry-load")?.addEventListener("click", (e) => {
			let t = e.currentTarget;
			t.disabled = !0, t.textContent = "Retrying…", this.dom.loadingView.setAttribute("aria-busy", "true"), window.location.reload();
		}));
	},
	escapeHtml(e) {
		return String(e ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
	},
	normalizeText(e) {
		return String(e ?? "").trim().replace(/\s+/g, " ").toLowerCase();
	},
	normalizeTfAnswer(e) {
		let t = this.normalizeText(e);
		return t ? [
			"true",
			"t",
			"1",
			"yes"
		].includes(t) ? "TRUE" : [
			"false",
			"f",
			"0",
			"no"
		].includes(t) ? "FALSE" : t.toUpperCase() : "";
	},
	buildQuestionIdentity(e, t, n, r) {
		let i = e?.question_id ?? e?.id ?? e?.quiz_question_id;
		return i != null && String(i).trim() ? `id:${String(i).trim()}` : [
			t || "",
			this.normalizeText(e?.question_text || ""),
			r || "",
			this.normalizeText(e?.explanation || ""),
			String(e?.image_url || "").trim(),
			(n || []).map((e) => this.normalizeText(e)).join("|")
		].join("|||");
	},
	buildQuestionFieldName(e) {
		return `q${e}`;
	},
	shuffleArray(e) {
		let t = [...e || []];
		for (let e = t.length - 1; e > 0; --e) {
			let n = Math.floor(Math.random() * (e + 1));
			[t[e], t[n]] = [t[n], t[e]];
		}
		return t;
	},
	getQuizSessionQuestions(e, t = null) {
		let n = Array.isArray(e) ? [...e] : [], r = this.state.currentType === "tf" || this.state.currentType === "sba" ? this.state.currentType : "";
		if (!n.length || !r) return n;
		let i = Array.isArray(t?.questionOrder) ? t.questionOrder : null, a = new Map(n.map((e) => [e.key, e]));
		return i?.length === n.length && i.every((e) => a.has(e)) ? i.map((e) => a.get(e)) : t?.answers && !i?.length ? n : this.shuffleArray(n);
	},
	normalizeSbaAnswer(e, t) {
		let n = String(e ?? "").trim();
		if (!n) return "";
		let r = n.toUpperCase();
		if (/^[A-E]$/.test(r)) return r;
		let i = this.normalizeText(n), a = [
			"A",
			"B",
			"C",
			"D",
			"E"
		];
		for (let e = 0; e < (t || []).length; e += 1) if (this.normalizeText(t[e]) === i) return a[e];
		let o = r.match(/\b([A-E])\b/);
		return o ? o[1] : r.charAt(0);
	},
	getTypeMeta(e) {
		return h[e] || h.sba;
	},
	getTypePresentation(e) {
		return e === "tf" ? {
			modeTag: "Speed",
			selectionDescription: "Binary format / fast recall",
			listDescription: "Speed format / binary answers"
		} : {
			modeTag: "Precision",
			selectionDescription: "Five-option MCQ / A-E format",
			listDescription: "Precision format / five-option answers"
		};
	},
	getPreferredAttemptForDisplay(e) {
		if (!e) return null;
		let t = [e.study?.best ? {
			...e.study.best,
			mode: "study"
		} : null, e.exam?.best ? {
			...e.exam.best,
			mode: "exam"
		} : null].filter(Boolean);
		return t.length ? t.reduce((e, t) => !e || Number(t.percentage || 0) > Number(e.percentage || 0) || Number(t.percentage || 0) === Number(e.percentage || 0) && Number(t.correctCount || 0) > Number(e.correctCount || 0) ? t : e, null) : e.latest || null;
	},
	getBrowseToneClass(e) {
		return `tone-${e % 4 + 1}`;
	},
	getTimeGreeting() {
		let e = (/* @__PURE__ */ new Date()).getHours();
		return e < 12 ? "Good morning," : e < 18 ? "Good afternoon," : "Good evening,";
	},
	getBrowseMetaIcon(e = "book") {
		return e === "attempt" ? "\n        <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n          <path d=\"M12 6v6l4 2\"></path>\n          <circle cx=\"12\" cy=\"12\" r=\"9\"></circle>\n        </svg>\n      " : e === "chapter" ? "\n        <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n          <path d=\"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z\"></path>\n          <path d=\"M13 2v7h7\"></path>\n        </svg>\n      " : "\n      <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n        <path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20\"></path>\n        <path d=\"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z\"></path>\n      </svg>\n    ";
	},
	buildBrowseCardMarkup({ badge: e, title: t, kickerLabel: n = "", toneClass: r, statusLabel: i, statusClass: a, metaKind: o = "book", metaLabel: s = "", progressPercent: c = 0, progressLabel: l = "", secondaryMetaText: u = "", metricValue: d = "", metricLabel: f = "", locked: p = !1, lockedLabel: m = "Available soon" }) {
		let h = Math.max(0, Math.min(100, Number(c || 0))), g = !!o, _ = p ? !!s : !!s || !!u, v = !!d || !!f, y = !p && !!l && h > 0, b = v ? "browse-card-metric" : "browse-card-metric is-empty", x = y ? "browse-card-progress" : p ? "browse-card-progress is-empty" : "browse-card-progress is-ghost", S = y ? h : 0, C = l || `${y ? h : 0}%`, w = _ ? "browse-card-meta" : "browse-card-meta is-empty", T = [
			"browse-card-trailing",
			v ? "" : "is-arrow-only",
			p ? "has-hidden-action" : ""
		].filter(Boolean).join(" ");
		return `
      <div class="browse-card ${this.escapeHtml(r || "tone-1")} ${p ? "locked" : ""}">
        <div class="browse-card-inner browse-card-row">
          <div class="browse-card-badge browse-card-index">${this.escapeHtml(e)}</div>
          <div class="browse-card-content browse-card-main">
            <div class="browse-card-topline">
              ${n ? `
                <span class="browse-card-num">${this.escapeHtml(n)}</span>
              ` : ""}
              <div class="browse-status-badge ${this.escapeHtml(a || "status-fresh")}">
                ${p ? "\n                  <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                    <rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"></rect>\n                    <path d=\"M7 11V7a5 5 0 0 1 10 0v4\"></path>\n                  </svg>\n                " : ""}
                ${this.escapeHtml(i)}
              </div>
            </div>
            <div class="browse-card-name browse-card-title">${this.escapeHtml(t)}</div>
            <div class="${w}">
              ${s ? `
                <span class="browse-meta-item ${g ? "" : "is-plain"}">
                  ${g ? this.getBrowseMetaIcon(o) : ""}
                  ${this.escapeHtml(s)}
                </span>
              ` : ""}
              ${!p && u ? `
                <span class="browse-meta-item is-plain">${this.escapeHtml(u)}</span>
              ` : ""}
            </div>
            <div class="${x}" aria-hidden="true">
              <div class="browse-card-progress-track">
                <div class="browse-card-progress-fill" style="width:${S}%"></div>
              </div>
              <span class="browse-card-progress-percent">${this.escapeHtml(C)}</span>
            </div>
          </div>
          <div class="${T}">
            <div class="${b}">
              ${f ? `
                <div class="browse-card-metric-label">${this.escapeHtml(f)}</div>
              ` : ""}
              ${d ? `
                <div class="browse-card-metric-value">${this.escapeHtml(d)}</div>
              ` : ""}
            </div>
            <div class="browse-card-chevron ${p ? "is-hidden" : ""}">
              ${p ? "" : "\n                <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                  <path d=\"M9 18l6-6-6-6\"></path>\n                </svg>\n              "}
            </div>
          </div>
        </div>
      </div>
    `;
	},
	buildDashboardDisplayLevels() {
		let e = Object.fromEntries(this.state.levelList.map((e) => [e.name, e])), t = Object.fromEntries((this.state.pastPapers?.years || []).map((t) => [t.yearLabel, {
			id: "",
			name: t.yearLabel,
			displayOrder: 0,
			locked: !1,
			pastPaperOnly: !e[t.yearLabel]
		}])), n = this.state.levelList.reduce((e, t) => {
			let n = Number(String(t.name).match(/\d+/)?.[0] || 0);
			return Math.max(e, n);
		}, 0), r = (this.state.pastPapers?.years || []).reduce((e, t) => {
			let n = Number(String(t.yearLabel).match(/\d+/)?.[0] || 0);
			return Math.max(e, n);
		}, 0), i = Math.max(5, n, r, this.state.levelList.length || 0);
		return Array.from({ length: i }, (n, r) => {
			let i = `Year ${r + 1}`;
			return e[i] || t[i] || {
				id: "",
				name: i,
				displayOrder: r + 1,
				locked: !0
			};
		});
	},
	getDefaultLevelProgressSummary(e) {
		return {
			doneCount: 0,
			totalCount: 0,
			courseCount: (this.state.areasByLevel[e?.name] || []).length,
			percent: 0
		};
	},
	renderDashboardLevelCard(e, t, n, r = null) {
		let i = t.name, a = !!t.locked, o = this.getPastPaperYearSummary?.(i), s = r || this.getDefaultLevelProgressSummary(t), c = !a && s.totalCount > 0 && s.doneCount === s.totalCount, l = String(i).match(/\d+/)?.[0] || String(n + 1);
		e.className = "browse-card-button", e.innerHTML = this.buildBrowseCardMarkup({
			badge: `Y${l}`,
			title: i,
			kickerLabel: "",
			toneClass: this.getBrowseToneClass(n),
			statusLabel: a ? "Locked" : c ? "Done" : s.doneCount ? "Active" : "New",
			statusClass: a ? "status-locked" : c ? "status-complete" : s.doneCount ? "status-active" : "status-fresh",
			metaKind: a ? "" : "book",
			metaLabel: a ? "" : o && !s.courseCount ? `${o.examCount} past paper${o.examCount === 1 ? "" : "s"}` : `${s.courseCount} course${s.courseCount === 1 ? "" : "s"}`,
			progressPercent: a ? 0 : s.percent,
			progressLabel: a ? "" : s.doneCount ? `${s.doneCount}/${s.totalCount}` : "",
			secondaryMetaText: "",
			metricValue: a ? "Soon" : s.doneCount ? `${s.doneCount}/${s.totalCount}` : "",
			metricLabel: a ? "opens later" : s.doneCount ? "quizzes done" : "",
			locked: a,
			lockedLabel: "Available soon"
		}), e.onclick = a ? null : () => this.navigate("year", { year: i });
	},
	renderAreaBrowseCard(e, t, n, r, i = null) {
		let a = i || {
			doneCount: 0,
			totalCount: 0,
			moduleCount: 0,
			percent: 0
		}, o = a.totalCount > 0 && a.doneCount === a.totalCount, s = String(n.name).split(/\s+/).filter(Boolean).slice(0, 2).map((e) => e.charAt(0).toUpperCase()).join("");
		e.className = "browse-card-button", e.innerHTML = this.buildBrowseCardMarkup({
			badge: s || `C${r + 1}`,
			title: n.name,
			kickerLabel: "",
			toneClass: this.getBrowseToneClass(r),
			statusLabel: o ? "Done" : a.doneCount ? "Active" : "New",
			statusClass: o ? "status-complete" : a.doneCount ? "status-active" : "status-fresh",
			metaKind: a.moduleCount ? "chapter" : "",
			metaLabel: a.moduleCount ? `${a.moduleCount} chapter${a.moduleCount === 1 ? "" : "s"}` : "",
			progressPercent: a.percent,
			progressLabel: a.doneCount ? `${a.doneCount}/${a.totalCount}` : "",
			metricValue: a.doneCount ? `${a.doneCount}/${a.totalCount}` : "",
			metricLabel: a.doneCount ? "quizzes done" : ""
		}), e.onclick = () => this.navigate("subtopics", {
			level: t,
			area: n.name
		});
	},
	renderSubtopicBrowseCard(e, t, n, r = null) {
		let i = r || {
			doneCount: 0,
			totalCount: 0
		}, a = String(t.name).split(/\s+/).filter(Boolean).slice(0, 2).map((e) => e.charAt(0).toUpperCase()).join(""), o = i.totalCount ? Math.round(i.doneCount / i.totalCount * 100) : 0, s = i.doneCount === i.totalCount && i.totalCount;
		e.className = "browse-card-button", e.innerHTML = this.buildBrowseCardMarkup({
			badge: a || `C${n + 1}`,
			title: t.name,
			kickerLabel: "",
			toneClass: this.getBrowseToneClass(n),
			statusLabel: i.doneCount ? s ? "Done" : "Active" : "New",
			statusClass: i.doneCount ? s ? "status-complete" : "status-active" : "status-fresh",
			metaKind: "chapter",
			metaLabel: `${i.totalCount} assessment${i.totalCount === 1 ? "" : "s"}`,
			progressPercent: o,
			progressLabel: i.doneCount ? `${o}% complete` : "",
			secondaryMetaText: "",
			metricValue: i.doneCount && i.totalCount ? `${i.doneCount}/${i.totalCount}` : "",
			metricLabel: i.doneCount ? "done" : ""
		});
	},
	showToast(e) {
		this.dom.toast.textContent = e, this.dom.toast.classList.add("show"), clearTimeout(this._toastTimer), this._toastTimer = setTimeout(() => this.dom.toast.classList.remove("show"), 2200);
	},
	getStorageNamespace() {
		return `quiz-app:${this.state.currentUser?.id || "anonymous"}`;
	},
	getAssessmentProgressTimestamp(e) {
		let t = Date.parse(e?.savedAt || e?.updatedAt || "");
		return Number.isFinite(t) ? t : 0;
	},
	buildAssessmentProgressKey(e = {}) {
		let t = e.context || {}, n = e.mode === "exam" || t.mode === "exam" ? "exam" : "study", r = this.normalizeQuizDurationMinutes(e.durationMinutes ?? t.durationMinutes), i = !!(e.negativeMarking ?? t.negativeMarking);
		return [
			n,
			r ? `${r}m` : "no-time",
			i ? "negative" : "standard"
		].join("|");
	},
	chooseNewestAssessmentDraft(e, t) {
		return e ? t && this.getAssessmentProgressTimestamp(t) >= this.getAssessmentProgressTimestamp(e) ? t : e : t || null;
	},
	normalizeAccountAssessmentProgress(e) {
		if (!e || typeof e != "object") return null;
		let t = e.progress_data && typeof e.progress_data == "object" ? e.progress_data : {}, n = e.context && typeof e.context == "object" ? e.context : {};
		return {
			...t,
			context: {
				...n,
				mode: e.mode === "exam" ? "exam" : "study",
				durationMinutes: this.normalizeQuizDurationMinutes(e.duration_minutes),
				negativeMarking: !!e.negative_marking
			},
			durationMinutes: this.normalizeQuizDurationMinutes(e.duration_minutes),
			negativeMarking: !!e.negative_marking,
			progressKey: e.progress_key || "",
			timerExpiresAt: e.timer_expires_at || null,
			savedAt: e.updated_at || null
		};
	},
	handleAssessmentProgressError(e) {
		if (this.isRpcUnavailable(e)) {
			this.assessmentProgressUnavailable || console.warn("Account progress storage is unavailable; using the on-device fallback."), this.assessmentProgressUnavailable = !0;
			return;
		}
		console.error("Account progress sync failed:", e);
	},
	ensureAssessmentProgressState() {
		this.assessmentProgressCache || (this.assessmentProgressCache = {}), this.assessmentProgressLoadPromises || (this.assessmentProgressLoadPromises = {}), this.assessmentProgressPendingWrites || (this.assessmentProgressPendingWrites = {}), this.assessmentSettingsById || (this.assessmentSettingsById = {});
	},
	rememberAssessmentSettings(e, t, n = {}) {
		this.ensureAssessmentProgressState();
		let r = JSON.stringify([String(e || ""), String(t || "")]);
		this.assessmentSettingsById[r] = {
			durationMinutes: this.normalizeQuizDurationMinutes(n.durationMinutes),
			negativeMarking: !!n.negativeMarking
		};
		try {
			window.sessionStorage?.setItem(`${this.getStorageNamespace()}:assessment-settings:${encodeURIComponent(r)}`, JSON.stringify(this.assessmentSettingsById[r]));
		} catch {}
		return this.assessmentSettingsById[r];
	},
	getRememberedAssessmentSettings(e, t) {
		this.ensureAssessmentProgressState();
		let n = JSON.stringify([String(e || ""), String(t || "")]);
		if (this.assessmentSettingsById[n]) return this.assessmentSettingsById[n];
		try {
			let r = window.sessionStorage?.getItem(`${this.getStorageNamespace()}:assessment-settings:${encodeURIComponent(n)}`);
			if (!r) return null;
			let i = JSON.parse(r);
			return this.rememberAssessmentSettings(e, t, i);
		} catch {
			return null;
		}
	},
	getAssessmentProgressCacheKey(e, t, n = "") {
		return JSON.stringify([
			String(e || ""),
			String(t || ""),
			String(n || "")
		]);
	},
	getCachedAssessmentProgress(e, t, n = "") {
		this.ensureAssessmentProgressState();
		let r = this.getAssessmentProgressCacheKey(e, t, n);
		return Object.hasOwn(this.assessmentProgressCache, r) ? {
			hit: !0,
			value: this.assessmentProgressCache[r]
		} : {
			hit: !1,
			value: null
		};
	},
	cacheAssessmentProgress(e, t, n, r) {
		this.ensureAssessmentProgressState(), this.assessmentProgressCache[this.getAssessmentProgressCacheKey(e, t, n)] = r;
		let i = r?.progressKey || r?.progress_key || "";
		i && (this.assessmentProgressCache[this.getAssessmentProgressCacheKey(e, t, i)] = r);
	},
	invalidateAssessmentProgressCache(e, t) {
		this.ensureAssessmentProgressState(), Object.keys(this.assessmentProgressCache).forEach((n) => {
			try {
				let [r, i] = JSON.parse(n);
				r === String(e || "") && i === String(t || "") && delete this.assessmentProgressCache[n];
			} catch {
				delete this.assessmentProgressCache[n];
			}
		});
	},
	cancelPendingAssessmentProgressWrites(e = null, t = null, n = null) {
		this.assessmentProgressPendingWrites && Object.entries(this.assessmentProgressPendingWrites).forEach(([r, i]) => {
			let a = e === null;
			try {
				let [i, o, s] = JSON.parse(r);
				a = (e === null || i === String(e)) && (t === null || o === String(t)) && (n === null || s === String(n));
			} catch {
				a = e === null;
			}
			a && (i?.timer && window.clearTimeout(i.timer), i?.resolvers?.splice(0).forEach((e) => e()), delete this.assessmentProgressPendingWrites[r]);
		});
	},
	async loadAccountAssessmentProgress(e, t, n = "") {
		let r = this.state.currentUser?.id;
		if (!r || !e || !t || this.assessmentProgressUnavailable) return null;
		let i = this.getCachedAssessmentProgress(e, t, n);
		if (i.hit) return i.value;
		let a = this.getAssessmentProgressCacheKey(e, t, n);
		if (this.assessmentProgressLoadPromises[a]) return this.assessmentProgressLoadPromises[a];
		let o = this.assessmentProgressCache, s = (async () => {
			try {
				await this.assessmentProgressWriteQueue.catch(() => void 0);
				let { data: i, error: a } = await this.withTimeout(_(this.getSupabase(), r, e, t, n), 8e3, "Loading saved progress");
				if (a) throw a;
				let s = this.normalizeAccountAssessmentProgress(i);
				return this.assessmentProgressCache === o && this.cacheAssessmentProgress(e, t, n, s), s;
			} catch (e) {
				return this.handleAssessmentProgressError(e), null;
			}
		})();
		this.assessmentProgressLoadPromises[a] = s;
		try {
			return await s;
		} finally {
			this.assessmentProgressLoadPromises?.[a] === s && delete this.assessmentProgressLoadPromises[a];
		}
	},
	enqueueAssessmentProgressWrite(e) {
		let t = async () => {
			if (!this.assessmentProgressUnavailable) try {
				await e();
			} catch (e) {
				this.handleAssessmentProgressError(e);
			}
		};
		return this.assessmentProgressWriteQueue = this.assessmentProgressWriteQueue.then(t, t), this.assessmentProgressWriteQueue;
	},
	saveAccountAssessmentProgress(e, t, n) {
		let r = this.state.currentUser?.id;
		if (!r || !e || !t || !n) return Promise.resolve();
		let i = n.context || {}, a = this.normalizeQuizDurationMinutes(n.durationMinutes ?? i.durationMinutes), o = {
			mode: n.mode === "exam" || i.mode === "exam" ? "exam" : "study",
			durationMinutes: a,
			negativeMarking: !!(n.negativeMarking ?? i.negativeMarking),
			context: i,
			progressData: {
				answers: n.answers && typeof n.answers == "object" ? n.answers : {},
				questionOrder: Array.isArray(n.questionOrder) ? n.questionOrder : []
			},
			timerExpiresAt: n.timerExpiresAt || null
		};
		o.progressKey = this.buildAssessmentProgressKey(o), this.invalidateAssessmentProgressCache(e, t), this.cacheAssessmentProgress(e, t, o.progressKey, {
			...n,
			progressKey: o.progressKey
		}), this.ensureAssessmentProgressState();
		let s = this.getAssessmentProgressCacheKey(e, t, o.progressKey), c = this.assessmentProgressPendingWrites[s] || {
			resolvers: [],
			timer: null
		};
		c.timer && window.clearTimeout(c.timer), c.payload = o;
		let l = new Promise((e) => {
			c.resolvers.push(e);
		});
		return c.timer = window.setTimeout(async () => {
			delete this.assessmentProgressPendingWrites[s], await this.enqueueAssessmentProgressWrite(async () => {
				let { error: n } = await this.withTimeout(v(this.getSupabase(), r, e, t, c.payload), 8e3, "Saving progress");
				if (n) throw n;
			}), c.resolvers.splice(0).forEach((e) => e());
		}, 400), this.assessmentProgressPendingWrites[s] = c, l;
	},
	clearAccountAssessmentProgress(e, t, n = {}) {
		let r = this.state.currentUser?.id;
		if (!r || !e || !t) return Promise.resolve();
		let i = this.buildAssessmentProgressKey(n);
		return this.invalidateAssessmentProgressCache(e, t), this.ensureAssessmentProgressState(), this.cancelPendingAssessmentProgressWrites(e, t, i), this.enqueueAssessmentProgressWrite(async () => {
			let { error: n } = await this.withTimeout(y(this.getSupabase(), r, e, t, i), 8e3, "Clearing saved progress");
			if (n) throw n;
		});
	},
	buildQuizContextKey({ level: e, area: t, sub: n, type: r, title: i, mode: a, durationMinutes: o, negativeMarking: s }) {
		let c = [
			e || "",
			t || "",
			n || "",
			r || "",
			i || "",
			a || "study"
		];
		return a === "exam" && c.push(String(o || "")), c.push(s ? "negative" : "standard"), c.join("|||");
	},
	getCurrentQuizContext() {
		return {
			level: this.state.currentLevel,
			area: this.state.currentArea,
			sub: this.state.currentSub,
			type: this.state.currentType,
			title: this.state.currentQuizTitle,
			mode: this.state.mode,
			durationMinutes: this.state.currentExamDurationMinutes,
			negativeMarking: this.state.negativeMarking
		};
	},
	normalizeQuizDurationMinutes(e) {
		if (e == null || String(e).trim() === "") return null;
		let t = Number.parseInt(String(e ?? ""), 10);
		return !Number.isFinite(t) || t <= 0 ? null : Math.min(30, Math.max(5, t));
	},
	formatQuizTimer(e) {
		let t = Math.max(0, Number.parseInt(e, 10) || 0), n = Math.floor(t / 60), r = t % 60;
		return `${String(n).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
	},
	async openQuizSettings(e) {
		let t = typeof e == "string" ? e : e?.id;
		if (!t || !await this.ensureQuizContextFromId(t)) return;
		let n = this.getCurrentQuizMeta(), r = this.getRememberedAssessmentSettings("quiz", t), i = r ? null : await this.loadAccountAssessmentProgress("quiz", t), a = await D({
			title: this.state.currentQuizTitle || "Start quiz",
			submitLabel: "Start quiz",
			cancelLabel: "Cancel",
			min: 5,
			max: 30,
			initial: r?.durationMinutes || i?.durationMinutes || null,
			negativeMarking: !!(r?.negativeMarking ?? i?.negativeMarking)
		});
		if (!a || !n) return;
		let o = this.normalizeQuizDurationMinutes(a.durationMinutes), s = !!a.negativeMarking, c = o || s ? "exam" : "study";
		this.rememberAssessmentSettings("quiz", t, {
			durationMinutes: o,
			negativeMarking: s
		}), await this.navigate("quiz", {
			quizId: n.id,
			mode: c,
			duration: o || "",
			negativeMarking: s
		});
	},
	stopQuizCountdown() {
		this.quizCountdownInterval && (window.clearInterval(this.quizCountdownInterval), this.quizCountdownInterval = null), this.quizCountdownDeadline = 0;
	},
	updateQuizTimerUI() {
		let e = this.normalizeQuizDurationMinutes(this.state.currentExamDurationMinutes);
		if (!e) return;
		let t = e * 60, n = Number.isFinite(this.state.quizTimeRemainingSeconds) && this.state.quizTimeRemainingSeconds !== null ? this.state.quizTimeRemainingSeconds : t;
		this.dom.quizProgressCopy && (this.dom.quizProgressCopy.textContent = this.formatQuizTimer(n));
	},
	startQuizCountdown(e = null) {
		this.stopQuizCountdown();
		let t = this.normalizeQuizDurationMinutes(this.state.currentExamDurationMinutes);
		if (!t) return;
		this.state.currentExamDurationMinutes = t;
		let n = Date.parse(e?.timerExpiresAt || "");
		if (this.quizCountdownDeadline = Number.isFinite(n) ? n : Date.now() + t * 60 * 1e3, this.state.quizTimeRemainingSeconds = Math.max(0, Math.ceil((this.quizCountdownDeadline - Date.now()) / 1e3)), this.updateQuizTimerUI(), this.state.quizTimeRemainingSeconds <= 0) {
			window.setTimeout(() => {
				this.showToast("Time is up. Quiz submitted automatically."), this.handleSubmission({
					force: !0,
					timedOut: !0
				});
			}, 0);
			return;
		}
		this.quizCountdownInterval = window.setInterval(async () => {
			if (window.location.pathname !== "/quiz/") {
				this.stopQuizCountdown();
				return;
			}
			let e = Math.max(0, Math.ceil((this.quizCountdownDeadline - Date.now()) / 1e3));
			this.state.quizTimeRemainingSeconds = e, this.updateQuizTimerUI(), !(e > 0) && (this.stopQuizCountdown(), document.dispatchEvent(new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: !0
			})), this.showToast("Time is up. Quiz submitted automatically."), await this.handleSubmission({
				force: !0,
				timedOut: !0
			}));
		}, 250);
	},
	getQuizDraftStorageKey(e = this.getCurrentQuizContext()) {
		return `${this.getStorageNamespace()}:draft:${this.buildQuizContextKey(e)}`;
	},
	getQuizResultStorageKey(e = this.getCurrentQuizContext()) {
		return `${this.getStorageNamespace()}:result:${this.buildQuizContextKey(e)}`;
	},
	readStoredJson(e) {
		try {
			let t = window.localStorage.getItem(e);
			return t ? JSON.parse(t) : null;
		} catch (e) {
			return console.error("Storage read failed:", e), null;
		}
	},
	writeStoredJson(e, t) {
		try {
			window.localStorage.setItem(e, JSON.stringify(t));
		} catch (e) {
			console.error("Storage write failed:", e);
		}
	},
	removeStoredJson(e) {
		try {
			window.localStorage.removeItem(e);
		} catch (e) {
			console.error("Storage remove failed:", e);
		}
	},
	isQuizDraftForContext(e, t = this.getCurrentQuizContext()) {
		if (!e) return !1;
		let n = e.context || {};
		return (n.mode === "exam" ? "exam" : "study") === t.mode && this.normalizeQuizDurationMinutes(n.durationMinutes) === this.normalizeQuizDurationMinutes(t.durationMinutes) && !!n.negativeMarking == !!t.negativeMarking;
	},
	async loadQuizSessionPage(e) {
		let t = String(e || "").trim();
		if (!t) return null;
		let n = this.buildAssessmentProgressKey({
			mode: this.state.mode,
			durationMinutes: this.state.currentExamDurationMinutes,
			negativeMarking: this.state.negativeMarking
		}), r = this.getCachedAssessmentProgress("quiz", t, n), { data: i, error: a } = await this.withTimeout(this.getSupabase().rpc("app_quiz_session", {
			p_quiz_id: t,
			p_progress_key: r.hit ? null : n
		}), 12e3, "Loading quiz");
		if (a) throw a;
		if (!i || Array.isArray(i) || typeof i != "object" || Number(i.schemaVersion) !== 1 || !Array.isArray(i.questions)) throw Error("Quiz session returned an invalid response.");
		let o = this.applyQuizContextPayload(i);
		if (!o || o.quizId !== t) return null;
		this.state.currentQuizId = o.quizId, this.state.currentLevel = o.level, this.state.currentArea = o.area, this.state.currentSub = o.sub, this.state.currentType = o.type, this.state.currentQuizTitle = o.title, this.rememberAssessmentSettings("quiz", t, {
			durationMinutes: this.state.currentExamDurationMinutes,
			negativeMarking: this.state.negativeMarking
		});
		let s = this.normalizeQuizQuestionRows(i.questions, o.type);
		this.state.questionsByQuizId[t] = s;
		let c = r.value;
		r.hit || (c = this.normalizeAccountAssessmentProgress(i.progress), this.cacheAssessmentProgress("quiz", t, n, c));
		let l = this.getCurrentQuizContext(), u = this.readStoredJson(this.getQuizDraftStorageKey(l)), d = this.isQuizDraftForContext(u, l) ? u : null, f = this.isQuizDraftForContext(c, l) ? c : null, p = this.chooseNewestAssessmentDraft(d, f);
		return p === f && p && this.writeStoredJson(this.getQuizDraftStorageKey(l), p), {
			descriptor: o,
			questions: s,
			draft: p
		};
	},
	saveQuizDraft(e, t = this.getCurrentQuizContext()) {
		return this.writeStoredJson(this.getQuizDraftStorageKey(t), e), this.saveAccountAssessmentProgress("quiz", this.state.currentQuizId, e);
	},
	clearQuizDraft(e = this.getCurrentQuizContext()) {
		return this.removeStoredJson(this.getQuizDraftStorageKey(e)), this.clearAccountAssessmentProgress("quiz", this.state.currentQuizId, { context: e });
	},
	loadSavedQuizResult(e = this.getCurrentQuizContext()) {
		return this.readStoredJson(this.getQuizResultStorageKey(e));
	},
	saveQuizResultSnapshot(e, t = this.getCurrentQuizContext()) {
		this.writeStoredJson(this.getQuizResultStorageKey(t), e);
	},
	serializeQuizDraft() {
		let e = {};
		this.state.activeQuestions.forEach((t, n) => {
			let r = this.dom.quizForm.querySelector(`input[name="q${n}"]:checked`);
			r && (e[`q${n}`] = r.value);
		});
		let t = {
			context: this.getCurrentQuizContext(),
			answers: e,
			durationMinutes: this.state.currentExamDurationMinutes,
			negativeMarking: this.state.negativeMarking,
			timerExpiresAt: this.state.currentExamDurationMinutes && this.quizCountdownDeadline ? new Date(this.quizCountdownDeadline).toISOString() : null,
			savedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		return (this.state.currentType === "tf" || this.state.currentType === "sba") && (t.questionOrder = this.state.activeQuestions.map((e) => e?.key).filter(Boolean)), t;
	},
	persistCurrentQuizDraft() {
		!this.state.activeQuestions.length || !this.dom.quizForm || this.saveQuizDraft(this.serializeQuizDraft());
	},
	restoreQuizDraftIntoForm(e) {
		if (!e?.answers) return !1;
		let t = 0;
		return Object.entries(e.answers).forEach(([e, n]) => {
			let r = this.dom.quizForm.querySelector(`input[name="${e}"][value="${n}"]`);
			r && (r.checked = !0, (r.closest("[data-quiz-choice]") || r.closest("label"))?.classList.add("selected"), t += 1);
		}), t > 0;
	},
	countAnsweredQuestions() {
		return !this.dom.quizForm || !this.state.activeQuestions.length ? 0 : this.state.activeQuestions.reduce((e, t, n) => this.dom.quizForm.querySelector(`input[name="q${n}"]:checked`) ? e + 1 : e, 0);
	},
	updateQuizProgressUI() {
		let e = Number(this.state.activeQuestions?.length || 0), t = this.countAnsweredQuestions(), n = e ? t / e * 100 : 0;
		this.dom.quizTotalCount && (this.dom.quizTotalCount.textContent = String(e)), this.dom.quizAnsweredCount && (this.dom.quizAnsweredCount.textContent = String(t)), this.dom.quizProgressCopy && (this.dom.quizProgressCopy.textContent = this.state.currentExamDurationMinutes ? this.formatQuizTimer(Number.isFinite(this.state.quizTimeRemainingSeconds) ? this.state.quizTimeRemainingSeconds : this.normalizeQuizDurationMinutes(this.state.currentExamDurationMinutes) * 60) : e ? `${t}/${e} answered` : "0/0 answered"), this.dom.quizProgressCount && (this.dom.quizProgressCount.textContent = `${t} / ${e}`), this.dom.quizProgressFill && (this.dom.quizProgressFill.style.width = `${n}%`), this.dom.quizSubmitBtn && (this.dom.quizSubmitBtn.disabled = !e);
	},
	renderResultsSnapshot(e) {
		if (!e) return !1;
		this.state.currentResultsSnapshot = e;
		let t = e?.context?.type || this.state.currentType || "sba", n = this.getTypeMeta(t), r = this.getCurrentQuizIndex(t), i = this.getAttemptStatsForQuizId(this.state.currentQuizId), a = this.getResultsNarrative(e), o = Math.max(1, Number(e?.attemptCount || i?.totalAttempts || 1)), s = Math.max(0, Number(e?.total || 0)), c = Number(e?.score || 0), l = Math.max(0, Number(e?.percent || 0)), u = this.getResultsPercentageTone(l);
		this.dom.resultsPageKicker && (this.dom.resultsPageKicker.textContent = `Assessment ${r} result`), this.dom.resultsPageTitle && (this.dom.resultsPageTitle.textContent = this.state.currentQuizTitle || e?.context?.title || "Assessment"), this.dom.resultsPageMeta && (this.dom.resultsPageMeta.textContent = [
			this.state.currentLevel || e?.context?.level || "",
			this.state.currentArea || e?.context?.area || "",
			this.state.currentSub || e?.context?.sub || "",
			n.short,
			`${s} question${s === 1 ? "" : "s"}`
		].filter(Boolean).join(" / ")), this.dom.resultsModeLabel && (this.dom.resultsModeLabel.textContent = this.formatQuizSettingsLabel(e)), this.dom.finalScore && (this.dom.finalScore.innerHTML = `${c}<span class="results-score-denom">/${s}</span>`), this.dom.resultsAttemptCount && (this.dom.resultsAttemptCount.textContent = String(o)), this.dom.countCorrect && (this.dom.countCorrect.textContent = String(e.correct)), this.dom.countWrong && (this.dom.countWrong.textContent = String(e.wrong)), this.dom.countUnanswered && (this.dom.countUnanswered.textContent = String(e.unanswered)), this.dom.resultsSummaryHeadline && (this.dom.resultsSummaryHeadline.textContent = a.headline), this.dom.resultsSummaryCopy && (this.dom.resultsSummaryCopy.textContent = a.copy), this.dom.progressText && (this.dom.progressText.textContent = `${l}%`, this.dom.progressText.className = `results-score-pct ${u}`);
		let d = [
			{
				node: this.dom.resultsCorrectSegment,
				value: Number(e?.correct || 0)
			},
			{
				node: this.dom.resultsWrongSegment,
				value: Number(e?.wrong || 0)
			},
			{
				node: this.dom.resultsUnansweredSegment,
				value: Number(e?.unanswered || 0)
			}
		];
		d.forEach(({ node: e, value: t }) => {
			e && (e.hidden = !(s > 0 && t > 0), e.style.width = "0%");
		}), requestAnimationFrame(() => {
			d.forEach(({ node: e, value: t }) => {
				e && (e.style.width = s > 0 && t > 0 ? `${t / s * 100}%` : "0%");
			});
		}), this.renderStoredResultCards(e), this.updateResultsStickySummary(e), this.updateResultsReviewToggleButton(), this.dom.resultsStickyBar && this.dom.resultsStickyBar.classList.remove("is-hidden"), this.startResultsStickyObserver();
		let f = document.getElementById("btn-retry-results");
		return f && (f.textContent = "Retry Quiz"), !0;
	},
	parseLegacyResultCards(e = "") {
		if (!e) return [];
		let t = document.createElement("div");
		return t.innerHTML = e, [...t.querySelectorAll(".result-card")].map((e, t) => {
			let n = e.querySelector(".review-stem, .result-question, .question-stem")?.textContent || "", r = e.querySelector(".answer-chip.your .chip-val, .answer-chip.yours-wrong .chip-val, .answer-chip.yours-unsure .chip-val")?.textContent || "Not sure", i = e.querySelector(".answer-chip.correct-ans .chip-val")?.textContent || r, a = e.querySelector(".explanation-text, .explanation p")?.textContent || "", o = e.classList.contains("correct") ? "correct" : e.classList.contains("notsure") || e.classList.contains("is-unsure") || /unanswered|not sure/i.test(e.textContent || "") ? "notsure" : "incorrect";
			return {
				index: t,
				type: [r, i].every((e) => [
					"true",
					"false",
					"not sure",
					"not sure / not answered"
				].includes(String(e).trim().toLowerCase())) ? "tf" : "sba",
				statusClass: o,
				statusText: o === "correct" ? "Correct (+1)" : o === "notsure" ? "Unanswered (0)" : "Incorrect (0)",
				question: n.trim(),
				imageHtml: "",
				userAnswer: r.trim(),
				correctAnswer: i.trim(),
				explanation: a.trim()
			};
		});
	},
	renderStoredResultCards(e) {
		let t = Array.isArray(e?.results) ? e.results : null, n = (e, t = !1) => {
			this.dom.resultsReviewCount && (this.dom.resultsReviewCount.textContent = t ? `${e} missed` : `${e} question${e === 1 ? "" : "s"}`);
		};
		if (!t) {
			let n = this.parseLegacyResultCards(e?.cardsHtml || "");
			if (n.length) t = n, e.results = n, e.cardsHtml = "";
			else {
				this.dom.resultsContainer.innerHTML = this.buildResultsEmptyReviewMarkup(), this.dom.resultsReviewCount && (this.dom.resultsReviewCount.textContent = "All clear"), this.updateResultsStickySummary(e);
				return;
			}
		}
		let r = this.state.reviewWrongOnly ? t.filter((e) => e.statusClass === "incorrect" || e.statusClass === "notsure") : t;
		if (!r.length) {
			this.dom.resultsContainer.innerHTML = this.buildResultsEmptyReviewMarkup(), this.dom.resultsReviewCount && (this.dom.resultsReviewCount.textContent = "All clear"), this.updateResultsStickySummary(e);
			return;
		}
		this.dom.resultsContainer.innerHTML = r.map((e) => this.buildResultReviewCardMarkup(e)).join(""), n(r.length, this.state.reviewWrongOnly), this.updateResultsStickySummary(e);
	},
	updateResultsReviewToggleButton() {
		if (!this.dom.toggleReviewWrongBtn) return;
		this.dom.toggleReviewWrongBtn.hidden = !1;
		let e = this.state.reviewWrongOnly ? "Show All Questions" : "Review Missed Only";
		this.dom.resultsStickyAction && (this.dom.resultsStickyAction.textContent = e), this.dom.toggleReviewWrongBtn.classList.toggle("is-active", this.state.reviewWrongOnly), this.dom.toggleReviewWrongBtn.setAttribute("aria-pressed", this.state.reviewWrongOnly ? "true" : "false"), this.updateResultsStickySummary(this.state.currentResultsSnapshot || this.loadSavedQuizResult());
	},
	toggleResultsReviewFilter() {
		this.state.reviewWrongOnly = !this.state.reviewWrongOnly;
		let e = this.state.currentResultsSnapshot || this.loadSavedQuizResult();
		if (!e) {
			this.state.reviewWrongOnly = !1, this.updateResultsReviewToggleButton();
			return;
		}
		this.state.currentResultsSnapshot = e, this.renderStoredResultCards(e), this.updateResultsReviewToggleButton();
	},
	async renderDashboard() {
		let e = `${window.location.pathname}${window.location.search}`, t = this.getDisplayNameForUser(this.state.currentUser), n = t.split(/\s+/).filter(Boolean)[0] || t, r = n.length >= 16 ? .72 : n.length >= 13 ? .8 : n.length >= 11 ? .88 : n.length >= 9 ? .94 : 1, i = this.buildDashboardDisplayLevels(), a = this.state.homeDashboard?.stats, o = a ? Number(a.activeYears || 0) : this.state.levelList.filter((e) => (this.state.attempts || []).filter((t) => {
			let n = this.getQuizDescriptorById(t.quizId);
			return (t.level || n?.level || "") === e.name;
		}).length > 0).length, s = Number(a ? a.completedCount || 0 : this.state.userStats?.quizzesDoneCount || 0), c = Number(a ? a.averageScore || 0 : this.state.userStats?.averagePercentage || 0);
		this.dom.dashboardGreeting && (this.dom.dashboardGreeting.textContent = this.getTimeGreeting()), this.dom.dashboardGreetingName && (this.dom.dashboardGreetingName.textContent = `${n}.`), this.dom.dashboardGreetingRow && this.dom.dashboardGreetingRow.style.setProperty("--dashboard-greeting-scale", String(r)), this.dom.dashboardOverallRing && this.dom.dashboardOverallRing.style.setProperty("--dashboard-progress", `${c}%`), this.dom.dashboardOverallRingValue && (this.dom.dashboardOverallRingValue.textContent = `${c}%`), this.dom.dashboardActiveYears && (this.dom.dashboardActiveYears.textContent = String(o)), this.dom.dashboardCompletedCount && (this.dom.dashboardCompletedCount.textContent = String(s)), this.dom.dashboardAverageScore && (this.dom.dashboardAverageScore.textContent = `${c}%`);
		let l = document.getElementById("dashboard-section-count");
		l && (l.textContent = `${i.length} years total`);
		let u = i.map((e) => [e.name, e.locked ? this.getDefaultLevelProgressSummary(e) : this.state.homeDashboard?.levelProgressByName?.[e.name] || this.getDefaultLevelProgressSummary(e)]);
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		this.dom.areaGrid.innerHTML = "";
		let d = Object.fromEntries(u);
		i.forEach((e, t) => {
			let n = document.createElement("div");
			this.renderDashboardLevelCard(n, e, t, d[e.name]), this.dom.areaGrid.appendChild(n);
		}), this.showOnly("dashboard-view");
	},
	async renderModules() {
		let e = `${window.location.pathname}${window.location.search}`, t = this.state.currentLevel;
		if (!t) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		let n = this.getScopedRouteDataKey(t);
		this.state.routeData?.coursesByLevel?.[n] || this.showLoadingView();
		let r;
		try {
			r = await this.loadBrowseCourses(t);
		} catch (e) {
			if (console.error("Course page load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load courses.");
			return;
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		let i = r.courses;
		document.getElementById("module-page-title").textContent = t, document.getElementById("modules-page-kicker").textContent = t, document.getElementById("module-page-subtitle").textContent = "", document.getElementById("modules-section-count").textContent = `${i.length} total`, this.dom.moduleGrid.innerHTML = "", i.forEach((e, n) => {
			let r = document.createElement("div");
			this.renderAreaBrowseCard(r, t, e, n, e.summary), this.dom.moduleGrid.appendChild(r);
		}), this.showOnly("modules-view");
	},
	async renderSubtopics() {
		let e = `${window.location.pathname}${window.location.search}`, { currentLevel: t, currentArea: n } = this.state;
		if (!t || !n) {
			await this.navigate(t ? "modules" : "home", t ? { level: t } : {}, { replace: !0 });
			return;
		}
		let r = this.getScopedRouteDataKey(t, n);
		this.state.routeData?.subtopicsByCourse?.[r] || this.showLoadingView();
		let i;
		try {
			i = await this.loadBrowseSubtopics(t, n);
		} catch (e) {
			if (console.error("Subtopic page load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load subtopics.");
			return;
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		let a = i.subtopics;
		document.getElementById("subtopics-page-title").textContent = n, document.getElementById("subtopics-page-kicker").textContent = t, document.getElementById("subtopics-page-subtitle").textContent = "", document.getElementById("subtopics-section-count").textContent = `${a.length} total`, this.dom.subtopicsGrid.innerHTML = "", a.forEach((e, r) => {
			let i = document.createElement("div");
			this.renderSubtopicBrowseCard(i, e, r, e.summary), i.onclick = () => this.navigate("types", {
				level: t,
				area: n,
				sub: e.name
			}), this.dom.subtopicsGrid.appendChild(i);
		}), this.showOnly("subtopics-view");
	},
	async renderTypes() {
		let e = `${window.location.pathname}${window.location.search}`, { currentLevel: t, currentArea: n, currentSub: r } = this.state;
		if (!t || !n || !r) {
			await this.navigate(t && n ? "subtopics" : "home", t && n ? {
				level: t,
				area: n
			} : {}, { replace: !0 });
			return;
		}
		let i = this.getScopedRouteDataKey(t, n, r);
		this.state.routeData?.typesBySubtopic?.[i] || this.showLoadingView();
		let a;
		try {
			a = await this.loadBrowseTypes(t, n, r);
		} catch (e) {
			if (console.error("Quiz type summary load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load quiz types.");
			return;
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		let o = a.types, s = a.totalQuestions, c = a.percent;
		document.getElementById("types-page-title").textContent = r, this.dom.typesPageKicker && (this.dom.typesPageKicker.textContent = "Question formats"), this.dom.typesTotalQuestions && (this.dom.typesTotalQuestions.textContent = String(s)), this.dom.typesFormatCount && (this.dom.typesFormatCount.textContent = String(o.length)), this.dom.typesCompletePercent && (this.dom.typesCompletePercent.textContent = `${c}%`, this.dom.typesCompletePercent.classList.toggle("muted", c === 0)), this.dom.typesGrid.innerHTML = "", o.forEach(({ type: e, quizCount: i, questionCount: a, completedCount: o }) => {
			let s = i === 0, c = !!i && o === i, l = s ? "Unavailable" : c ? "Complete" : o ? "In Progress" : "Not Started", u = e === "sba" ? "Single Best Answer" : "True / False", d = e === "sba" ? `
          <div class="selection-visual selection-visual-sba" aria-hidden="true">
            ${[
				"A",
				"B",
				"C",
				"D",
				"E"
			].map((e, t) => `
              <span class="selection-visual-pill ${t === 2 ? "is-active" : ""}">${e}</span>
            `).join("")}
          </div>
        ` : "\n          <div class=\"selection-visual selection-visual-tf\" aria-hidden=\"true\">\n            <div class=\"selection-visual-choice is-active\">\n              <span>True</span>\n              <svg viewBox=\"0 0 24 24\">\n                <path d=\"m20 6-11 11-5-5\"></path>\n              </svg>\n            </div>\n            <div class=\"selection-visual-choice\">\n              <span>False</span>\n              <span class=\"selection-visual-radio\"></span>\n            </div>\n          </div>\n        ", f = document.createElement(s ? "article" : "button");
			f instanceof HTMLButtonElement && (f.type = "button"), f.className = `selection-card type-${e} ${s ? "locked" : "available"} ${c ? "is-complete" : o ? "is-progress" : "is-fresh"}`, s || f.setAttribute("aria-label", `Open ${u} assessments`), f.innerHTML = `
        <div class="selection-card-copy">
          <div class="selection-card-head">
            <span class="selection-card-status ${s ? "is-locked" : c ? "is-complete" : o ? "is-progress" : "is-fresh"}">${this.escapeHtml(l)}</span>
          </div>
          <div class="selection-card-name">${this.escapeHtml(u)}</div>
        </div>
        <div class="selection-card-visual-wrap">
          ${d}
        </div>
        <div class="selection-card-footer">
          <div class="selection-card-meta">
            <span>${i} ${i === 1 ? "Assessment" : "Assessments"}</span>
            <span class="selection-card-meta-separator" aria-hidden="true">—</span>
            <span class="selection-card-meta-dot" aria-hidden="true"></span>
            <span>${a} Questions</span>
          </div>
          <span class="selection-card-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 12h14"></path>
              <path d="M12 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>
      `, s || (f.onclick = () => this.navigate("quizzes", {
				level: t,
				area: n,
				sub: r,
				type: e
			})), this.dom.typesGrid.appendChild(f);
		}), this.showOnly("types-view");
	},
	async renderQuizList() {
		let e = `${window.location.pathname}${window.location.search}`, { currentLevel: t, currentArea: n, currentSub: r, currentType: i } = this.state;
		if (!t || !n || !r || !["sba", "tf"].includes(i)) {
			await this.navigate(t && n && r ? "types" : "home", t && n && r ? {
				level: t,
				area: n,
				sub: r
			} : {}, { replace: !0 });
			return;
		}
		let a = this.getScopedRouteDataKey(t, n, r, i);
		this.state.routeData?.quizzesByType?.[a] || this.showLoadingView();
		let o;
		try {
			o = await this.loadBrowseQuizzes(t, n, r, i);
		} catch (e) {
			if (console.error("Quiz list load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load quizzes.");
			return;
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		let s = this.getTypeMeta(i), c = this.getTypePresentation(i), l = o.quizzes, u = o.topicIndex, d = o.summary.completedCount, f = o.summary.averageBestPercentage;
		if (this.dom.quizListView && (this.dom.quizListView.classList.remove("type-sba", "type-tf"), this.dom.quizListView.classList.add(`type-${i}`)), this.dom.quizListKicker && (this.dom.quizListKicker.textContent = `Topic ${u}`), document.getElementById("quiz-list-title").textContent = r, this.dom.quizListSubtitle && (this.dom.quizListSubtitle.textContent = ""), this.dom.quizListAssessmentCount && (this.dom.quizListAssessmentCount.textContent = String(l.length)), this.dom.quizListCompletedCount && (this.dom.quizListCompletedCount.textContent = String(d), this.dom.quizListCompletedCount.classList.toggle("good", d > 0)), this.dom.quizListAverageScore && (this.dom.quizListAverageScore.textContent = f === null ? "--" : `${f}%`, this.dom.quizListAverageScore.classList.toggle("good", f !== null)), this.dom.quizListModeBadge && (this.dom.quizListModeBadge.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <path d="M13 2v7h7"></path>
        </svg>
        <span>${this.escapeHtml(c.listDescription)}</span>
      `), this.dom.quizListModeDescription && (this.dom.quizListModeDescription.textContent = ""), this.dom.quizListSectionCount && (this.dom.quizListSectionCount.textContent = `${l.length} total`), this.dom.quizList.innerHTML = "", !l.length) {
			this.dom.quizList.innerHTML = `
        <div class="quizlist-empty-card">
          <span class="quizlist-empty-kicker">${this.escapeHtml(s.label)}</span>
          <h3>No assessments yet</h3>
          <p>No ${this.escapeHtml(s.label.toLowerCase())} quizzes are available for this topic yet.</p>
        </div>
      `, this.showOnly("quiz-list-view");
			return;
		}
		l.forEach((e, t) => {
			let n = e.totalAttempts > 0, r = e.totalAttempts, i = Number(e.count || 0), a = Number(e.bestPercentage || 0), o = n ? "Done" : "Ready", s = n ? `${r} attempt${r === 1 ? "" : "s"}` : "", c = document.createElement("button");
			c.type = "button", c.className = `quizlist-card ${n ? "done" : "fresh"}`, c.setAttribute("aria-label", `Open assessment ${t + 1}: ${e.title}`), c.innerHTML = `
        <div class="quizlist-card-row">
          <span class="quizlist-card-index" aria-hidden="true">${String(t + 1).padStart(2, "0")}</span>
          <div class="quizlist-card-main">
            <div class="quizlist-card-topline">
              <span class="quizlist-state-badge ${n ? "is-done" : "is-ready"}">${o}</span>
            </div>
            <div class="quizlist-card-title">${this.escapeHtml(e.title)}</div>
            <div class="quizlist-card-meta">
              <span class="quizlist-card-question-count">${i} question${i === 1 ? "" : "s"}</span>
              ${s ? `
                <span class="quizlist-card-attempts">${this.escapeHtml(s)}</span>
              ` : ""}
            </div>
          </div>
          <div class="quizlist-card-trailing">
            ${n ? `
              <div class="quizlist-card-metric">
                <div class="quizlist-card-metric-label">best</div>
                <div class="quizlist-card-metric-value">${this.escapeHtml(`${a}%`)}</div>
              </div>
            ` : ""}
            <span class="quizlist-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6"></path>
              </svg>
            </span>
          </div>
        </div>
      `, c.onclick = () => void this.openQuizSettings(e), this.dom.quizList.appendChild(c);
		}), this.showOnly("quiz-list-view");
	},
	async renderQuiz() {
		let e = `${window.location.pathname}${window.location.search}`;
		this.showLoadingView(), this.stopQuizCountdown();
		let t;
		try {
			t = await (this.consumeInitialRoutePrefetch("quiz") || this.loadQuizSessionPage(this.state.currentQuizId));
		} catch (e) {
			if (console.error("Quiz session load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load this quiz.");
			return;
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		if (!t) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		let { descriptor: n } = t;
		this.state.currentQuizId = n.quizId, this.state.currentLevel = n.level, this.state.currentArea = n.area, this.state.currentSub = n.sub, this.state.currentType = n.type, this.state.currentQuizTitle = n.title;
		let r = t.questions, i = t.draft, a = this.getQuizSessionQuestions(r, i), o = i;
		if (!a.length) {
			this.navigate("quizzes", {
				level: this.state.currentLevel,
				area: this.state.currentArea,
				sub: this.state.currentSub,
				type: this.state.currentType
			});
			return;
		}
		this.state.activeQuestions = a, this.showOnly("quiz-view");
		let s = this.getTypeMeta(this.state.currentType), c = this.state.currentExamDurationMinutes ? `${this.state.currentExamDurationMinutes} min` : "No time", l = this.state.negativeMarking ? "Negative marking" : "Standard marking", u = this.getCurrentQuizIndex(), d = document.getElementById("quiz-view");
		d && (d.dataset.type = this.state.currentType, d.dataset.mode = this.state.mode, d.dataset.negativeMarking = this.state.negativeMarking ? "true" : "false"), document.getElementById("quiz-mode-badge").textContent = `${s.label.toUpperCase()} \u00b7 ${c.toUpperCase()}`, this.dom.quizPageKicker && (this.dom.quizPageKicker.textContent = `ASSESSMENT ${u}`), document.getElementById("quiz-page-title").textContent = this.state.currentQuizTitle, document.getElementById("quiz-page-meta").innerHTML = `<span>${this.escapeHtml(this.state.currentLevel)}</span> &middot; ${this.escapeHtml(this.state.currentArea)} &middot; ${this.escapeHtml(this.state.currentSub)}`, this.dom.quizModeStat && (this.dom.quizModeStat.textContent = c);
		let f = [
			{
				className: "opt-true",
				value: "TRUE",
				label: "True",
				icon: "\n          <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n            <path d=\"M6.5 12.5l3.2 3.2L17.5 8\"></path>\n          </svg>\n        "
			},
			{
				className: "opt-false",
				value: "FALSE",
				label: "False",
				icon: "\n          <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n            <path d=\"M8 8l8 8\"></path>\n            <path d=\"M16 8l-8 8\"></path>\n          </svg>\n        "
			},
			{
				className: "opt-not-sure",
				value: "NS",
				label: "Not sure",
				icon: "<span class=\"tf-icon-mark\" aria-hidden=\"true\">?</span>"
			}
		];
		this.dom.quizForm.innerHTML = a.map((e, t) => {
			let n = e.img ? `
            <div class="question-image-wrap">
              <img class="question-image" src="${this.escapeHtml(e.img)}" alt="Question image ${t + 1}">
            </div>
          ` : "", r = e.type === "tf" ? `
              <div class="tf-options">
                ${f.map((e) => `
                      <label class="quiz-choice tf-btn ${e.className}" data-quiz-choice>
                        <input class="quiz-choice-input" type="radio" name="q${t}" value="${e.value}">
                        <span class="tf-icon">
                          ${e.icon}
                        </span>
                        <span class="tf-label">${e.label}</span>
                      </label>
                    `).join("")}
              </div>
            ` : `
              <div class="options-list">
                ${(e.options || []).map((e, n) => {
				let r = String.fromCharCode(65 + n);
				return `
                      <label class="quiz-choice option-item" data-quiz-choice>
                        <input class="quiz-choice-input" type="radio" name="q${t}" value="${r}">
                        <span class="option-radio" aria-hidden="true">
                          <span class="option-radio-dot"></span>
                        </span>
                        <span class="option-letter">${r}</span>
                        <span class="option-text">${this.escapeHtml(e)}</span>
                      </label>
                    `;
			}).join("")}
              </div>
            `;
			return `
          <article class="question-card question-card-${e.type}">
            <div class="question-meta">
              <span class="q-number">QUESTION ${t + 1}</span>
              <span class="q-type-badge">${l.toUpperCase()}</span>
            </div>
            <p class="question-stem">${this.escapeHtml(e.q)}</p>
            ${n}
            ${r}
          </article>
        `;
		}).join(""), this.dom.quizForm.onchange = (e) => {
			let t = e.target.closest?.("input[type=\"radio\"]");
			t && (this.dom.quizForm.querySelectorAll(`input[name="${t.name}"]`).forEach((e) => {
				(e.closest("[data-quiz-choice]") || e.closest("label"))?.classList.remove("selected");
			}), (t.closest("[data-quiz-choice]") || t.closest("label"))?.classList.add("selected"), this.persistCurrentQuizDraft(), this.updateQuizProgressUI());
		}, this.restoreQuizDraftIntoForm(o) && this.showToast("Restored your saved quiz progress."), this.updateQuizProgressUI(), this.startQuizCountdown(o), this.writeStoredJson(this.getQuizDraftStorageKey(), this.serializeQuizDraft());
	},
	renderResults() {
		this.stopResultsStickyObserver?.(), this.showOnly("results-view");
		let e = document.getElementById("results-view");
		if (e && (e.dataset.type = this.state.currentType || "sba", e.dataset.mode = this.state.mode || "study", e.dataset.negativeMarking = this.state.negativeMarking ? "true" : "false"), this.dom.toggleReviewWrongBtn && (this.dom.toggleReviewWrongBtn.hidden = !0), !this.renderResultsSnapshot(this.loadSavedQuizResult())) {
			this.state.currentResultsSnapshot = null, this.navigate("quizzes", {
				level: this.state.currentLevel,
				area: this.state.currentArea,
				sub: this.state.currentSub,
				type: this.state.currentType
			});
			return;
		}
	},
	getResultsPercentageTone(e) {
		return e >= 75 ? "good" : e >= 50 ? "mid" : "poor";
	},
	getResultsMissedCount(e) {
		return Math.max(0, Number(e?.wrong || 0) + Number(e?.unanswered || 0));
	},
	stopResultsStickyObserver() {
		this.resultsStickyObserver && (this.resultsStickyObserver.disconnect(), this.resultsStickyObserver = null);
	},
	startResultsStickyObserver() {
		this.stopResultsStickyObserver(), !(!this.dom.resultsStickyBar || !this.dom.resultsBottomActions) && (this.resultsStickyObserver = new IntersectionObserver(([e]) => {
			this.dom.resultsStickyBar?.classList.toggle("is-hidden", !!e?.isIntersecting);
		}, { threshold: .1 }), this.resultsStickyObserver.observe(this.dom.resultsBottomActions));
	},
	updateResultsStickySummary(e) {
		if (!this.dom.resultsStickyLabel) return;
		let t = this.getResultsMissedCount(e), n = this.state.reviewWrongOnly ? "Show All Questions" : "Review Missed Only";
		this.dom.resultsStickyLabel.textContent = `${t} missed`, this.dom.toggleReviewWrongBtn && this.dom.toggleReviewWrongBtn.setAttribute("aria-label", `${t} missed. ${n}.`);
	},
	getResultsNarrative(e) {
		let t = Number(e?.percent || 0), n = Number(e?.total || 0), r = Number(e?.wrong || 0) + Number(e?.unanswered || 0), i = r === 1 ? "1 question" : `${r} questions`;
		return t >= 100 ? {
			headline: "Beautiful work.",
			copy: "Every answer landed cleanly. Carry that rhythm into the next assessment."
		} : t >= 85 ? {
			headline: "Strong finish.",
			copy: r ? `Only ${i} need another look. A short review below should lock this in.` : "A sharp performance worth carrying forward while the details are still fresh."
		} : t >= 60 ? {
			headline: "A solid foundation.",
			copy: r ? `Review the ${i} that slipped, then take another calm run at it.` : `A steady round across ${n} questions. One more pass should tighten it further.`
		} : {
			headline: "Room to sharpen.",
			copy: e?.negativeMarking ?? e?.context?.negativeMarking ?? e?.mode === "exam" ? "Negative marking bit here. Review the explanations carefully, then try again with a steadier pace." : "Use the explanations below as your next lift, then retry while the material is still warm."
		};
	},
	buildResultsEmptyReviewMarkup() {
		return "\n      <article class=\"result-card correct review-card is-correct result-card-empty\">\n        <div class=\"review-card-inner\">\n          <div class=\"review-top\">\n            <span class=\"review-q-num\">REVIEW</span>\n            <span class=\"verdict-badge correct\">CORRECT (+1)</span>\n          </div>\n          <p class=\"review-stem\">Nothing missed in this attempt.</p>\n          <div class=\"explanation result-explanation\" data-open=\"false\">\n            <button class=\"result-explanation-toggle\" type=\"button\" aria-expanded=\"false\">\n              <span class=\"result-explanation-toggle-text\">VIEW EXPLANATION</span>\n              <span class=\"result-explanation-chevron\" aria-hidden=\"true\"></span>\n            </button>\n            <div class=\"result-explanation-panel\" aria-hidden=\"true\">\n              <div class=\"result-explanation-inner\">\n                <p class=\"explanation-text\">You do not have any wrong or unanswered questions to review here. Move on, or retry for another clean run.</p>\n              </div>\n            </div>\n          </div>\n        </div>\n      </article>\n    ";
	},
	buildResultReviewCardMarkup(e) {
		let t = e.type === "tf" || [e.userAnswer, e.correctAnswer].filter(Boolean).every((e) => [
			"true",
			"false",
			"not sure / not answered"
		].includes(String(e).trim().toLowerCase())) ? "tf-answer-grid" : "sba-answer-grid", n = e.statusClass === "correct" ? "correct" : e.statusClass === "notsure" ? "unsure" : "wrong", r = e.statusClass === "correct" ? "is-correct" : e.statusClass === "notsure" ? "is-unsure" : "is-wrong", i = e.statusClass === "correct", a = e.statusClass === "notsure", o = i ? "CORRECT (+1)" : a ? "UNANSWERED (0)" : String(e.statusText || "").includes("-1") ? "INCORRECT (-1)" : "INCORRECT (0)", s = i ? `
          <div class="answer-grid single ${t}">
            <div class="answer-chip your">
              <span class="chip-label">YOUR ANSWER</span>
              <span class="chip-val">${this.escapeHtml(e.userAnswer)}</span>
            </div>
          </div>
        ` : `
          <div class="answer-grid ${t}">
            <div class="answer-chip ${e.statusClass === "notsure" ? "yours-unsure" : "yours-wrong"}">
              <span class="chip-label">YOUR ANSWER</span>
              <span class="chip-val">${this.escapeHtml(e.userAnswer)}</span>
            </div>
            <div class="answer-chip correct-ans">
              <span class="chip-label">CORRECT ANSWER</span>
              <span class="chip-val">${this.escapeHtml(e.correctAnswer)}</span>
            </div>
          </div>
        `;
		return `
      <article class="result-card ${e.statusClass} review-card ${r}">
        <div class="review-card-inner">
          <div class="review-top">
            <span class="review-q-num">QUESTION ${e.index + 1}</span>
            <span class="verdict-badge ${n}">${o}</span>
          </div>
          <p class="review-stem">${this.escapeHtml(e.question)}</p>
          ${e.imageHtml || ""}
          ${s}
          <div class="explanation result-explanation" data-open="false">
            <button class="result-explanation-toggle" type="button" aria-expanded="false">
              <span class="result-explanation-toggle-text">VIEW EXPLANATION</span>
              <span class="result-explanation-chevron" aria-hidden="true"></span>
            </button>
            <div class="result-explanation-panel" aria-hidden="true">
              <div class="result-explanation-inner">
                <p class="explanation-text">${this.escapeHtml(e.explanation || "No explanation provided.")}</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
	},
	formatCorrectAnswer(e) {
		if (e.type === "tf") return e.a === "TRUE" ? "True" : "False";
		if (e.type === "sba" && e.options && e.a) {
			let t = e.a.charCodeAt(0) - 65;
			if (t >= 0 && e.options[t]) return `(${e.a}) ${e.options[t]}`;
		}
		return e.a;
	},
	formatUserAnswer(e, t) {
		if (t === "NS") return "Not sure";
		if (e.type === "tf") return t === "TRUE" ? "True" : t === "FALSE" ? "False" : t;
		if (e.type === "sba" && e.options) {
			let n = t.charCodeAt(0) - 65;
			if (n >= 0 && e.options[n]) return `(${t}) ${e.options[n]}`;
		}
		return t;
	},
	async renderAccountView() {
		let e = `${window.location.pathname}${window.location.search}`;
		if (!this.dom.accountPageTitle || !this.dom.accountPageSubtitle || !this.dom.accountEmptyState || !this.dom.accountContent) {
			this.showFatalLoadError("Account view is missing required page elements.");
			return;
		}
		this.state.routeData?.accountByKey?.["first-page"] || this.showLoadingView();
		let t;
		try {
			t = await this.loadAccountPage();
		} catch (e) {
			if (console.error("Account page load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load your account.");
			return;
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		this.showOnly("account-view");
		let n = this.getDisplayNameForUser(this.state.currentUser);
		this.dom.accountPageTitle.textContent = `${n}'s Account`, this.dom.accountPageSubtitle.textContent = "Normal quiz and Past Paper performance, together and side by side";
		let r = !!t?.attemptsCount;
		if (this.dom.accountEmptyState.hidden = r, this.dom.accountContent.hidden = !r, !r) {
			this.dom.accountOverviewGrid.innerHTML = "", this.dom.accountModeGrid.innerHTML = "", this.dom.accountCourseGrid.innerHTML = "", this.dom.accountRecentList.innerHTML = "";
			return;
		}
		this.dom.accountOverviewGrid.innerHTML = [
			{
				label: "Assessments Done",
				value: String(t.quizzesDoneCount),
				note: `${t.attemptsCount} total attempts recorded`
			},
			{
				label: "Combined Average",
				value: `${t.averagePercentage}%`,
				note: "Attempt-weighted across normal quizzes and exams"
			},
			{
				label: "Best Score",
				value: this.formatAttemptScore(t.bestAttempt),
				note: t.bestAttempt ? t.bestAttempt.assessmentKind === "past_paper" ? "Past Paper exam" : `${this.formatModeLabel(t.bestAttempt.mode)} quiz` : "No attempts"
			}
		].map((e) => `
      <div class="app-surface-card account-stat-card">
        <span class="account-stat-label">${this.escapeHtml(e.label)}</span>
        <span class="account-stat-value">${this.escapeHtml(e.value)}</span>
        <span class="account-stat-note">${this.escapeHtml(e.note)}</span>
      </div>
    `).join("");
		let i = [
			{
				key: "normal",
				label: "Normal Quizzes"
			},
			{
				key: "exam",
				label: "Past Paper Exams"
			},
			{
				key: "combined",
				label: "Combined"
			}
		];
		this.dom.accountModeGrid.innerHTML = i.map(({ key: e, label: n }) => {
			let r = t.sectionStats[e];
			return `
        <div class="app-surface-card account-stat-card account-assessment-card" data-account-section="${this.escapeHtml(e)}">
          <span class="account-stat-label">${this.escapeHtml(n)}</span>
          <span class="account-stat-value">${r.averagePercentage}%</span>
          <span class="account-stat-note">${r.attemptsCount} attempt${r.attemptsCount === 1 ? "" : "s"} &middot; ${r.assessmentsDoneCount} completed</span>
        </div>
      `;
		}).join(""), this.dom.accountCourseGrid.innerHTML = t.courseStats.map((e) => `
      <div class="app-surface-card account-course-card">
        <div class="account-course-head">
          <h3 class="account-course-title">${this.escapeHtml(e.area)}</h3>
          <span class="account-course-score">${e.averagePercentage}%</span>
        </div>
        <p class="account-course-meta">${e.quizzesDone} assessments done - ${e.attempts} attempts</p>
        <p class="account-course-meta">Best: ${this.escapeHtml(this.formatAttemptScore(e.bestAttempt))}</p>
      </div>
    `).join(""), this.dom.accountRecentList.innerHTML = t.recentAttempts.map((e) => {
			let t = this.getQuizDescriptorById(e.quizId), n = e.quizTitle || t?.title || "Quiz", r = e.area || t?.area || "Unknown course", i = e.assessmentKind === "past_paper" ? "Past Paper Exam" : e.sub || t?.sub || "Unknown module", a = e.assessmentKind === "past_paper" ? "Exam" : `${this.formatModeLabel(e.mode)} quiz`;
			return `
        <div class="app-surface-card account-recent-card">
          <div class="account-recent-head">
            <div>
              <h3 class="account-recent-title">${this.escapeHtml(n)}</h3>
              <p class="account-recent-meta">${this.escapeHtml(r)} - ${this.escapeHtml(i)} - ${this.escapeHtml(a)}</p>
            </div>
            <span class="account-recent-score">${this.escapeHtml(this.formatAttemptScore(e))}</span>
          </div>
          <p class="account-recent-meta">${this.escapeHtml(this.formatDateTime(e.completedAt))}</p>
        </div>
      `;
		}).join("");
	},
	async renderSettingsView() {
		this.showLoadingView();
		let e = this.state.accessStatus;
		if (!e) try {
			e = await this.loadAccessStatus();
		} catch (t) {
			if (console.error("Settings access load failed:", t), await this.handleAccessRestriction(t)) return;
			e = this.state.accessStatus || {};
		}
		this.showOnly("settings-view"), this.renderThemeToggle();
		let t = this.getDisplayNameForUser(this.state.currentUser), n = String(this.state.currentUser?.email || "").trim(), r = String(e?.status || "no_access"), i = e?.accessExpiresAt ? (() => {
			let t = new Date(e.accessExpiresAt);
			return Number.isNaN(t.getTime()) ? "Unknown" : new Intl.DateTimeFormat(void 0, {
				month: "short",
				day: "numeric"
			}).format(t);
		})() : "--", a = e?.accessExpiresAt ? this.formatDateTime(e.accessExpiresAt) : "Not set", o = {
			active: "Active",
			expired: "Expired",
			blocked: "Blocked",
			no_access: "Not Activated",
			signed_out: "Signed Out"
		}[r] || "Unknown";
		if (this.dom.settingsPageTitle && (this.dom.settingsPageTitle.textContent = `${t}'s Settings`), this.dom.settingsPageSubtitle && (this.dom.settingsPageSubtitle.textContent = "Manage account access, appearance preference, and account actions."), this.dom.settingsAccessStatusValue && (this.dom.settingsAccessStatusValue.textContent = o, this.dom.settingsAccessStatusValue.classList.remove("good", "fail"), this.dom.settingsAccessStatusValue.classList.toggle("good", r === "active"), this.dom.settingsAccessStatusValue.classList.toggle("fail", ["blocked", "expired"].includes(r))), this.dom.settingsExpiryValue && (this.dom.settingsExpiryValue.textContent = i), this.dom.settingsEmailValue && (this.dom.settingsEmailValue.textContent = n || "No email"), this.dom.settingsStatusChip && (this.dom.settingsStatusChip.textContent = o, this.dom.settingsStatusChip.classList.remove("is-active", "is-expired", "is-blocked", "is-neutral"), this.dom.settingsStatusChip.classList.add(r === "active" ? "is-active" : r === "expired" ? "is-expired" : r === "blocked" ? "is-blocked" : "is-neutral")), this.dom.settingsExpiryDetailValue && (this.dom.settingsExpiryDetailValue.textContent = a), this.dom.settingsReasonRow && this.dom.settingsReasonValue) {
			let t = String(e?.blockReason || "").trim();
			this.dom.settingsReasonValue.textContent = t, this.dom.settingsReasonRow.hidden = !t;
		}
		this.startSettingsCountdown(e);
	},
	async handleSubmission({ force: e = !1, timedOut: t = !1 } = {}) {
		if (this.quizSubmissionInFlight) return;
		let n = this.state.activeQuestions, r = document.getElementById("quiz-form"), i = this.getCurrentQuizMeta();
		if (!n.length || !r || !i) return;
		let a = this.countAnsweredQuestions(), o = Number(n.length || 0), s = Math.max(0, o - a);
		if (!(s > 0 && !e && !await E({
			title: "Submit incomplete quiz",
			message: `${s} unanswered question${s === 1 ? "" : "s"} remaining. Submit anyway?`,
			submitLabel: "Submit anyway",
			cancelLabel: "Keep answering"
		}))) {
			this.quizSubmissionInFlight = !0, this.stopQuizCountdown(), this.showLoadingView(), await new Promise((e) => setTimeout(e, 0));
			try {
				let e = new FormData(r);
				this.dom.resultsContainer.innerHTML = "";
				let a = 0, o = 0, s = 0, c = 0, l = n.length, u = this.state.negativeMarking, d = [];
				n.forEach((t, n) => {
					let r = e.get(`q${n}`) || "NS", i = r === "NS" ? "NS" : t.type === "tf" ? this.normalizeTfAnswer(r) : this.normalizeSbaAnswer(r, t.options || []), l = i !== "NS" && i === t.a, f = "incorrect", p = u ? "Incorrect (-1)" : "Incorrect (0)", m = 0;
					i === "NS" ? (f = "notsure", p = "Not answered (0)", c += 1) : l ? (f = "correct", p = "Correct (+1)", m = 1, o += 1) : (s += 1, u && (m = -1)), a += m;
					let h = t.img ? `<div class="result-media"><img class="result-image" src="${this.escapeHtml(t.img)}" alt="Result image ${n + 1}"></div>` : "", g = this.formatUserAnswer(t, i), _ = this.formatCorrectAnswer(t);
					d.push({
						index: n,
						type: t.type,
						statusClass: f,
						statusText: p,
						question: t.q,
						imageHtml: h,
						userAnswer: g,
						correctAnswer: _,
						explanation: t.exp || ""
					});
				});
				let f = Math.round(Math.max(a, 0) / l * 100), p = d.map((e) => this.buildResultReviewCardMarkup(e)).join(""), m = {
					context: this.getCurrentQuizContext(),
					mode: this.state.mode,
					negativeMarking: u,
					score: a,
					total: l,
					correct: o,
					wrong: s,
					unanswered: c,
					percent: f,
					results: d,
					cardsHtml: p,
					timedOut: t,
					savedAt: (/* @__PURE__ */ new Date()).toISOString()
				}, h = await this.saveAttemptRecord({
					quizId: i.id,
					mode: this.state.mode,
					score: a,
					totalQuestions: l,
					correctCount: o,
					wrongCount: s,
					unansweredCount: c,
					percentage: f
				});
				h.success || (console.error("Quiz attempt save failed:", h.error), this.showToast("Score saved locally on screen, but not to account history.")), m.attemptCount = Math.max(1, Number(h.attemptCount || this.getAttemptStatsForQuizId(i.id)?.totalAttempts || 0)), await this.clearQuizDraft(), this.saveQuizResultSnapshot(m), this.navigate("results", {
					quizId: i.id,
					mode: this.state.mode,
					duration: this.state.currentExamDurationMinutes || "",
					negativeMarking: this.state.negativeMarking
				});
			} finally {
				this.quizSubmissionInFlight = !1;
			}
		}
	}
}, k = {
	normalizeSearchText(e) {
		return String(e ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
	},
	escapeSearchHtml(e) {
		return typeof this.escapeHtml == "function" ? this.escapeHtml(e) : String(e ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
	},
	getSearchTypeMeta(e) {
		return typeof this.getTypeMeta == "function" ? this.getTypeMeta(e) : e === "tf" ? {
			label: "True / False",
			short: "T/F",
			className: "tf-border"
		} : {
			label: "Single Best Answer",
			short: "SBA",
			className: "sba-border"
		};
	},
	compareSearchValues(e, t) {
		return typeof this.compareDisplayOrder == "function" ? this.compareDisplayOrder(e, t) : String(e ?? "").localeCompare(String(t ?? ""), void 0, {
			numeric: !0,
			sensitivity: "base"
		});
	},
	compareSearchItems(e, t) {
		return this.compareSearchValues(e.level, t.level) || this.compareSearchValues(e.area, t.area) || this.compareSearchValues(e.sub, t.sub) || this.compareSearchValues(e.title, t.title);
	},
	getSearchCatalogItems() {
		return Object.values(this.state?.quizDetailsById || {}).filter((e) => e && e.quizId).slice().sort((e, t) => this.compareSearchItems(e, t));
	},
	getSearchItemScore(e, t, n) {
		let r = this.normalizeSearchText(e.title), i = this.normalizeSearchText(e.sub), a = this.normalizeSearchText(e.area), o = this.normalizeSearchText(e.level), s = [
			r,
			i,
			a,
			o
		].filter(Boolean).join(" ");
		if (!t || !s.includes(t) && !n.every((e) => s.includes(e))) return 0;
		let c = 0;
		return r === t ? c += 220 : r.startsWith(t) ? c += 150 : r.includes(t) && (c += 105), i === t ? c += 110 : i.startsWith(t) ? c += 75 : i.includes(t) && (c += 52), a === t ? c += 90 : a.startsWith(t) ? c += 60 : a.includes(t) && (c += 42), o === t ? c += 70 : o.startsWith(t) ? c += 45 : o.includes(t) && (c += 28), n.forEach((e) => {
			r.includes(e) && (c += 22), i.includes(e) && (c += 13), a.includes(e) && (c += 10), o.includes(e) && (c += 8);
		}), c;
	},
	getSearchResultsForQuery(e) {
		let t = String(e ?? "").trim(), n = this.normalizeSearchText(t), r = n ? n.split(" ") : [], i = this.getSearchCatalogItems();
		if (!n) return {
			displayQuery: t,
			browseMode: !0,
			totalItems: i.length,
			totalMatches: i.length,
			results: i.slice(0, 12)
		};
		let a = i.map((e) => ({
			item: e,
			score: this.getSearchItemScore(e, n, r)
		})).filter((e) => e.score > 0).sort((e, t) => t.score - e.score || this.compareSearchItems(e.item, t.item)).map((e) => e.item);
		return {
			displayQuery: t,
			browseMode: !1,
			totalItems: i.length,
			totalMatches: a.length,
			results: a.slice(0, 18)
		};
	},
	buildSearchResultMarkup(e, t) {
		let n = this.escapeSearchHtml.bind(this), r = this.getSearchTypeMeta(e.type), i = [
			e.level,
			e.area,
			e.sub
		].filter(Boolean).join(" - "), a = Number(e.count || 0), o = a ? `${a} question${a === 1 ? "" : "s"}` : "Question count pending";
		return `
      <button
        class="search-result-card ${n(r.className || "sba-border")}"
        type="button"
        data-search-index="${t}"
        aria-label="Open ${n(e.title || "assessment")}"
      >
        <div class="search-result-head">
          <h3 class="search-result-title">${n(e.title || "Assessment")}</h3>
          <span class="search-result-type">${n(r.short || r.label || "Quiz")}</span>
        </div>
        <p class="search-result-meta">${n(i || "Course context unavailable")}</p>
        <div class="search-result-footer">
          <span class="search-result-detail">${n(o)}</span>
          <span class="search-result-detail">${n(r.label || "Assessment")}</span>
        </div>
      </button>
    `;
	},
	bindSearchResultCards() {
		this.dom?.searchResults && this.dom.searchResults.querySelectorAll("[data-search-index]").forEach((e) => {
			let t = Number.parseInt(e.dataset.searchIndex || "-1", 10);
			!Number.isFinite(t) || t < 0 || (e.addEventListener("click", () => {
				this.openSearchResultByIndex(t);
			}), e.addEventListener("mouseenter", () => {
				this.state.search.activeIndex = t, this.updateSearchSelection();
			}), e.addEventListener("focus", () => {
				this.state.search.activeIndex = t, this.updateSearchSelection();
			}));
		});
	},
	async renderSearchResults() {
		if (!this.dom?.searchResults) return;
		let e = this.dom.searchInput?.value || "", t = Number(this.state.search.requestSequence || 0) + 1;
		this.state.search.requestSequence = t;
		let n;
		try {
			n = await this.loadQuizSearchPage(e);
		} catch (e) {
			if (console.error("Search render failed:", e), typeof this.handleAccessRestriction == "function" && await this.handleAccessRestriction(e)) return;
			this.state.search.results = [], this.state.search.activeIndex = -1, this.dom.searchResults.classList.add("has-results"), this.dom.searchResults.innerHTML = `
        <div class="search-results-empty">${this.escapeSearchHtml(e?.message || "Could not load search right now.")}</div>
      `;
			return;
		}
		if (t !== this.state.search.requestSequence || e !== (this.dom.searchInput?.value || "") || !this.state.topbar.searchOpen) return;
		let { displayQuery: r, browseMode: i, totalItems: a, totalMatches: o, results: s } = n;
		if (this.state.search.results = s, this.state.search.activeIndex = s.length ? 0 : -1, this.dom.searchResults.classList.add("has-results"), !a) {
			this.dom.searchResults.innerHTML = "\n        <div class=\"search-results-empty\">No assessments are available in search yet.</div>\n      ";
			return;
		}
		if (!s.length) {
			this.dom.searchResults.innerHTML = `
        <div class="search-results-summary">No matches</div>
        <div class="search-results-empty">No assessments matched "${this.escapeSearchHtml(r)}".</div>
      `;
			return;
		}
		let c = i ? `Showing ${s.length} of ${a} assessments. Start typing to narrow the list.` : `${o} assessment${o === 1 ? "" : "s"} matched "${r}".`;
		this.dom.searchResults.innerHTML = `
      <div class="search-results-summary">${this.escapeSearchHtml(c)}</div>
      <div class="search-results-list">
        ${s.map((e, t) => this.buildSearchResultMarkup(e, t)).join("")}
      </div>
    `, this.bindSearchResultCards(), this.updateSearchSelection();
	}
};
//#endregion
//#region public/src/services/past-paper-service.js
async function A(e) {
	return e.rpc("app_past_paper_years");
}
async function j(e, t, n = "Past Papers") {
	return e.rpc("app_past_paper_topics", {
		p_year_label: t,
		p_paper_group_label: n
	});
}
async function M(e, t, n, r = "Past Papers") {
	return e.rpc("app_past_paper_exams", {
		p_year_label: t,
		p_topic_label: n,
		p_paper_group_label: r
	});
}
async function N(e, t, n, { durationMinutes: r = null, negativeMarking: i = !1, timedOut: a = !1 } = {}) {
	return e.rpc("app_submit_past_paper_attempt", {
		p_set_id: t,
		p_answers: n,
		p_duration_minutes: r,
		p_negative_marking: !!i,
		p_timed_out: !!a
	});
}
async function P(e, t) {
	return e.rpc("app_past_paper_attempt_review", { p_attempt_id: t });
}
//#endregion
//#region public/src/features/past-papers/past-paper-app.js
var F = "Past Papers", I = "Exams";
function L(e) {
	return String(e ?? "").trim();
}
function R(e) {
	return e === !0 ? "True" : e === !1 ? "False" : "Not sure";
}
var z = {
	pastPaperCountdownInterval: null,
	pastPaperCountdownDeadline: 0,
	resetPastPaperState() {
		this.state.pastPapers = {
			years: [],
			yearsLoaded: !1,
			topicsByYear: {},
			examsByTopic: {},
			unitsBySetId: {},
			reviewsByAttemptId: {},
			currentYear: "",
			currentTopic: "",
			currentSetId: "",
			currentAttemptId: "",
			durationMinutes: null,
			negativeMarking: !1,
			timeRemainingSeconds: null,
			activeUnits: [],
			activeExam: null
		};
	},
	getPastPaperState() {
		return this.state.pastPapers || this.resetPastPaperState(), this.state.pastPapers;
	},
	getPastPaperYearKey(e) {
		return L(e).toLowerCase();
	},
	getPastPaperTopicKey(e, t) {
		return `${this.getPastPaperYearKey(e)}::${L(t).toLowerCase()}`;
	},
	getPastPaperYearSummary(e) {
		let t = this.getPastPaperYearKey(e);
		return this.getPastPaperState().years.find((e) => this.getPastPaperYearKey(e.yearLabel) === t) || null;
	},
	hasPastPapersForYear(e) {
		return !!this.getPastPaperYearSummary(e)?.examCount;
	},
	normalizePastPaperYearRows(e) {
		return (e || []).map((e) => ({
			yearLabel: L(e.year_label),
			paperGroupLabel: L(e.paper_group_label) || F,
			topicCount: Number(e.topic_count || 0),
			examCount: Number(e.exam_count || 0),
			unitCount: Number(e.unit_count || 0),
			totalMarks: Number(e.total_marks || 0),
			attemptCount: Number(e.attempt_count || 0),
			bestPercentage: Number(e.best_percentage || 0)
		})).filter((e) => e.yearLabel && e.examCount > 0).sort((e, t) => this.compareDisplayOrder(e.yearLabel, t.yearLabel));
	},
	normalizePastPaperTopicRows(e) {
		return (e || []).map((e) => ({
			yearLabel: L(e.year_label),
			paperGroupLabel: L(e.paper_group_label) || F,
			topicLabel: L(e.topic_label),
			examCount: Number(e.exam_count || 0),
			unitCount: Number(e.unit_count || 0),
			totalMarks: Number(e.total_marks || 0),
			attemptCount: Number(e.attempt_count || 0),
			bestPercentage: Number(e.best_percentage || 0)
		})).filter((e) => e.topicLabel && e.examCount > 0).sort((e, t) => this.compareDisplayOrder(e.topicLabel, t.topicLabel));
	},
	normalizePastPaperExamRows(e) {
		return (e || []).map((e) => ({
			setId: e.set_id,
			title: L(e.title),
			yearLabel: L(e.year_label),
			paperGroupLabel: L(e.paper_group_label) || F,
			topicLabel: L(e.topic_label),
			unitCount: Number(e.unit_count || 0),
			totalMarks: Number(e.total_marks || 0),
			attemptCount: Number(e.attempt_count || 0),
			bestPercentage: Number(e.best_percentage || 0),
			latestPercentage: Number(e.latest_percentage || 0)
		})).filter((e) => e.setId && e.title).sort((e, t) => this.compareDisplayOrder(e.title, t.title));
	},
	normalizePastPaperUnitRows(e) {
		return (e || []).map((e) => {
			let t = (Array.isArray(e.branches) ? e.branches : []).map((e) => ({
				...e,
				order: Number(e?.order || 0),
				prompt: L(e?.prompt),
				imageUrl: L(e?.imageUrl)
			})).filter((e) => e.branchId && e.prompt && e.order >= 1 && e.order <= 5).sort((e, t) => e.order - t.order);
			return {
				unitId: e.unit_id,
				stem: L(e.stem),
				imageUrl: L(e.image_url),
				displayOrder: Number(e.display_order || 0),
				branches: t
			};
		}).filter((e) => e.unitId && e.stem && e.branches.length >= 1 && e.branches.length <= 5).sort((e, t) => e.displayOrder === t.displayOrder ? String(e.unitId).localeCompare(String(t.unitId)) : e.displayOrder - t.displayOrder);
	},
	async loadPastPaperYears(e = !1) {
		let t = this.getPastPaperState();
		if (!e && t.yearsLoaded) return t.years;
		try {
			let { data: e, error: n } = await this.withTimeout(A(this.getSupabase()), 12e3, "Loading past papers");
			if (n) throw n;
			return t.years = this.normalizePastPaperYearRows(e || []), t.yearsLoaded = !0, this.scheduleAppDataCacheWrite?.(), t.years;
		} catch (e) {
			if (this.isRpcUnavailable?.(e)) return t.years = [], t.yearsLoaded = !0, [];
			throw e;
		}
	},
	async ensurePastPaperTopicsLoaded(e, t = !1) {
		let n = this.getPastPaperState(), r = this.getPastPaperYearKey(e);
		if (!t && n.topicsByYear[r]) return n.topicsByYear[r];
		let { data: i, error: a } = await this.withTimeout(j(this.getSupabase(), e, F), 12e3, "Loading past paper topics");
		if (a) throw a;
		let o = this.normalizePastPaperTopicRows(i || []);
		return n.topicsByYear[r] = o, this.scheduleAppDataCacheWrite?.(), o;
	},
	async ensurePastPaperExamsLoaded(e, t, n = !1) {
		let r = this.getPastPaperState(), i = this.getPastPaperTopicKey(e, t);
		if (!n && r.examsByTopic[i]) return r.examsByTopic[i];
		let { data: a, error: o } = await this.withTimeout(M(this.getSupabase(), e, t, F), 12e3, "Loading past paper exams");
		if (o) throw o;
		let s = this.normalizePastPaperExamRows(a || []);
		return r.examsByTopic[i] = s, this.scheduleAppDataCacheWrite?.(), s;
	},
	async openPastPaperSettings(e, t, n) {
		if (!e?.setId) return;
		let r = this.getRememberedAssessmentSettings("past_paper", e.setId), i = r ? null : await this.loadAccountAssessmentProgress("past_paper", e.setId), a = await D({
			title: e.title || "Start exam",
			submitLabel: "Start exam",
			cancelLabel: "Cancel",
			min: 5,
			max: 30,
			initial: r?.durationMinutes || i?.durationMinutes || null,
			negativeMarking: !!(r?.negativeMarking ?? i?.negativeMarking)
		});
		if (!a) return;
		let o = this.normalizeQuizDurationMinutes(a.durationMinutes);
		this.rememberAssessmentSettings("past_paper", e.setId, {
			durationMinutes: o,
			negativeMarking: !!a.negativeMarking
		}), await this.navigate("past-paper-session", {
			setId: e.setId,
			year: t,
			topic: n,
			duration: o || "",
			negativeMarking: !!a.negativeMarking
		});
	},
	buildPastPaperBrowseCard({ badge: e, title: t, statusLabel: n = "Open", statusClass: r = "status-fresh", metaLabel: i = "", metricValue: a = "", metricLabel: o = "", progressPercent: s = 0, progressLabel: c = "", index: l = 0 }) {
		return this.buildBrowseCardMarkup({
			badge: e,
			title: t,
			kickerLabel: "",
			toneClass: this.getBrowseToneClass(l),
			statusLabel: n,
			statusClass: r,
			metaKind: "book",
			metaLabel: i,
			progressPercent: s,
			progressLabel: c,
			metricValue: a,
			metricLabel: o
		});
	},
	getPastPaperCompletionPercent(e) {
		let t = Number(e?.examCount || 0), n = Number(e?.attemptCount || 0);
		return t ? Math.min(100, Math.round(n / t * 100)) : 0;
	},
	async renderYearHub() {
		let e = `${window.location.pathname}${window.location.search}`, t = L(this.state.currentLevel);
		if (!t) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		let n = this.state.homeDashboard?.levelProgressByName?.[t] || null, r = this.getPastPaperYearSummary(t);
		if (!this.homeBootstrapLoadedThisPage) {
			this.showLoadingView();
			try {
				let e = await this.loadYearOverview(t);
				n = e.normal, r = e.pastPaper;
			} catch (e) {
				if (console.error("Year overview load failed:", e), await this.handleAccessRestriction(e)) return;
				this.showFatalLoadError(e?.message || "Could not load this year.");
				return;
			}
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		let i = !!n;
		if (!i && !r) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		let a = Number(n?.percent || 0), o = this.getPastPaperCompletionPercent(r);
		document.getElementById("year-page-title").textContent = t, document.getElementById("year-page-kicker").textContent = "Year", document.getElementById("year-page-subtitle").textContent = "";
		let s = [];
		i && s.push({
			badge: "N",
			title: "Normal Study",
			metaLabel: `${Number(n?.courseCount || 0)} course${Number(n?.courseCount || 0) === 1 ? "" : "s"}`,
			metricValue: "",
			metricLabel: "",
			statusLabel: "Courses",
			statusClass: "status-active",
			progressPercent: a,
			progressLabel: `${a}% done`,
			onClick: () => {
				this.showLoadingView(), this.navigate("modules", { level: t });
			}
		}), r && s.push({
			badge: "P",
			title: I,
			metaLabel: `${r.topicCount} topic${r.topicCount === 1 ? "" : "s"}`,
			metricValue: String(r.examCount),
			metricLabel: r.examCount === 1 ? "exam" : "exams",
			statusLabel: r.attemptCount ? "Active" : "New",
			statusClass: r.attemptCount ? "status-active" : "status-fresh",
			progressPercent: o,
			progressLabel: `${o}% done`,
			onClick: () => this.navigate("past-paper-topics", { year: t })
		}), document.getElementById("year-section-count").textContent = `${s.length} option${s.length === 1 ? "" : "s"}`, this.dom.yearOptionGrid.innerHTML = "", s.forEach((e, t) => {
			let n = document.createElement("button");
			n.type = "button", n.className = "browse-card-button", n.innerHTML = this.buildPastPaperBrowseCard({
				...e,
				index: t
			}), n.onclick = e.onClick, this.dom.yearOptionGrid.appendChild(n);
		}), this.showOnly("year-view");
	},
	async renderPastPaperTopics() {
		let e = `${window.location.pathname}${window.location.search}`, t = L(this.state.pastPapers?.currentYear || this.state.currentLevel);
		if (!t) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		this.showLoadingView();
		let n;
		try {
			n = await (this.consumeInitialRoutePrefetch("past-paper-topics") || this.ensurePastPaperTopicsLoaded(t));
		} catch (e) {
			if (console.error("Past paper topics load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load past paper topics.");
			return;
		}
		`${window.location.pathname}${window.location.search}` === e && (document.getElementById("past-paper-topics-title").textContent = F, document.getElementById("past-paper-topics-kicker").textContent = t, document.getElementById("past-paper-topics-subtitle").textContent = "", document.getElementById("past-paper-topics-count").textContent = `${n.length} topic${n.length === 1 ? "" : "s"}`, this.dom.pastPaperTopicsGrid.innerHTML = "", n.forEach((e, n) => {
			let r = this.getPastPaperCompletionPercent(e), i = document.createElement("button");
			i.type = "button", i.className = "browse-card-button", i.innerHTML = this.buildPastPaperBrowseCard({
				badge: e.topicLabel.slice(0, 2).toUpperCase() || `T${n + 1}`,
				title: e.topicLabel,
				statusLabel: e.attemptCount ? "Active" : "New",
				statusClass: e.attemptCount ? "status-active" : "status-fresh",
				metaLabel: `${e.examCount} exam${e.examCount === 1 ? "" : "s"}`,
				metricValue: String(e.totalMarks),
				metricLabel: "marks",
				progressPercent: r,
				progressLabel: `${r}% done`,
				index: n
			}), i.onclick = () => this.navigate("past-paper-exams", {
				year: t,
				topic: e.topicLabel
			}), this.dom.pastPaperTopicsGrid.appendChild(i);
		}), this.showOnly("past-paper-topics-view"));
	},
	async renderPastPaperExams() {
		let e = `${window.location.pathname}${window.location.search}`, t = this.getPastPaperState(), n = L(t.currentYear || this.state.currentLevel), r = L(t.currentTopic || this.state.currentArea);
		if (!n || !r) {
			await this.navigate("past-paper-topics", { year: n }, { replace: !0 });
			return;
		}
		this.showLoadingView();
		let i;
		try {
			i = await (this.consumeInitialRoutePrefetch("past-paper-exams") || this.ensurePastPaperExamsLoaded(n, r));
		} catch (e) {
			if (console.error("Past paper exams load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load past paper exams.");
			return;
		}
		`${window.location.pathname}${window.location.search}` === e && (document.getElementById("past-paper-exams-title").textContent = r, document.getElementById("past-paper-exams-kicker").textContent = `${n} / ${F}`, document.getElementById("past-paper-exams-subtitle").textContent = "", document.getElementById("past-paper-exams-count").textContent = `${i.length} exam${i.length === 1 ? "" : "s"}`, this.dom.pastPaperExamsGrid.innerHTML = "", i.forEach((e, t) => {
			let i = document.createElement("button");
			i.type = "button", i.className = "quizlist-card", i.innerHTML = `
        <div class="quizlist-card-row">
          <span class="quizlist-card-index">${t + 1}</span>
          <div class="quizlist-card-main">
            <div class="quizlist-card-topline">
              <span class="quizlist-card-num">${this.escapeHtml(n)}</span>
            </div>
            <div class="quizlist-card-title">${this.escapeHtml(e.title)}</div>
            <div class="quizlist-card-meta">
              <span class="quizlist-card-question-count">${e.unitCount} question${e.unitCount === 1 ? "" : "s"}</span>
              <span class="quizlist-card-attempts">${e.totalMarks} marks</span>
            </div>
          </div>
          <div class="quizlist-card-trailing">
            <div class="quizlist-card-metric">
              <div class="quizlist-card-metric-label">Best</div>
              <div class="quizlist-card-metric-value">${e.bestPercentage ? `${e.bestPercentage}%` : "--"}</div>
            </div>
            <span class="quizlist-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
            </span>
          </div>
        </div>
      `, i.onclick = () => void this.openPastPaperSettings(e, n, r), this.dom.pastPaperExamsGrid.appendChild(i);
		}), this.showOnly("past-paper-exams-view"));
	},
	renderPastPaperUnitMarkup(e, t) {
		let n = this.getPastPaperState().negativeMarking ? "NEGATIVE MARKING" : "STANDARD MARKING", r = e.imageUrl ? `
        <div class="question-image-wrap">
          <img class="question-image" src="${this.escapeHtml(e.imageUrl)}" alt="Stem image ${t + 1}">
        </div>
      ` : "", i = e.branches.map((e) => {
			let t = this.escapeHtml(e.branchId), n = Number(e.order || 0);
			return `
          <div class="past-paper-branch" data-branch-id="${t}">
            <div class="past-paper-branch-copy">
              <span class="past-paper-branch-number">${[
				"a",
				"b",
				"c",
				"d",
				"e"
			][n - 1] || ""}</span>
              <p class="past-paper-branch-prompt">${this.escapeHtml(e.prompt)}</p>
            </div>
            <div class="tf-options past-paper-branch-options" role="radiogroup" aria-label="Statement ${n || ""} answer">
              <label class="quiz-choice tf-btn opt-true" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${t}" value="true" data-branch-input="${t}">
                <span class="past-paper-option-text">True</span>
              </label>
              <label class="quiz-choice tf-btn opt-false" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${t}" value="false" data-branch-input="${t}">
                <span class="past-paper-option-text">False</span>
              </label>
              <label class="quiz-choice tf-btn opt-not-sure" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${t}" value="not_sure" data-branch-input="${t}">
                <span class="past-paper-option-text">Not sure</span>
              </label>
            </div>
          </div>
        `;
		}).join("");
		return `
      <article class="question-card question-card-tf past-paper-unit-card">
        <div class="question-meta">
          <span class="q-number">QUESTION ${t + 1}</span>
          <span class="q-type-badge">${e.branches.length} ${e.branches.length === 1 ? "MARK" : "MARKS"} · ${n}</span>
        </div>
        <p class="question-stem">${this.escapeHtml(e.stem)}</p>
        ${r}
        <div class="past-paper-branches">${i}</div>
      </article>
    `;
	},
	getPastPaperDraftStorageKey(e = this.getPastPaperState().currentSetId) {
		return `${this.getStorageNamespace()}:past-paper-draft:${L(e)}`;
	},
	isPastPaperDraftForCurrentSettings(e) {
		if (!e) return !1;
		let t = this.getPastPaperState(), n = e.context || {};
		return this.normalizeQuizDurationMinutes(e.durationMinutes ?? n.durationMinutes) === this.normalizeQuizDurationMinutes(t.durationMinutes) && !!(e.negativeMarking ?? n.negativeMarking) == !!t.negativeMarking;
	},
	async loadPastPaperSessionPage(e = this.getPastPaperState().currentSetId) {
		let t = L(e);
		if (!t) return null;
		let n = this.getPastPaperState();
		this.rememberAssessmentSettings("past_paper", t, {
			durationMinutes: n.durationMinutes,
			negativeMarking: n.negativeMarking
		});
		let r = this.buildAssessmentProgressKey({
			mode: "exam",
			durationMinutes: n.durationMinutes,
			negativeMarking: n.negativeMarking
		}), i = this.getCachedAssessmentProgress("past_paper", t, r), { data: a, error: o } = await this.withTimeout(this.getSupabase().rpc("app_past_paper_session", {
			p_set_id: t,
			p_progress_key: i.hit ? null : r
		}), 12e3, "Loading past paper exam");
		if (o) throw o;
		if (!a || Array.isArray(a) || typeof a != "object" || Number(a.schemaVersion) !== 1 || !Array.isArray(a.units)) throw Error("Past paper session returned an invalid response.");
		let s = a.paper;
		if (!s || typeof s != "object") return null;
		let c = {
			setId: s.setId || s.set_id || t,
			title: L(s.title) || "Past Paper",
			yearLabel: L(s.yearLabel || s.year_label),
			topicLabel: L(s.topicLabel || s.topic_label),
			paperGroupLabel: L(s.paperGroupLabel || s.paper_group_label)
		}, l = this.normalizePastPaperUnitRows(a.units), u = i.value;
		i.hit || (u = this.normalizeAccountAssessmentProgress(a.progress), this.cacheAssessmentProgress("past_paper", t, r, u));
		let d = this.getPastPaperDraftStorageKey(t), f = this.readStoredJson(d), p = this.isPastPaperDraftForCurrentSettings(f) ? f : null, m = this.isPastPaperDraftForCurrentSettings(u) ? u : null, h = this.chooseNewestAssessmentDraft(p, m);
		return h === m && h && this.writeStoredJson(d, h), {
			exam: c,
			units: l,
			draft: h
		};
	},
	serializePastPaperDraft() {
		let e = this.getPastPaperState(), t = {};
		return this.dom.pastPaperForm?.querySelectorAll("input[data-branch-input]:checked").forEach((e) => {
			t[e.dataset.branchInput] = e.value;
		}), {
			context: {
				year: e.currentYear,
				topic: e.currentTopic,
				title: e.activeExam?.title || "Past Paper",
				mode: "exam",
				durationMinutes: e.durationMinutes,
				negativeMarking: e.negativeMarking
			},
			answers: t,
			durationMinutes: e.durationMinutes,
			negativeMarking: e.negativeMarking,
			timerExpiresAt: e.durationMinutes && this.pastPaperCountdownDeadline ? new Date(this.pastPaperCountdownDeadline).toISOString() : null,
			savedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	},
	persistCurrentPastPaperDraft() {
		let e = L(this.getPastPaperState().currentSetId);
		if (!e || !this.dom.pastPaperForm) return;
		let t = this.serializePastPaperDraft();
		this.writeStoredJson(this.getPastPaperDraftStorageKey(e), t), this.saveAccountAssessmentProgress("past_paper", e, t);
	},
	restorePastPaperDraftIntoForm(e) {
		if (!e?.answers || !this.dom.pastPaperForm) return !1;
		let t = 0;
		return Object.entries(e.answers).forEach(([e, n]) => {
			let r = Array.from(this.dom.pastPaperForm.querySelectorAll("input[data-branch-input]")).find((t) => t.dataset.branchInput === e && t.value === String(n));
			r && (r.checked = !0, r.closest("[data-quiz-choice]")?.classList.add("selected"), t += 1);
		}), t > 0;
	},
	clearPastPaperDraft(e = this.getPastPaperState().currentSetId) {
		let t = L(e);
		return t ? (this.removeStoredJson(this.getPastPaperDraftStorageKey(t)), this.clearAccountAssessmentProgress("past_paper", t, {
			mode: "exam",
			durationMinutes: this.getPastPaperState().durationMinutes,
			negativeMarking: this.getPastPaperState().negativeMarking
		})) : Promise.resolve();
	},
	stopPastPaperCountdown() {
		this.pastPaperCountdownInterval && (window.clearInterval(this.pastPaperCountdownInterval), this.pastPaperCountdownInterval = null), this.pastPaperCountdownDeadline = 0;
	},
	updatePastPaperTimerUI() {
		let e = this.getPastPaperState(), t = this.normalizeQuizDurationMinutes(e.durationMinutes);
		if (!t) return;
		let n = Number.isFinite(e.timeRemainingSeconds) && e.timeRemainingSeconds !== null ? e.timeRemainingSeconds : t * 60, r = document.getElementById("past-paper-progress-copy");
		r && (r.textContent = this.formatQuizTimer(n));
	},
	startPastPaperCountdown(e = null) {
		this.stopPastPaperCountdown();
		let t = this.getPastPaperState(), n = this.normalizeQuizDurationMinutes(t.durationMinutes);
		if (!n) return;
		t.durationMinutes = n;
		let r = Date.parse(e?.timerExpiresAt || "");
		if (this.pastPaperCountdownDeadline = Number.isFinite(r) ? r : Date.now() + n * 60 * 1e3, t.timeRemainingSeconds = Math.max(0, Math.ceil((this.pastPaperCountdownDeadline - Date.now()) / 1e3)), this.updatePastPaperTimerUI(), t.timeRemainingSeconds <= 0) {
			window.setTimeout(() => {
				this.showToast("Time is up. Past paper submitted automatically."), this.handlePastPaperSubmission({
					force: !0,
					timedOut: !0
				});
			}, 0);
			return;
		}
		this.pastPaperCountdownInterval = window.setInterval(async () => {
			if (window.location.pathname !== "/past-papers/session/") {
				this.stopPastPaperCountdown();
				return;
			}
			let e = Math.max(0, Math.ceil((this.pastPaperCountdownDeadline - Date.now()) / 1e3));
			t.timeRemainingSeconds = e, this.updatePastPaperTimerUI(), !(e > 0) && (this.stopPastPaperCountdown(), document.dispatchEvent(new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: !0
			})), this.showToast("Time is up. Past paper submitted automatically."), await this.handlePastPaperSubmission({
				force: !0,
				timedOut: !0
			}));
		}, 250);
	},
	async renderPastPaperSession() {
		let e = `${window.location.pathname}${window.location.search}`, t = this.getPastPaperState(), n = L(t.currentSetId);
		if (!n) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		this.showLoadingView();
		let r;
		try {
			r = await (this.consumeInitialRoutePrefetch("past-paper-session") || this.loadPastPaperSessionPage(n));
		} catch (e) {
			if (console.error("Past paper exam load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load this past paper.");
			return;
		}
		if (`${window.location.pathname}${window.location.search}` !== e) return;
		if (!r) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		let { exam: i, units: a, draft: o } = r;
		t.currentYear = i.yearLabel || t.currentYear, t.currentTopic = i.topicLabel || t.currentTopic, t.activeExam = i, t.activeUnits = a, t.unitsBySetId[n] = a;
		let s = a.reduce((e, t) => e + t.branches.length, 0), c = t.durationMinutes ? `${t.durationMinutes} min` : "No time";
		this.showOnly("past-paper-session-view");
		let l = document.getElementById("past-paper-session-view");
		l && (l.dataset.negativeMarking = t.negativeMarking ? "true" : "false"), document.getElementById("past-paper-mode-badge").textContent = `PAST PAPER · ${c.toUpperCase()}`, document.getElementById("past-paper-page-kicker").textContent = `${i.yearLabel || t.currentYear} / ${i.topicLabel || t.currentTopic} / ${i.title}`, document.getElementById("past-paper-page-title").textContent = "", document.getElementById("past-paper-page-meta").textContent = "", document.getElementById("past-paper-total-count").textContent = String(s), document.getElementById("past-paper-unit-count").textContent = String(a.length), document.getElementById("past-paper-answered-count").textContent = "0", document.getElementById("past-paper-progress-count").textContent = `0 / ${s}`, document.getElementById("past-paper-progress-fill").style.width = "0%", document.getElementById("past-paper-progress-copy").textContent = `0/${s} answered`, this.dom.pastPaperSubmitBtn.disabled = s === 0, this.dom.pastPaperForm.innerHTML = a.map((e, t) => this.renderPastPaperUnitMarkup(e, t)).join(""), this.dom.pastPaperForm.onsubmit = (e) => {
			e.preventDefault();
		}, this.dom.pastPaperForm.onchange = (e) => {
			let t = e.target.closest?.("input[type=\"radio\"]");
			t && (this.dom.pastPaperForm.querySelectorAll(`input[name="${t.name}"]`).forEach((e) => {
				e.closest("[data-quiz-choice]")?.classList.remove("selected");
			}), t.closest("[data-quiz-choice]")?.classList.add("selected"), this.updatePastPaperProgressUI(), this.persistCurrentPastPaperDraft());
		}, this.dom.pastPaperSubmitBtn.onclick = () => {
			this.handlePastPaperSubmission();
		}, this.restorePastPaperDraftIntoForm(o) && this.showToast("Restored your saved exam progress."), this.updatePastPaperProgressUI(), this.startPastPaperCountdown(o), this.writeStoredJson(this.getPastPaperDraftStorageKey(n), this.serializePastPaperDraft());
	},
	getPastPaperAnswerMap() {
		let e = {};
		return this.dom.pastPaperForm?.querySelectorAll("input[data-branch-input]:checked").forEach((t) => {
			t.value !== "not_sure" && (e[t.dataset.branchInput] = t.value);
		}), e;
	},
	getPastPaperSelectedCount() {
		return this.dom.pastPaperForm?.querySelectorAll("input[data-branch-input]:checked").length || 0;
	},
	updatePastPaperProgressUI() {
		let e = this.getPastPaperState().activeUnits.reduce((e, t) => e + t.branches.length, 0), t = this.getPastPaperSelectedCount(), n = e ? Math.round(t / e * 100) : 0;
		document.getElementById("past-paper-answered-count").textContent = String(t), document.getElementById("past-paper-progress-count").textContent = `${t} / ${e}`, document.getElementById("past-paper-progress-fill").style.width = `${n}%`, this.getPastPaperState().durationMinutes ? this.updatePastPaperTimerUI() : document.getElementById("past-paper-progress-copy").textContent = `${t}/${e} answered`, this.dom.pastPaperSubmitBtn && (this.dom.pastPaperSubmitBtn.disabled = e === 0);
	},
	async handlePastPaperSubmission({ force: e = !1, timedOut: t = !1 } = {}) {
		let n = this.getPastPaperState(), r = L(n.currentSetId);
		if (!r || this.pastPaperSubmissionInFlight) return;
		let i = n.activeUnits.reduce((e, t) => e + t.branches.length, 0), a = this.getPastPaperSelectedCount(), o = Math.max(0, i - a);
		if (!(o > 0 && !e && !await E({
			title: "Submit incomplete exam",
			message: `${o} unanswered branch${o === 1 ? "" : "es"} remaining. Submit anyway?`,
			submitLabel: "Submit anyway",
			cancelLabel: "Keep answering"
		}))) {
			this.pastPaperSubmissionInFlight = !0, this.stopPastPaperCountdown(), this.dom.pastPaperSubmitBtn && (this.dom.pastPaperSubmitBtn.disabled = !0);
			try {
				let { data: e, error: i } = await this.withTimeout(N(this.getSupabase(), r, this.getPastPaperAnswerMap(), {
					durationMinutes: n.durationMinutes,
					negativeMarking: n.negativeMarking,
					timedOut: t
				}), 12e3, "Submitting past paper");
				if (i) throw i;
				let a = e?.attemptId || e?.attempt_id;
				await this.clearPastPaperDraft(r), this.getPastPaperState().reviewsByAttemptId = {}, this.invalidatePastPaperDerivedCaches?.(), this.invalidateHomeDashboardData?.(), await this.navigate("past-paper-review", {
					attemptId: a,
					duration: n.durationMinutes || "",
					negativeMarking: n.negativeMarking,
					timedOut: t
				});
			} catch (e) {
				if (console.error("Past paper submission failed:", e), await this.handleAccessRestriction(e)) return;
				this.showToast(e?.message || "Could not submit past paper."), this.updatePastPaperProgressUI();
			} finally {
				this.pastPaperSubmissionInFlight = !1;
			}
		}
	},
	async loadPastPaperAttemptReview(e) {
		let t = L(e);
		if (!t) return null;
		let n = this.getPastPaperState(), r = n.reviewsByAttemptId[t] || null;
		if (!r) {
			let { data: e, error: i } = await this.withTimeout(P(this.getSupabase(), t), 12e3, "Loading past paper review");
			if (i) throw i;
			r = e || {}, n.reviewsByAttemptId[t] = r;
		}
		return r;
	},
	async renderPastPaperReview() {
		let e = this.getPastPaperState(), t = L(e.currentAttemptId);
		if (!t) {
			await this.navigate("home", {}, { replace: !0 });
			return;
		}
		this.showLoadingView();
		let n;
		try {
			n = await (this.consumeInitialRoutePrefetch("past-paper-review") || this.loadPastPaperAttemptReview(t));
		} catch (e) {
			if (console.error("Past paper review load failed:", e), await this.handleAccessRestriction(e)) return;
			this.showFatalLoadError(e?.message || "Could not load past paper review.");
			return;
		}
		let r = n.attempt || {}, i = Array.isArray(n.units) ? n.units : [], a = L(r.setId || r.set_id || "");
		a && (e.currentSetId = a, e.currentYear = L(r.yearLabel || r.year_label) || e.currentYear, e.currentTopic = L(r.topicLabel || r.topic_label) || e.currentTopic, e.activeExam = {
			setId: a,
			title: L(r.title || r.quizTitle || r.quiz_title) || "Past Paper",
			yearLabel: e.currentYear,
			topicLabel: e.currentTopic
		}), this.showOnly("past-paper-review-view"), document.getElementById("past-paper-review-title").textContent = "Past Paper Result", document.getElementById("past-paper-review-kicker").textContent = "Attempt result";
		let o = Number(r.score || 0), s = Number(r.totalMarks || 0), c = Number(r.correct || 0), l = Number(r.wrong || 0), u = Number(r.unanswered || 0), d = typeof r.negativeMarking == "boolean" || typeof r.negative_marking == "boolean", f = d ? r.negativeMarking === !0 || r.negative_marking === !0 : e.negativeMarking, p = Number(d ? r.durationMinutes || r.duration_minutes || 0 : e.durationMinutes || 0);
		e.negativeMarking = f, e.durationMinutes = p || null;
		let m = !d && f ? c - l : o;
		document.getElementById("past-paper-review-score").textContent = `${m}/${s}`;
		let h = !d && f ? Math.round(Math.max(m, 0) / Math.max(s, 1) * 100) : Number(r.percentage || 0), g = document.getElementById("past-paper-review-percent");
		g.textContent = `${h}%`, g.className = `results-score-pct ${this.getResultsPercentageTone?.(h) || "poor"}`, document.getElementById("past-paper-review-correct").textContent = String(c), document.getElementById("past-paper-review-wrong").textContent = String(l), document.getElementById("past-paper-review-unanswered").textContent = String(u), this.updatePastPaperReviewSegments(c, l, u, s), document.getElementById("past-paper-review-count").textContent = `${i.length} ${i.length === 1 ? "question" : "questions"}`, this.dom.pastPaperReviewList.innerHTML = i.map((e, t) => this.renderPastPaperReviewUnit(e, t)).join(""), this.bindPastPaperReviewActions();
	},
	updatePastPaperReviewSegments(e, t, n, r) {
		let i = Number(r || 0), a = (e, t) => {
			let n = document.getElementById(e);
			n && (n.style.width = i ? `${Math.max(0, Number(t || 0) / i * 100)}%` : "0%");
		};
		a("past-paper-review-correct-segment", e), a("past-paper-review-wrong-segment", t), a("past-paper-review-unanswered-segment", n);
	},
	bindPastPaperReviewActions() {
		let e = document.getElementById("btn-retry-past-paper"), t = document.getElementById("btn-past-paper-back-list"), n = this.getPastPaperState();
		e && (e.onclick = () => {
			let e = L(n.currentSetId);
			if (!e) {
				this.navigate("past-paper-topics", { year: n.currentYear || this.state.currentLevel });
				return;
			}
			this.navigate("past-paper-session", {
				setId: e,
				year: n.currentYear || this.state.currentLevel,
				topic: n.currentTopic || this.state.currentArea,
				duration: n.durationMinutes || "",
				negativeMarking: n.negativeMarking
			});
		}), t && (t.onclick = () => {
			let e = n.currentYear || this.state.currentLevel, t = n.currentTopic || this.state.currentArea;
			if (e && t) {
				this.navigate("past-paper-exams", {
					year: e,
					topic: t
				});
				return;
			}
			this.navigate("past-paper-topics", { year: e });
		});
	},
	renderPastPaperReviewUnit(e, t) {
		let n = Array.isArray(e.branches) ? e.branches : [], r = n.filter((e) => e.isCorrect).length;
		return `
      <section class="past-paper-review-question ${r === n.length ? "is-correct" : "is-mixed"}" aria-label="Question ${t + 1}">
        <div class="past-paper-review-question-head">
          <span class="review-q-num">QUESTION ${t + 1}</span>
          <span class="q-type-badge">${n.length} ${n.length === 1 ? "MARK" : "MARKS"}</span>
        </div>
        <p class="past-paper-review-parent">${this.escapeHtml(e.stem || "")}</p>
        <div class="past-paper-review-scoreline">
          <span class="verdict-badge ${r === n.length ? "correct" : "wrong"}">${r}/${n.length} CORRECT</span>
        </div>
        <div class="past-paper-review-branches">
          ${n.map((e) => this.renderPastPaperReviewBranch(e)).join("")}
        </div>
      </section>
    `;
	},
	renderPastPaperReviewBranch(e) {
		let t = [
			"a",
			"b",
			"c",
			"d",
			"e"
		][Number(e.order || 0) - 1] || "", n = e.userAnswer !== !0 && e.userAnswer !== !1, r = e.isCorrect ? "is-correct" : n ? "is-unsure" : "is-wrong", i = e.isCorrect ? "correct" : n ? "unsure" : "wrong", a = e.isCorrect ? "Correct (+1)" : n ? "Unanswered (0)" : this.getPastPaperState().negativeMarking ? "Incorrect (-1)" : "Incorrect (0)", o = e.explanation ? `
        <div class="explanation past-paper-review-explanation result-explanation" data-open="false" data-hide-label="HIDE EXPLANATION">
          <button class="result-explanation-toggle" type="button" aria-expanded="false">
            <span class="result-explanation-toggle-text">VIEW EXPLANATION</span>
            <span class="result-explanation-chevron" aria-hidden="true"></span>
          </button>
          <div class="result-explanation-panel" aria-hidden="true">
            <div class="result-explanation-inner">
              <p class="explanation-text">${this.escapeHtml(e.explanation)}</p>
            </div>
          </div>
        </div>
      ` : "", s = e.isCorrect ? `
        <div class="answer-grid single">
          <div class="answer-chip your">
            <span class="chip-label">YOUR ANSWER</span>
            <span class="chip-val">${this.escapeHtml(R(e.userAnswer))}</span>
          </div>
        </div>
      ` : `
        <div class="answer-grid">
          <div class="answer-chip ${n ? "yours-unsure" : "yours-wrong"}">
            <span class="chip-label">YOUR ANSWER</span>
            <span class="chip-val">${this.escapeHtml(R(e.userAnswer))}</span>
          </div>
          <div class="answer-chip correct-ans">
            <span class="chip-label">CORRECT</span>
            <span class="chip-val">${this.escapeHtml(R(e.correctAnswer))}</span>
          </div>
        </div>
      `;
		return `
      <article class="past-paper-review-branch ${r}">
        <div class="past-paper-review-branch-head">
          <span class="past-paper-branch-number">${t}</span>
          <p class="past-paper-review-branch-prompt">${this.escapeHtml(e.prompt || "")}</p>
        </div>
        <div class="past-paper-review-branch-body">
          <span class="verdict-badge ${i}">${a}</span>
          ${s}
          ${o}
        </div>
      </article>
    `;
	}
};
//#endregion
//#region public/src/views/learner-layout.js
function B() {
	let e = document.getElementById("app-route-root"), t = document.body.dataset.appPage || "home";
	if (!e) return;
	let n = {
		home: "Bitramed Home",
		year: "Bitramed Year",
		modules: "Bitramed Modules",
		subtopics: "Bitramed Subtopics",
		types: "Bitramed Question Types",
		quizzes: "Bitramed Quizzes",
		quiz: "Bitramed Quiz",
		results: "Bitramed Results",
		"past-paper-topics": "Bitramed Past Papers",
		"past-paper-exams": "Bitramed Past Paper Exams",
		"past-paper-session": "Bitramed Past Paper",
		"past-paper-review": "Bitramed Past Paper Result",
		account: "Bitramed Account",
		settings: "Bitramed Settings",
		access: "Bitramed Access"
	}, r = {
		dashboard: "\n      <section id=\"dashboard-view\" class=\"view browse-view\" hidden>\n        <div class=\"dashboard-hero-panel\">\n          <div class=\"dashboard-hero-copy\">\n            <div class=\"browse-eyebrow\">\n              <span class=\"browse-eyebrow-line\"></span>\n              <span class=\"browse-eyebrow-text\">Learning Home</span>\n            </div>\n            <div id=\"dashboard-greeting-row\" class=\"dashboard-greeting-row\">\n              <h2 id=\"dashboard-greeting\" class=\"dashboard-greeting\">Good morning,</h2>\n              <p id=\"dashboard-greeting-name\" class=\"dashboard-greeting-name\">Learner.</p>\n            </div>\n          </div>\n        </div>\n        <div class=\"dashboard-summary-strip\">\n          <div class=\"dashboard-summary-cell\">\n            <div id=\"dashboard-active-years\" class=\"dashboard-summary-value\">0</div>\n            <div class=\"dashboard-summary-key\">Active Years</div>\n          </div>\n          <div class=\"dashboard-summary-cell\">\n            <div id=\"dashboard-completed-count\" class=\"dashboard-summary-value\">0</div>\n            <div class=\"dashboard-summary-key\">Assessments Done</div>\n          </div>\n          <div class=\"dashboard-summary-cell\">\n            <div id=\"dashboard-average-score\" class=\"dashboard-summary-value good\">0%</div>\n            <div class=\"dashboard-summary-key\">Avg. Score</div>\n          </div>\n        </div>\n        <div class=\"browse-section-label\">\n          <span class=\"browse-section-title\">Years</span>\n          <span id=\"dashboard-section-count\" class=\"browse-section-count\">0 years total</span>\n        </div>\n        <div id=\"area-grid\" class=\"browse-card-list\"></div>\n      </section>\n    ",
		year: "\n      <section id=\"year-view\" class=\"view browse-view\" hidden>\n        <div class=\"browse-header\">\n          <div class=\"browse-eyebrow\">\n            <span class=\"browse-eyebrow-line\"></span>\n            <span id=\"year-page-kicker\" class=\"browse-eyebrow-text\">Year</span>\n          </div>\n          <h2 id=\"year-page-title\" class=\"browse-page-title\">Year</h2>\n          <p id=\"year-page-subtitle\" class=\"browse-page-subtitle\"></p>\n        </div>\n        <div class=\"browse-section-label\">\n          <span class=\"browse-section-title\">Choose Path</span>\n          <span id=\"year-section-count\" class=\"browse-section-count\">0 options</span>\n        </div>\n        <div id=\"year-option-grid\" class=\"browse-card-list\"></div>\n      </section>\n    ",
		modules: "\n      <section id=\"modules-view\" class=\"view browse-view\" hidden>\n        <div class=\"browse-header\">\n          <div class=\"browse-eyebrow\">\n            <span class=\"browse-eyebrow-line\"></span>\n            <span id=\"modules-page-kicker\" class=\"browse-eyebrow-text\">Level</span>\n          </div>\n          <h2 id=\"module-page-title\" class=\"browse-page-title\">Courses</h2>\n          <p id=\"module-page-subtitle\" class=\"browse-page-subtitle\"></p>\n        </div>\n        <div class=\"browse-section-label\">\n          <span class=\"browse-section-title\">Courses</span>\n          <span id=\"modules-section-count\" class=\"browse-section-count\">0 total</span>\n        </div>\n        <div id=\"module-grid\" class=\"browse-card-list\"></div>\n      </section>\n    ",
		pastPaperTopics: "\n      <section id=\"past-paper-topics-view\" class=\"view browse-view past-paper-view\" hidden>\n        <div class=\"browse-header\">\n          <div class=\"browse-eyebrow\">\n            <span class=\"browse-eyebrow-line\"></span>\n            <span id=\"past-paper-topics-kicker\" class=\"browse-eyebrow-text\">Year</span>\n          </div>\n          <h2 id=\"past-paper-topics-title\" class=\"browse-page-title\">Past Papers</h2>\n          <p id=\"past-paper-topics-subtitle\" class=\"browse-page-subtitle\"></p>\n        </div>\n        <div class=\"browse-section-label\">\n          <span class=\"browse-section-title\"></span>\n          <span id=\"past-paper-topics-count\" class=\"browse-section-count\"></span>\n        </div>\n        <div id=\"past-paper-topics-grid\" class=\"browse-card-list\"></div>\n      </section>\n    ",
		pastPaperExams: "\n      <section id=\"past-paper-exams-view\" class=\"view quizlist-view past-paper-view\" hidden>\n        <div class=\"quizlist-shell\">\n          <div class=\"quizlist-header\">\n            <div class=\"quizlist-header-copy\">\n              <div class=\"quizlist-eyebrow\">\n                <span class=\"quizlist-eyebrow-line\"></span>\n                <span id=\"past-paper-exams-kicker\" class=\"quizlist-eyebrow-text\">Past Papers</span>\n                <span class=\"quizlist-eyebrow-line\"></span>\n              </div>\n              <h2 id=\"past-paper-exams-title\" class=\"quizlist-title\">Topic</h2>\n            </div>\n          </div>\n          <p id=\"past-paper-exams-subtitle\" class=\"browse-page-subtitle\"></p>\n          <div class=\"quizlist-section-label\">\n            <span class=\"quizlist-section-title\">Exam Papers</span>\n            <span id=\"past-paper-exams-count\" class=\"quizlist-section-count\">0 exams</span>\n          </div>\n          <div id=\"past-paper-exams-grid\" class=\"quizlist-cards\"></div>\n        </div>\n      </section>\n    ",
		pastPaperSession: "\n      <section id=\"past-paper-session-view\" class=\"view quiz-session-view past-paper-session-view\" hidden>\n        <div class=\"quiz-session-page\">\n          <div class=\"quiz-session-header\">\n            <div id=\"past-paper-mode-badge\" class=\"quiz-session-mode-badge\">Past Paper</div>\n            <div class=\"quiz-session-assessment-label\">\n              <span id=\"past-paper-page-kicker\" class=\"quiz-session-assessment-text\">Year / Topic</span>\n            </div>\n            <h2 id=\"past-paper-page-title\" class=\"quiz-session-title\">Past Paper</h2>\n            <p id=\"past-paper-page-meta\" class=\"quiz-session-subtitle\"></p>\n          </div>\n\n          <div class=\"quiz-session-stats\">\n            <div class=\"quiz-session-stat-cell\">\n              <div id=\"past-paper-total-count\" class=\"quiz-session-stat-value\">0</div>\n              <div class=\"quiz-session-stat-key\">Marks</div>\n            </div>\n            <div class=\"quiz-session-stat-cell\">\n              <div id=\"past-paper-answered-count\" class=\"quiz-session-stat-value\">0</div>\n              <div class=\"quiz-session-stat-key\">Answered</div>\n            </div>\n            <div class=\"quiz-session-stat-cell\">\n              <div id=\"past-paper-unit-count\" class=\"quiz-session-stat-value\">0</div>\n              <div class=\"quiz-session-stat-key\">Questions</div>\n            </div>\n          </div>\n\n          <div class=\"quiz-progress-wrap\">\n            <div class=\"quiz-progress-meta\">\n              <span class=\"quiz-progress-label\">Progress</span>\n              <span id=\"past-paper-progress-count\" class=\"quiz-progress-count\">0 / 0</span>\n            </div>\n            <div class=\"quiz-progress-track\">\n              <div id=\"past-paper-progress-fill\" class=\"quiz-progress-fill\" style=\"width: 0%\"></div>\n            </div>\n          </div>\n\n          <form id=\"past-paper-form\" class=\"quiz-session-form past-paper-form\"></form>\n        </div>\n\n        <div class=\"quiz-submit-bar\">\n          <div class=\"quiz-submit-inner\">\n            <button id=\"btn-submit-past-paper\" class=\"quiz-submit-btn\" type=\"button\" disabled>\n              <span id=\"past-paper-progress-copy\" class=\"quiz-submit-progress\">0/0 answered</span>\n              <span class=\"quiz-submit-btn-label\">Submit</span>\n              <span class=\"quiz-submit-btn-arrow\" aria-hidden=\"true\">\n                <svg viewBox=\"0 0 24 24\">\n                  <path d=\"M5 12h12\"></path>\n                  <path d=\"M13 6l6 6-6 6\"></path>\n                </svg>\n              </span>\n            </button>\n          </div>\n        </div>\n      </section>\n    ",
		pastPaperReview: "\n      <section id=\"past-paper-review-view\" class=\"view results-page-view past-paper-review-view\" hidden>\n        <div class=\"results-page-shell\">\n          <div class=\"results-page-header\">\n            <div class=\"results-page-eyebrow\">\n              <span class=\"results-page-eyebrow-line\"></span>\n              <span id=\"past-paper-review-kicker\" class=\"results-page-eyebrow-text\">Attempt result</span>\n            </div>\n            <h2 id=\"past-paper-review-title\" class=\"results-page-title\">Past Paper Result</h2>\n          </div>\n\n          <div class=\"results-score-hero\">\n            <div class=\"results-score-top\">\n              <div class=\"results-score-main\">\n                <div id=\"past-paper-review-score\" class=\"results-score-fraction\">0/0</div>\n                <div class=\"results-score-label\">Score</div>\n              </div>\n              <div class=\"results-score-pct-block\">\n                <div id=\"past-paper-review-percent\" class=\"results-score-pct poor\">0%</div>\n                <div class=\"results-score-pct-label\">Percentage</div>\n              </div>\n            </div>\n\n            <div class=\"results-score-bar-wrap\">\n              <div class=\"results-score-bar-track\" aria-hidden=\"true\">\n                <div class=\"results-score-bar-segments\">\n                  <div id=\"past-paper-review-correct-segment\" class=\"results-score-segment seg-correct\"></div>\n                  <div id=\"past-paper-review-wrong-segment\" class=\"results-score-segment seg-wrong\"></div>\n                  <div id=\"past-paper-review-unanswered-segment\" class=\"results-score-segment seg-unsure\"></div>\n                </div>\n              </div>\n            </div>\n\n            <div class=\"results-score-breakdown\">\n              <div class=\"results-breakdown-cell\">\n                <div id=\"past-paper-review-correct\" class=\"results-breakdown-value correct\">0</div>\n                <div class=\"results-breakdown-label\">Correct</div>\n              </div>\n              <div class=\"results-breakdown-cell\">\n                <div id=\"past-paper-review-wrong\" class=\"results-breakdown-value wrong\">0</div>\n                <div class=\"results-breakdown-label\">Wrong</div>\n              </div>\n              <div class=\"results-breakdown-cell\">\n                <div id=\"past-paper-review-unanswered\" class=\"results-breakdown-value unsure\">0</div>\n                <div class=\"results-breakdown-label\">Unanswered</div>\n              </div>\n            </div>\n          </div>\n\n          <div class=\"results-section-header\">\n            <span class=\"results-section-title\">Question Review</span>\n            <span id=\"past-paper-review-count\" class=\"results-section-count\">0 branches</span>\n          </div>\n\n          <div id=\"past-paper-review-list\" class=\"results-review-list\"></div>\n\n          <div id=\"past-paper-results-bottom-actions\" class=\"results-bottom-actions\">\n            <button id=\"btn-retry-past-paper\" class=\"results-bottom-btn primary\" type=\"button\">Retry Past Paper</button>\n            <button id=\"btn-past-paper-back-list\" class=\"results-bottom-btn secondary\" type=\"button\">Back to Exams</button>\n          </div>\n        </div>\n      </section>\n    ",
		subtopics: "\n      <section id=\"subtopics-view\" class=\"view browse-view\" hidden>\n        <div class=\"browse-header\">\n          <div class=\"browse-eyebrow\">\n            <span class=\"browse-eyebrow-line\"></span>\n            <span id=\"subtopics-page-kicker\" class=\"browse-eyebrow-text\">Course</span>\n          </div>\n          <h2 id=\"subtopics-page-title\" class=\"browse-page-title\">Chapters</h2>\n          <p id=\"subtopics-page-subtitle\" class=\"browse-page-subtitle\"></p>\n        </div>\n        <div class=\"browse-section-label\">\n          <span class=\"browse-section-title\">Chapters</span>\n          <span id=\"subtopics-section-count\" class=\"browse-section-count\">0 total</span>\n        </div>\n        <div id=\"subtopics-grid\" class=\"browse-card-list\"></div>\n      </section>\n    ",
		types: "\n      <section id=\"types-view\" class=\"view selection-view\" hidden>\n        <div class=\"selection-shell\">\n          <div class=\"selection-header\">\n            <div class=\"selection-eyebrow selection-page-eyebrow\">\n              <span class=\"selection-eyebrow-line\"></span>\n              <span id=\"types-page-kicker\" class=\"selection-eyebrow-text\">Question formats</span>\n              <span class=\"selection-eyebrow-line\"></span>\n            </div>\n            <h2 id=\"types-page-title\" class=\"selection-title\">Question Type</h2>\n            <div class=\"selection-stats\">\n              <div class=\"selection-stat-cell\">\n                <div id=\"types-complete-percent\" class=\"selection-stat-value muted\">0%</div>\n                <div class=\"selection-stat-key\">Mastered</div>\n              </div>\n              <div class=\"selection-stat-cell\">\n                <div id=\"types-total-questions\" class=\"selection-stat-value\">0</div>\n                <div class=\"selection-stat-key\">Questions</div>\n              </div>\n              <div class=\"selection-stat-cell\">\n                <div id=\"types-format-count\" class=\"selection-stat-value\">2</div>\n                <div class=\"selection-stat-key\">Formats</div>\n              </div>\n            </div>\n          </div>\n          <div class=\"selection-label-row\">\n            <span class=\"selection-label-title\">Available Formats</span>\n            <span class=\"selection-label-hint\">Choose One</span>\n          </div>\n          <div id=\"types-grid\" class=\"selection-cards\"></div>\n        </div>\n      </section>\n    ",
		quizzes: "\n      <section id=\"quiz-list-view\" class=\"view quizlist-view\" hidden>\n        <div class=\"quizlist-shell\">\n          <div class=\"quizlist-header\">\n            <div class=\"quizlist-header-copy\">\n              <div class=\"quizlist-eyebrow\">\n                <span class=\"quizlist-eyebrow-line\"></span>\n                <span id=\"quiz-list-kicker\" class=\"quizlist-eyebrow-text\">Topic</span>\n                <span class=\"quizlist-eyebrow-line\"></span>\n              </div>\n              <h2 id=\"quiz-list-title\" class=\"quizlist-title\">Quizzes</h2>\n              <div id=\"quiz-list-mode-badge\" class=\"quizlist-mode-badge\">Format</div>\n            </div>\n            <div class=\"quizlist-stat-bar\">\n              <div class=\"quizlist-stat-cell\">\n                <div id=\"quiz-list-assessment-count\" class=\"quizlist-stat-value\">0</div>\n                <div class=\"quizlist-stat-key\">Assessments</div>\n              </div>\n              <div class=\"quizlist-stat-cell\">\n                <div id=\"quiz-list-completed-count\" class=\"quizlist-stat-value\">0</div>\n                <div class=\"quizlist-stat-key\">Completed</div>\n              </div>\n              <div class=\"quizlist-stat-cell\">\n                <div id=\"quiz-list-average-score\" class=\"quizlist-stat-value\">--</div>\n                <div class=\"quizlist-stat-key\">Avg. Score</div>\n              </div>\n            </div>\n          </div>\n          <div class=\"quizlist-section-label\">\n            <span class=\"quizlist-section-title\">Assessment Ledger</span>\n            <span id=\"quiz-list-section-count\" class=\"quizlist-section-count\">0 total</span>\n          </div>\n          <div id=\"quiz-list\" class=\"quizlist-cards\"></div>\n        </div>\n      </section>\n    ",
		quiz: "\n      <section id=\"quiz-view\" class=\"view quiz-session-view\" hidden>\n        <div class=\"quiz-session-page\">\n          <div class=\"quiz-session-header\">\n            <div id=\"quiz-mode-badge\" class=\"quiz-session-mode-badge\">Mode</div>\n            <div class=\"quiz-session-assessment-label\">\n              <span id=\"quiz-page-kicker\" class=\"quiz-session-assessment-text\">Assessment 1</span>\n            </div>\n            <h2 id=\"quiz-page-title\" class=\"quiz-session-title\">Quiz</h2>\n            <p id=\"quiz-page-meta\" class=\"quiz-session-subtitle\"></p>\n          </div>\n\n          <div class=\"quiz-session-stats\">\n            <div class=\"quiz-session-stat-cell\">\n              <div id=\"quiz-total-count\" class=\"quiz-session-stat-value\">0</div>\n              <div class=\"quiz-session-stat-key\">Questions</div>\n            </div>\n            <div class=\"quiz-session-stat-cell\">\n              <div id=\"quiz-answered-count\" class=\"quiz-session-stat-value\">0</div>\n              <div class=\"quiz-session-stat-key\">Answered</div>\n            </div>\n            <div class=\"quiz-session-stat-cell\">\n              <div id=\"quiz-mode-stat\" class=\"quiz-session-stat-value\">No time</div>\n              <div class=\"quiz-session-stat-key\">Timer</div>\n            </div>\n          </div>\n\n          <div class=\"quiz-progress-wrap\">\n            <div class=\"quiz-progress-meta\">\n              <span class=\"quiz-progress-label\">Progress</span>\n              <span id=\"quiz-progress-count\" class=\"quiz-progress-count\">0 / 0</span>\n            </div>\n            <div class=\"quiz-progress-track\">\n              <div id=\"quiz-progress-fill\" class=\"quiz-progress-fill\" style=\"width: 0%\"></div>\n            </div>\n          </div>\n\n          <form id=\"quiz-form\" class=\"quiz-session-form\"></form>\n        </div>\n\n        <div class=\"quiz-submit-bar\">\n          <div class=\"quiz-submit-inner\">\n            <button id=\"btn-submit\" class=\"quiz-submit-btn\" type=\"button\" disabled>\n              <span id=\"quiz-progress-copy\" class=\"quiz-submit-progress\">0/0 answered</span>\n              <span class=\"quiz-submit-btn-label\">Submit Quiz</span>\n              <span class=\"quiz-submit-btn-arrow\" aria-hidden=\"true\">\n                <svg viewBox=\"0 0 24 24\">\n                  <path d=\"M5 12h12\"></path>\n                  <path d=\"M13 6l6 6-6 6\"></path>\n                </svg>\n              </span>\n            </button>\n          </div>\n        </div>\n      </section>\n    ",
		results: "\n      <section id=\"results-view\" class=\"view results-page-view\" hidden>\n        <div class=\"results-page-shell\">\n          <div class=\"results-page-header\">\n            <div class=\"results-page-eyebrow\">\n              <span class=\"results-page-eyebrow-line\"></span>\n              <span id=\"results-page-kicker\" class=\"results-page-eyebrow-text\">Assessment result</span>\n            </div>\n            <h2 id=\"results-page-title\" class=\"results-page-title\">Assessment</h2>\n            <p id=\"results-page-meta\" class=\"results-page-subtitle\"></p>\n          </div>\n\n          <div class=\"results-score-hero\">\n            <div class=\"results-score-top\">\n              <div class=\"results-score-main\">\n                <div id=\"final-score\" class=\"results-score-fraction\">0/0</div>\n                <div class=\"results-score-label\">Score</div>\n              </div>\n              <div class=\"results-score-pct-block\">\n                <div id=\"progress-text\" class=\"results-score-pct poor\">0%</div>\n                <div class=\"results-score-pct-label\">Percentage</div>\n              </div>\n            </div>\n\n            <div class=\"results-score-bar-wrap\">\n              <div class=\"results-score-bar-track\" aria-hidden=\"true\">\n                <div class=\"results-score-bar-segments\">\n                  <div id=\"results-correct-segment\" class=\"results-score-segment seg-correct\"></div>\n                  <div id=\"results-wrong-segment\" class=\"results-score-segment seg-wrong\"></div>\n                  <div id=\"results-unanswered-segment\" class=\"results-score-segment seg-unsure\"></div>\n                </div>\n              </div>\n            </div>\n\n            <div class=\"results-score-breakdown\">\n              <div class=\"results-breakdown-cell\">\n                <div id=\"count-correct\" class=\"results-breakdown-value correct\">0</div>\n                <div class=\"results-breakdown-label\">Correct</div>\n              </div>\n              <div class=\"results-breakdown-cell\">\n                <div id=\"count-wrong\" class=\"results-breakdown-value wrong\">0</div>\n                <div class=\"results-breakdown-label\">Wrong</div>\n              </div>\n              <div class=\"results-breakdown-cell\">\n                <div id=\"count-unanswered\" class=\"results-breakdown-value unsure\">0</div>\n                <div class=\"results-breakdown-label\">Unanswered</div>\n              </div>\n            </div>\n          </div>\n\n          <div class=\"results-meta-row\">\n            <div class=\"results-meta-card\">\n              <div id=\"results-attempt-count\" class=\"results-meta-value\">0</div>\n              <div class=\"results-meta-label\">Your Attempts</div>\n            </div>\n            <div class=\"results-meta-card\">\n              <div id=\"results-mode-label\" class=\"results-meta-value\">No time · Standard marking</div>\n              <div class=\"results-meta-label\">Settings</div>\n            </div>\n          </div>\n\n          <div class=\"results-callout\">\n            <div class=\"results-callout-label\">Saved to account history</div>\n            <div id=\"results-summary-headline\" class=\"results-callout-headline\">Results ready.</div>\n            <div id=\"results-summary-copy\" class=\"results-callout-body\">Review the explanations below, then go again when you are ready.</div>\n          </div>\n\n          <div class=\"results-section-header\">\n            <span class=\"results-section-title\">Question Review</span>\n            <span id=\"results-review-count\" class=\"results-section-count\">0 questions</span>\n          </div>\n\n          <div id=\"results-container\" class=\"results-review-list\"></div>\n\n          <div id=\"results-bottom-actions\" class=\"results-bottom-actions\">\n            <button id=\"btn-retry-results\" class=\"results-bottom-btn primary\" type=\"button\">Retry Quiz</button>\n            <button id=\"btn-results-back-list\" class=\"results-bottom-btn secondary\" type=\"button\">Back to Quiz List</button>\n          </div>\n        </div>\n        <div id=\"results-sticky-bar\" class=\"results-sticky-bar\">\n          <div class=\"results-sticky-inner\">\n            <button id=\"toggle-review-wrong-btn\" class=\"results-sticky-btn\" type=\"button\">\n              <span id=\"results-sticky-label\" class=\"results-sticky-label\">0 missed</span>\n              <span class=\"results-sticky-divider\" aria-hidden=\"true\">•</span>\n              <span id=\"results-sticky-action\" class=\"results-sticky-action\">Review Missed Only</span>\n            </button>\n          </div>\n        </div>\n      </section>\n    ",
		account: "\n      <section id=\"account-view\" class=\"view account-view\" hidden>\n        <div class=\"browse-header account-header\">\n          <div class=\"browse-eyebrow\">\n            <span class=\"browse-eyebrow-line\"></span>\n            <span class=\"browse-eyebrow-text\">Account Stats</span>\n          </div>\n          <h2 id=\"account-page-title\" class=\"browse-page-title\">Account</h2>\n          <p id=\"account-page-subtitle\" class=\"browse-page-subtitle\">Your learning progress and quiz history</p>\n        </div>\n        <div id=\"account-empty-state\" class=\"account-empty-state\" hidden>\n          <p class=\"muted\">No assessment history yet. Complete a quiz or Past Paper exam to see your stats here.</p>\n        </div>\n        <div id=\"account-content\">\n          <div id=\"account-overview-grid\" class=\"account-overview-grid\"></div>\n          <div class=\"account-section\">\n            <div class=\"section-head compact\">\n              <div>\n                <h2>Assessment Performance</h2>\n              </div>\n            </div>\n            <div id=\"account-mode-grid\" class=\"account-mode-grid\"></div>\n          </div>\n          <div class=\"account-section\">\n            <div class=\"section-head compact\">\n              <div>\n                <h2>Performance Per Course</h2>\n              </div>\n            </div>\n            <div id=\"account-course-grid\" class=\"account-course-grid\"></div>\n          </div>\n          <div class=\"account-section\">\n            <div class=\"section-head compact\">\n              <div>\n                <h2>Recent Assessment Activity</h2>\n              </div>\n            </div>\n            <div id=\"account-recent-list\" class=\"account-recent-list\"></div>\n          </div>\n        </div>\n      </section>\n    ",
		settings: "\n      <section id=\"settings-view\" class=\"view settings-view\" hidden>\n        <div class=\"settings-shell\">\n          <div class=\"settings-header\">\n            <div class=\"settings-eyebrow\">\n              <span class=\"settings-eyebrow-line\"></span>\n              <span class=\"settings-eyebrow-text\">Settings</span>\n              <span class=\"settings-eyebrow-line\"></span>\n            </div>\n            <h2 id=\"settings-page-title\" class=\"settings-page-title\">Account settings</h2>\n            <p id=\"settings-page-subtitle\" class=\"settings-page-subtitle\">Manage account access, appearance preference, and account actions.</p>\n            <div class=\"settings-summary-strip\">\n              <div class=\"settings-summary-cell\">\n                <div id=\"settings-access-status-value\" class=\"settings-summary-value\">Active</div>\n                <div class=\"settings-summary-key\">Access</div>\n              </div>\n              <div class=\"settings-summary-cell\">\n                <div id=\"settings-expiry-value\" class=\"settings-summary-value\">--</div>\n                <div class=\"settings-summary-key\">Expires</div>\n              </div>\n              <div class=\"settings-summary-cell\">\n                <div id=\"settings-days-left-value\" class=\"settings-summary-value good\">--</div>\n                <div class=\"settings-summary-key\">Time Left</div>\n              </div>\n            </div>\n          </div>\n          <div class=\"settings-sections\">\n            <section class=\"settings-section\">\n              <h3 class=\"settings-section-title\">Appearance</h3>\n              <div class=\"settings-row settings-row-theme\">\n                <span class=\"settings-row-label\">Theme preference</span>\n                <label class=\"settings-theme-toggle\" for=\"theme-mode-toggle\">\n                  <input id=\"theme-mode-toggle\" class=\"settings-theme-toggle-input\" type=\"checkbox\" aria-label=\"Toggle dark mode\">\n                  <span class=\"settings-theme-toggle-ui\" aria-hidden=\"true\">\n                    <span class=\"settings-theme-toggle-option\">\n                      <svg viewBox=\"0 0 24 24\">\n                        <circle cx=\"12\" cy=\"12\" r=\"4\"></circle>\n                        <path d=\"M12 2v2.5\"></path>\n                        <path d=\"M12 19.5V22\"></path>\n                        <path d=\"m4.93 4.93 1.77 1.77\"></path>\n                        <path d=\"m17.3 17.3 1.77 1.77\"></path>\n                        <path d=\"M2 12h2.5\"></path>\n                        <path d=\"M19.5 12H22\"></path>\n                        <path d=\"m4.93 19.07 1.77-1.77\"></path>\n                        <path d=\"m17.3 6.7 1.77-1.77\"></path>\n                      </svg>\n                    </span>\n                    <span class=\"settings-theme-toggle-option\">\n                      <svg viewBox=\"0 0 24 24\">\n                        <path d=\"M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z\"></path>\n                      </svg>\n                    </span>\n                    <span class=\"settings-theme-toggle-pill\"></span>\n                  </span>\n                </label>\n                <p id=\"settings-theme-note\" class=\"settings-theme-note\" hidden>Light mode is currently active.</p>\n              </div>\n            </section>\n\n            <section class=\"settings-section\">\n              <h3 class=\"settings-section-title\">Subscription</h3>\n              <div class=\"settings-section-rows\">\n                <div class=\"settings-row\">\n                  <div class=\"settings-row-leading\">\n                    <span class=\"settings-row-icon\" aria-hidden=\"true\">\n                      <svg viewBox=\"0 0 24 24\">\n                        <rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect>\n                        <path d=\"m3 7 9 6 9-6\"></path>\n                      </svg>\n                    </span>\n                    <span class=\"settings-row-label\">Account Email</span>\n                  </div>\n                  <span id=\"settings-email-value\" class=\"settings-row-value\">No email</span>\n                </div>\n\n                <div class=\"settings-row\">\n                  <span class=\"settings-row-label\">Status</span>\n                  <span id=\"settings-status-chip\" class=\"settings-status-chip\">Unknown</span>\n                </div>\n\n                <div class=\"settings-row\">\n                  <span class=\"settings-row-label\">Expiry</span>\n                  <span id=\"settings-expiry-detail-value\" class=\"settings-row-value settings-row-value-muted\">Not set</span>\n                </div>\n\n                <div class=\"settings-row\">\n                  <span class=\"settings-row-label\">Time Left</span>\n                  <span id=\"settings-time-left-detail-value\" class=\"settings-row-value settings-row-value-muted\">No expiry date is available yet.</span>\n                </div>\n\n                <div id=\"settings-reason-row\" class=\"settings-row\" hidden>\n                  <span class=\"settings-row-label\">Reason</span>\n                  <span id=\"settings-reason-value\" class=\"settings-row-value settings-row-value-muted\"></span>\n                </div>\n              </div>\n            </section>\n\n            <section class=\"settings-section\">\n              <h3 class=\"settings-section-title\">Account Actions</h3>\n              <div class=\"settings-section-rows\">\n                <div class=\"settings-row settings-row-action\">\n                  <span class=\"settings-row-label\">Sign out of this device</span>\n                  <button id=\"settings-signout-btn\" class=\"settings-action-btn\" type=\"button\">\n                    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                      <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"></path>\n                      <path d=\"m16 17 5-5-5-5\"></path>\n                      <path d=\"M21 12H9\"></path>\n                    </svg>\n                    <span>Sign Out</span>\n                  </button>\n                </div>\n\n                <div class=\"settings-row settings-row-action\">\n                  <span class=\"settings-row-label\">Clear saved quiz history</span>\n                  <button id=\"settings-reset-account-btn\" class=\"settings-action-btn settings-action-btn-danger\" type=\"button\">\n                    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                      <path d=\"M3 2v6h6\"></path>\n                      <path d=\"M3.5 13a8.5 8.5 0 1 0 2.3-5.8L3 10\"></path>\n                    </svg>\n                    <span>Reset Account</span>\n                  </button>\n                </div>\n              </div>\n            </section>\n          </div>\n        </div>\n      </section>\n    ",
		access: "\n      <section id=\"access-view\" class=\"view access-view\" hidden>\n        <div class=\"access-shell\">\n          <div id=\"access-status-badge\" class=\"access-status-badge is-warning\">\n            <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n              <path d=\"M12 9v4\"></path>\n              <path d=\"M12 17h.01\"></path>\n              <path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z\"></path>\n            </svg>\n            <span>Pending Activation</span>\n          </div>\n\n          <h2 id=\"access-title\" class=\"access-page-title\">Access Restricted</h2>\n          <p id=\"access-message\" class=\"access-page-subtitle\">The account has no active subscription</p>\n\n          <div class=\"access-identity-pill\">\n            <div class=\"access-identity-main\">\n              <div class=\"access-identity-icon\" aria-hidden=\"true\">\n                <svg viewBox=\"0 0 24 24\">\n                  <rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect>\n                  <path d=\"m3 7 9 6 9-6\"></path>\n                </svg>\n              </div>\n              <div class=\"access-identity-copy\">\n                <span class=\"access-identity-label\">Signed in as</span>\n                <span id=\"access-email-value\" class=\"access-identity-value\">account@example.com</span>\n              </div>\n            </div>\n\n            <div id=\"access-identity-status\" class=\"access-identity-status is-success\">\n              <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                <path d=\"m9 12 2 2 4-4\"></path>\n                <path d=\"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z\"></path>\n              </svg>\n              <span id=\"access-identity-status-text\">Account Verified</span>\n            </div>\n          </div>\n\n          <div id=\"access-meta\" class=\"access-meta-list\" hidden></div>\n\n          <div class=\"access-actions\">\n            <button id=\"btn-check-access\" class=\"access-primary-btn\" type=\"button\">\n              <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                <path d=\"M21 2v6h-6\"></path>\n                <path d=\"M3 12a9 9 0 0 1 15.36-6.36L21 8\"></path>\n                <path d=\"M3 22v-6h6\"></path>\n                <path d=\"M21 12a9 9 0 0 1-15.36 6.36L3 16\"></path>\n              </svg>\n              <span>Check Access Again</span>\n            </button>\n\n            <button id=\"btn-contact-support\" class=\"access-secondary-btn\" type=\"button\">\n              <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                <path d=\"M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3\"></path>\n                <path d=\"M12 17h.01\"></path>\n                <path d=\"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z\"></path>\n              </svg>\n              <span>Contact Support</span>\n            </button>\n          </div>\n\n          <button id=\"btn-access-signout\" class=\"access-signout-btn\" type=\"button\">\n            <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n              <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"></path>\n              <path d=\"m16 17 5-5-5-5\"></path>\n              <path d=\"M21 12H9\"></path>\n            </svg>\n            <span>Sign out and use a different account</span>\n          </button>\n        </div>\n      </section>\n    "
	};
	document.title = n[t] || "Bitramed", e.innerHTML = `
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
              <span class="menu-sheet-version">v3.1.0</span>
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
        ${[
		r.dashboard,
		r.year,
		r.modules,
		r.pastPaperTopics,
		r.pastPaperExams,
		r.pastPaperSession,
		r.pastPaperReview,
		r.subtopics,
		r.types,
		r.quizzes,
		r.quiz,
		r.results,
		r.account,
		r.settings,
		r.access
	].join("")}
      </main>
    </div>
  `;
}
//#endregion
//#region public/src/entries/learner.js
function V() {
	return JSON.parse(JSON.stringify(m.state));
}
function H() {
	return {
		...m,
		...O,
		...k,
		...z,
		state: V()
	};
}
async function U() {
	B(), await H().init();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => {
	U();
}, { once: !0 }) : U();
//#endregion
