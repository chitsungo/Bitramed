import {
  applyDocumentThemePreference,
  createSupabaseClient,
  normalizeThemePreference,
  readStoredThemePreference,
  writeStoredThemePreference,
} from "../core/supabase.js";
import { confirmDialog, formDialog } from "../ui/dialog.js";
import {
  blockUserAccess,
  extendUserAccess,
  grantUserAccess,
  loadAdminDashboardData,
  unblockUserAccess,
} from "../services/admin-service.js";
import { loadUserThemePreference } from "../services/preferences-service.js";
import {
  buildAdminStatsViewModel,
  getAccessCategoryMeta,
} from "../views/admin-view-model.js";
import { renderAdminStatsView } from "../views/admin-stats-view.js";
import {
  renderAdminAccessCategoryList,
  renderAdminAccessMenu,
} from "../views/admin-access-view.js";

const ADMIN_HOME_PATH = "/JAK2V617F/";
const ADMIN_STATS_PATH = "/JAK2V617F/stats/";
const ADMIN_ACCESS_PATH = "/JAK2V617F/access-control/";

export const adminApp = {
  state: {
    supabaseClient: null,
    currentUser: null,
    accessRows: [],
    statsUsers: [],
    statsModel: null,
    themePreference: "light",
    activePanel: "menu",
    accessCategory: "menu",
    overviewSub: "menu",
    statsCarouselIndex: 0,
    statsCarouselTimer: null,
  },

  async init() {
    try {
      this.cacheDom();
      if (this.normalizeLegacyAdminRoute()) return;
      this.initSupabaseClient();
      this.applyThemePreference(this.getThemePreference());
      this.bindEvents();
      await this.requireSession();
      await this.loadThemePreference();
      await this.requireAdmin();
      await this.loadDashboard();
      window.addEventListener("popstate", () => {
        this.applyAdminRoute();
      });
    } catch (error) {
      console.error("Admin init failed:", error);
      this.showDenied(error?.message || "Admin access failed.");
    }
  },

  cacheDom() {
    this.dom = {
      loadingView: document.getElementById("admin-loading-view"),
      deniedView: document.getElementById("admin-denied-view"),
      dashboardView: document.getElementById("admin-dashboard-view"),
      adminHomeBtn: document.getElementById("admin-home-btn"),
      adminSignoutBtn: document.getElementById("admin-signout-btn"),
      adminBackStatsBtn: document.getElementById("btn-admin-back-stats"),
      adminBackStatsBtnLabel: document.getElementById(
        "btn-admin-back-stats-label"
      ),
      adminBackAccessBtn: document.getElementById("btn-admin-back-access"),
      adminBackAccessBtnLabel: document.getElementById(
        "btn-admin-back-access-label"
      ),
      adminUserPill: document.getElementById("admin-user-pill"),
      adminUserAvatar: document.getElementById("admin-user-avatar"),
      adminUserName: document.getElementById("admin-user-name"),
      adminGreeting: document.getElementById("admin-greeting"),
      adminGreetingName: document.getElementById("admin-greeting-name"),
      adminDashboardLead: document.getElementById("admin-dashboard-lead"),
      adminMenuActiveUsers: document.getElementById("admin-menu-active-users"),
      adminMenuAttempts: document.getElementById("admin-menu-attempts"),
      adminMenuAverage: document.getElementById("admin-menu-average"),
      adminMenuBrief: document.getElementById("admin-menu-brief"),
      adminMenuSignals: document.getElementById("admin-menu-signals"),
      adminMenuMain: document.getElementById("admin-menu-main"),
      adminMenuActiveShell: document.getElementById("admin-menu-active-shell"),
      adminMenuActiveList: document.getElementById("admin-menu-active-list"),
      adminMenuActiveCount: document.getElementById("admin-menu-active-count"),
      adminMenuActiveTitle: document.getElementById("admin-menu-active-title"),
      adminMenuActiveNote: document.getElementById("admin-menu-active-note"),
      adminMenuActiveChip: document.getElementById("admin-menu-active-chip"),
      adminMenuActiveMeta: document.getElementById("admin-menu-active-meta"),
      adminOverviewActiveCount: document.getElementById(
        "admin-overview-active-count"
      ),
      adminOverviewActiveTrigger: document.getElementById(
        "admin-overview-active-trigger"
      ),
      adminOverviewRoute: document.querySelector(
        '[data-admin-route="overview"]'
      ),
      adminStatsUsers: document.getElementById("admin-stats-users"),
      adminStatsCompleted: document.getElementById("admin-stats-completed"),
      adminStatsAverage: document.getElementById("admin-stats-average"),
      adminStatsEngagement: document.getElementById("admin-stats-engagement"),
      adminStoryCard: document.getElementById("admin-story-card"),
      adminOverviewGrid: document.getElementById("admin-overview-grid"),
      adminHealthChart: document.getElementById("admin-health-chart"),
      adminCourseChart: document.getElementById("admin-course-chart"),
      adminCourseSectionCount: document.getElementById(
        "admin-course-section-count"
      ),
      adminCourseGrid: document.getElementById("admin-course-grid"),
      adminUserHighlights: document.getElementById("admin-user-highlights"),
      adminRankedSectionCount: document.getElementById("admin-ranked-section-count"),
      adminRankedUsers: document.getElementById("admin-ranked-users"),
      adminUserSectionCount: document.getElementById(
        "admin-user-section-count"
      ),
      adminUserList: document.getElementById("admin-user-list"),
      adminRecentSectionCount: document.getElementById(
        "admin-recent-section-count"
      ),
      adminRecentList: document.getElementById("admin-recent-list"),
      adminAccessShellTitle: document.getElementById(
        "admin-access-shell-title"
      ),
      adminAccessShellSubtitle: document.getElementById(
        "admin-access-shell-subtitle"
      ),
      adminAccessActiveCount: document.getElementById(
        "admin-access-active-count"
      ),
      adminAccessExpiredCount: document.getElementById(
        "admin-access-expired-count"
      ),
      adminAccessNewCount: document.getElementById("admin-access-new-count"),
      adminAccessBlockedCount: document.getElementById(
        "admin-access-blocked-count"
      ),
      adminAccessSectionTitle: document.getElementById(
        "admin-access-section-title"
      ),
      adminAccessSectionCount: document.getElementById(
        "admin-access-section-count"
      ),
      adminAccessFeedback: document.getElementById("admin-access-feedback"),
      adminAccessMenuShell: document.getElementById("admin-access-menu-shell"),
      adminAccessMenu: document.getElementById("admin-access-menu"),
      adminAccessCategoryShell: document.getElementById(
        "admin-access-category-shell"
      ),
      adminAccessCategoryTitle: document.getElementById(
        "admin-access-category-title"
      ),
      adminAccessCategoryCount: document.getElementById(
        "admin-access-category-count"
      ),
      adminAccessList: document.getElementById("admin-access-list"),
      adminMenuView: document.getElementById("admin-menu-view"),
      adminStatsShell: document.getElementById("admin-stats-shell"),
      adminAccessShell: document.getElementById("admin-access-shell"),
    };
  },

  initSupabaseClient() {
    this.state.supabaseClient = createSupabaseClient();
  },

  getSupabase() {
    return this.state.supabaseClient;
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
      const theme = await loadUserThemePreference(this.getSupabase(), userId);
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
      console.error("Admin theme preference load failed:", error);
      this.applyThemePreference(fallbackMode);
      return fallbackMode;
    }
  },

  bindEvents() {
    this.dom.adminHomeBtn.onclick = () => {
      window.location.replace("/dashboard/");
    };

    this.dom.adminSignoutBtn.onclick = async () => {
      const { error } = await this.getSupabase().auth.signOut();
      if (!error) {
        window.location.replace("/");
      }
    };

    document.addEventListener("click", async (event) => {
      const overviewSubButton = event.target.closest("[data-admin-overview]");
      if (overviewSubButton) {
        event.preventDefault();
        this.showOverviewSub(overviewSubButton.dataset.adminOverview || "menu");
        return;
      }

      if (event.target.closest("#btn-admin-overview-back")) {
        event.preventDefault();
        this.showOverviewSub("menu");
        return;
      }

      const panelButton = event.target.closest("[data-admin-panel]");
      if (panelButton) {
        event.preventDefault();
        this.navigateAdmin(panelButton.dataset.adminPanel || "menu");
        return;
      }

      if (event.target.closest("#btn-admin-back-stats")) {
        event.preventDefault();
        this.navigateAdmin("menu");
        return;
      }

      if (event.target.closest("#btn-admin-back-access")) {
        event.preventDefault();
        if (this.state.accessCategory !== "menu") {
          this.navigateAdmin("access", "menu");
        } else {
          this.navigateAdmin("menu");
        }
        return;
      }

      const accessCategoryButton = event.target.closest(
        "[data-access-category]"
      );
      if (accessCategoryButton) {
        event.preventDefault();
        this.navigateAdmin(
          "access",
          accessCategoryButton.dataset.accessCategory || "menu"
        );
        return;
      }

      const actionButton = event.target.closest("[data-access-action]");
      if (!actionButton) return;

      event.preventDefault();
      const action = actionButton.dataset.accessAction;
      const userId = actionButton.dataset.userId;
      if (!action || !userId) return;

      await this.handleAccessAction(action, userId);
    });
  },

  async requireSession() {
    const { data, error } = await this.getSupabase().auth.getUser();
    if (error) throw error;
    if (!data.user) {
      const currentAdminPath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(
        `/?next=${encodeURIComponent(currentAdminPath || ADMIN_HOME_PATH)}`
      );
      throw new Error("No active session.");
    }

    this.state.currentUser = data.user;
    const displayName = this.getDisplayNameForUser(data.user);
    this.dom.adminUserName.textContent = displayName;
    if (this.dom.adminUserAvatar) {
      this.dom.adminUserAvatar.textContent =
        this.getFirstName(displayName).charAt(0).toUpperCase() || "O";
    }
    this.dom.adminUserPill.hidden = false;
  },

  async requireAdmin() {
    const { data, error } = await this.getSupabase().rpc(
      "is_current_user_admin"
    );
    if (error) throw error;
    if (!data) {
      throw new Error("This account is not allowed to view admin analytics.");
    }
  },

  async loadDashboard() {
    const payload = await loadAdminDashboardData(this.getSupabase());
    this.state.accessRows = payload.accessRows || [];
    this.state.statsUsers = payload.users || [];
    this.state.statsModel = buildAdminStatsViewModel({
      ...payload,
      currentUser: this.state.currentUser,
    });
    this.renderDashboard();
    this.applyAdminRoute();
    this.dom.loadingView.hidden = true;
    this.dom.dashboardView.hidden = false;
  },

  normalizeAdminPathname(pathname = window.location.pathname) {
    const safePath = String(pathname || "/").replace(/\/+$/, "");
    return safePath ? `${safePath}/` : "/";
  },

  normalizeLegacyAdminRoute() {
    const currentPath = this.normalizeAdminPathname(window.location.pathname);
    const params = new URLSearchParams(window.location.search);
    const panel = params.get("panel") || "menu";

    if (currentPath !== ADMIN_HOME_PATH) return false;
    if (!params.has("panel") && !params.has("status")) return false;

    const nextPath = this.buildAdminPath(panel, params.get("status") || "menu");
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextPath !== currentUrl) {
      window.location.replace(nextPath);
      return true;
    }

    return false;
  },

  parseAdminRoute() {
    const params = new URLSearchParams(window.location.search);
    const pathname = this.normalizeAdminPathname(window.location.pathname);
    const status = params.get("status") || "menu";
    let activePanel = "menu";

    if (pathname === ADMIN_STATS_PATH) {
      activePanel = "stats";
    } else if (pathname === ADMIN_ACCESS_PATH) {
      activePanel = "access";
    }

    return {
      activePanel,
      accessCategory: [
        "menu",
        "active",
        "expired",
        "no_access",
        "blocked",
      ].includes(status)
        ? status
        : "menu",
    };
  },

  buildAdminPath(panel = "menu", accessCategory = "menu") {
    let basePath = ADMIN_HOME_PATH;

    if (panel === "stats") {
      basePath = ADMIN_STATS_PATH;
    } else if (panel === "access") {
      basePath = ADMIN_ACCESS_PATH;
    }

    const params = new URLSearchParams();
    if (panel === "access" && accessCategory && accessCategory !== "menu") {
      params.set("status", accessCategory);
    }

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  },

  navigateAdmin(
    panel = "menu",
    accessCategory = "menu",
    { replace = false } = {}
  ) {
    const nextPath = this.buildAdminPath(panel, accessCategory);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const currentUrl = new URL(currentPath, window.location.origin);
    const nextUrl = new URL(nextPath, window.location.origin);

    if (nextPath === currentPath) {
      this.applyAdminRoute();
      return;
    }

    if (nextUrl.pathname !== currentUrl.pathname) {
      window.location.assign(nextPath);
      return;
    }

    if (replace) {
      window.history.replaceState({}, "", nextPath);
    } else {
      window.history.pushState({}, "", nextPath);
    }

    this.applyAdminRoute();
  },

  applyAdminRoute() {
    const route = this.parseAdminRoute();
    this.showAdminPanel(route.activePanel);
    this.showAccessCategory(route.accessCategory);
  },

  showAdminPanel(panel) {
    this.state.activePanel = panel;
    if (this.dom.adminMenuView)
      this.dom.adminMenuView.hidden = panel !== "menu";
    if (this.dom.adminStatsShell)
      this.dom.adminStatsShell.hidden = panel !== "stats";
    if (this.dom.adminAccessShell)
      this.dom.adminAccessShell.hidden = panel !== "access";
    if (panel !== "menu") {
      this.showOverviewSub("menu");
    }
    if (panel === "stats") {
      window.requestAnimationFrame(() => {
        this.setupStatsCarousel();
        this.showStatsCarouselSlide(this.state.statsCarouselIndex || 0);
      });
    } else {
      this.stopStatsCarouselAutoplay();
    }
    this.syncAdminBackButtons();
  },

  syncAdminBackButtons() {
    if (this.dom.adminBackStatsBtn && this.dom.adminBackStatsBtnLabel) {
      this.dom.adminBackStatsBtnLabel.textContent = "Back";
      this.dom.adminBackStatsBtn.setAttribute("aria-label", "Back to Admin");
      this.dom.adminBackStatsBtn.title = "Back to Admin";
    }

    if (this.dom.adminBackAccessBtn && this.dom.adminBackAccessBtnLabel) {
      const isNestedAccessPage =
        this.state.activePanel === "access" &&
        this.state.accessCategory !== "menu";
      const label = isNestedAccessPage ? "Back to Access Types" : "Back";
      const title = isNestedAccessPage
        ? "Back to Access Types"
        : "Back to Admin";

      this.dom.adminBackAccessBtnLabel.textContent = label;
      this.dom.adminBackAccessBtn.setAttribute("aria-label", title);
      this.dom.adminBackAccessBtn.title = title;
    }
  },

  setupStatsCarousel() {
    const carousel = this.dom.adminStatsCarousel;
    if (!carousel) return;

    const slides = this.getStatsCarouselSlides();
    if (!slides.length) return;

    if (carousel.dataset.carouselBound === "true") {
      this.syncStatsCarousel();
      this.startStatsCarouselAutoplay();
      return;
    }

    carousel.dataset.carouselBound = "true";

    carousel.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-slide], [data-slide-to]");
      if (!trigger || !carousel.contains(trigger)) return;

      event.preventDefault();

      if (trigger.hasAttribute("data-slide-to")) {
        this.showStatsCarouselSlide(
          Number(trigger.getAttribute("data-slide-to") || 0)
        );
        this.startStatsCarouselAutoplay();
        return;
      }

      const action = trigger.getAttribute("data-slide");
      if (action === "prev") {
        this.showStatsCarouselSlide(this.state.statsCarouselIndex - 1);
        this.startStatsCarouselAutoplay();
      }
      if (action === "next") {
        this.showStatsCarouselSlide(this.state.statsCarouselIndex + 1);
        this.startStatsCarouselAutoplay();
      }
    });

    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.showStatsCarouselSlide(this.state.statsCarouselIndex - 1);
        this.startStatsCarouselAutoplay();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.showStatsCarouselSlide(this.state.statsCarouselIndex + 1);
        this.startStatsCarouselAutoplay();
        return;
      }

      const indicator = event.target.closest("[data-slide-to]");
      if (!indicator) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.showStatsCarouselSlide(
          Number(indicator.getAttribute("data-slide-to") || 0)
        );
        this.startStatsCarouselAutoplay();
      }
    });

    carousel.addEventListener("mouseenter", () => {
      this.stopStatsCarouselAutoplay();
    });

    carousel.addEventListener("mouseleave", () => {
      this.startStatsCarouselAutoplay();
    });

    carousel.addEventListener("focusin", () => {
      this.stopStatsCarouselAutoplay();
    });

    carousel.addEventListener("focusout", (event) => {
      if (carousel.contains(event.relatedTarget)) return;
      this.startStatsCarouselAutoplay();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopStatsCarouselAutoplay();
      } else if (this.state.activePanel === "stats") {
        this.startStatsCarouselAutoplay();
      }
    });

    this.syncStatsCarousel();
    this.startStatsCarouselAutoplay();
  },

  getStatsCarouselSlides() {
    return this.dom.adminStatsCarousel
      ? [...this.dom.adminStatsCarousel.querySelectorAll(".carousel-item")]
      : [];
  },

  getStatsCarouselIndicators() {
    return this.dom.adminStatsCarousel
      ? [
          ...this.dom.adminStatsCarousel.querySelectorAll(
            ".carousel-indicators [data-slide-to]"
          ),
        ]
      : [];
  },

  normalizeStatsCarouselIndex(index, totalSlides) {
    if (!totalSlides) return 0;

    const wrappedIndex = index % totalSlides;
    return wrappedIndex < 0 ? wrappedIndex + totalSlides : wrappedIndex;
  },

  showStatsCarouselSlide(index) {
    const slides = this.getStatsCarouselSlides();
    const indicators = this.getStatsCarouselIndicators();
    const inner = this.dom.adminStatsCarousel?.querySelector(".carousel-inner");
    if (!slides.length) return;

    const safeIndex = this.normalizeStatsCarouselIndex(index, slides.length);
    this.state.statsCarouselIndex = safeIndex;

    if (inner) {
      inner.style.transform = `translateX(-${safeIndex * 100}%)`;
    }

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === safeIndex;
      slide.classList.toggle("active", isActive);
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    indicators.forEach((indicator, indicatorIndex) => {
      const isActive = indicatorIndex === safeIndex;
      indicator.classList.toggle("active", isActive);
      indicator.setAttribute("aria-current", isActive ? "true" : "false");
    });
  },

  syncStatsCarousel() {
    this.showStatsCarouselSlide(this.state.statsCarouselIndex || 0);
  },

  startStatsCarouselAutoplay() {
    if (this.state.activePanel !== "stats") return;
    const totalSlides = this.getStatsCarouselSlides().length;
    if (!totalSlides) return;

    this.stopStatsCarouselAutoplay();
    this.state.statsCarouselTimer = window.setInterval(() => {
      this.showStatsCarouselSlide(this.state.statsCarouselIndex + 1);
    }, 6500);
  },

  stopStatsCarouselAutoplay() {
    if (!this.state.statsCarouselTimer) return;
    window.clearInterval(this.state.statsCarouselTimer);
    this.state.statsCarouselTimer = null;
  },

  renderDashboard() {
    const model = this.state.statsModel;
    if (!model) return;

    if (this.dom.adminGreeting) {
      this.dom.adminGreeting.textContent = "Admin";
    }
    if (this.dom.adminGreetingName) {
      this.dom.adminGreetingName.textContent = "Workspace.";
    }
    if (this.dom.adminDashboardLead) {
      this.dom.adminDashboardLead.textContent = model.menuLead;
    }

    if (this.dom.adminMenuActiveUsers) {
      this.dom.adminMenuActiveUsers.textContent = String(
        model.menuSummary.activeUsers
      );
    }
    if (this.dom.adminMenuAttempts) {
      this.dom.adminMenuAttempts.textContent = String(
        model.menuSummary.totalAttempts
      );
    }
    if (this.dom.adminMenuAverage) {
      this.dom.adminMenuAverage.textContent = `${model.menuSummary.averagePercentage}%`;
    }

    if (this.dom.adminStatsUsers) {
      this.dom.adminStatsUsers.textContent = String(
        model.statsSummary.totalUsers
      );
    }
    if (this.dom.adminStatsCompleted) {
      this.dom.adminStatsCompleted.textContent = String(
        model.statsSummary.totalQuizzesDone
      );
    }
    if (this.dom.adminStatsAverage) {
      this.dom.adminStatsAverage.textContent = `${model.statsSummary.averagePercentage}%`;
    }
    if (this.dom.adminStatsEngagement) {
      this.dom.adminStatsEngagement.textContent = `${model.statsSummary.engagementRate}%`;
    }

    if (this.dom.adminAccessActiveCount) {
      this.dom.adminAccessActiveCount.textContent = String(
        model.accessSummary.active
      );
    }
    if (this.dom.adminAccessExpiredCount) {
      this.dom.adminAccessExpiredCount.textContent = String(
        model.accessSummary.expired
      );
    }
    if (this.dom.adminAccessNewCount) {
      this.dom.adminAccessNewCount.textContent = String(
        model.accessSummary.noAccess
      );
    }
    if (this.dom.adminAccessBlockedCount) {
      this.dom.adminAccessBlockedCount.textContent = String(
        model.accessSummary.blocked
      );
    }

    renderAdminStatsView({
      dom: this.dom,
      model,
      escapeHtml: this.escapeHtml.bind(this),
      formatDateTime: this.formatDateTime.bind(this),
      formatModeLabel: this.formatModeLabel.bind(this),
    });

    this.setupStatsCarousel();
    this.syncStatsCarousel();

    this.renderMenuActiveSilentList();
    this.renderAccessControl();
  },

  showOverviewSub(sub) {
    this.state.overviewSub = sub;
    const isMenu = !sub || sub === "menu";
    if (this.dom.adminMenuMain) this.dom.adminMenuMain.hidden = !isMenu;
    if (this.dom.adminMenuActiveShell) this.dom.adminMenuActiveShell.hidden = isMenu;
    if (this.dom.adminOverviewRoute) {
      this.dom.adminOverviewRoute.classList.toggle("is-active", isMenu);
      if (isMenu) {
        this.dom.adminOverviewRoute.setAttribute("aria-current", "page");
      } else {
        this.dom.adminOverviewRoute.removeAttribute("aria-current");
      }
    }
    if (this.dom.adminOverviewActiveTrigger) {
      this.dom.adminOverviewActiveTrigger.classList.toggle("is-active", !isMenu);
      this.dom.adminOverviewActiveTrigger.setAttribute(
        "aria-pressed",
        !isMenu ? "true" : "false"
      );
    }
  },

  renderMenuActiveSilentList() {
    const activeRows = (this.state.accessRows || []).filter(
      (r) => r.status === "active"
    );

    const activeWithActivity = new Set(
      (this.state.statsUsers || [])
        .filter((u) => (u.total_attempts || 0) > 0)
        .flatMap((u) =>
          [u.user_id, u.id, u.email].filter(Boolean).map((v) => String(v).toLowerCase())
        )
    );

    const silentRows = activeRows
      .filter((r) => {
        const tokens = [r.user_id, r.id, r.email]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        return !tokens.some((t) => activeWithActivity.has(t));
      })
      .sort((a, b) => {
        const timeA = a.access_expires_at
          ? new Date(a.access_expires_at).getTime()
          : Number.POSITIVE_INFINITY;
        const timeB = b.access_expires_at
          ? new Date(b.access_expires_at).getTime()
          : Number.POSITIVE_INFINITY;
        return timeA - timeB;
      });

    if (this.dom.adminOverviewActiveCount) {
      this.dom.adminOverviewActiveCount.textContent = String(silentRows.length);
    }

    if (this.dom.adminMenuActiveCount) {
      const n = silentRows.length;
      this.dom.adminMenuActiveCount.textContent = `${n} active ${n === 1 ? "account" : "accounts"}`;
    }

    if (this.dom.adminMenuActiveChip) {
      this.dom.adminMenuActiveChip.textContent = `${silentRows.length} in queue`;
    }

    const nextExpiryRow = silentRows.find((row) => row.access_expires_at);
    const nextExpiryLabel = nextExpiryRow
      ? this.getAccessTimeLeftLabel(nextExpiryRow) ||
        this.formatDateTime(nextExpiryRow.access_expires_at)
      : "";
    if (this.dom.adminMenuActiveMeta) {
      this.dom.adminMenuActiveMeta.textContent = nextExpiryRow
        ? `Soonest expiry ${nextExpiryLabel}`
        : "No expiry date recorded";
    }

    if (this.dom.adminMenuActiveTitle) {
      this.dom.adminMenuActiveTitle.textContent = silentRows.length
        ? `${silentRows.length} active ${silentRows.length === 1 ? "account is" : "accounts are"} still waiting for a first attempt.`
        : "No active accounts are waiting for a first attempt.";
    }

    if (this.dom.adminMenuActiveNote) {
      this.dom.adminMenuActiveNote.textContent = silentRows.length
        ? "These learners have live access but no saved quiz history yet. Start with the earliest expiries so access gets used before it goes stale."
        : "All active learners have already started using the platform, so no outreach queue is pending right now.";
    }

    if (!this.dom.adminMenuActiveList) return;

    if (!silentRows.length) {
      this.dom.adminMenuActiveList.innerHTML = `
        <p class="admin-active-empty">
          All active accounts have recorded quiz activity — no silent accounts right now.
        </p>
      `;
      return;
    }

    this.dom.adminMenuActiveList.innerHTML = silentRows
      .map((row) => {
        const name = this.escapeHtml(row.display_name || row.email || "User");
        const email = this.escapeHtml(row.email || "No email");
        const initials = this.escapeHtml(
          String(row.display_name || row.email || "U")
            .trim()
            .split(/\s+/)
            .map((p) => p.charAt(0))
            .join("")
            .slice(0, 2)
            .toUpperCase()
        );
        const expiresAt = this.escapeHtml(
          row.access_expires_at
            ? this.formatDateTime(row.access_expires_at)
            : "Not set"
        );
        const timeLeft = this.escapeHtml(this.getAccessTimeLeftLabel(row));
        return `
          <article class="admin-active-row">
            <div class="admin-active-main">
              <div class="admin-access-initials">${initials}</div>
              <div class="admin-active-identity">
                <div class="admin-active-name-row">
                  <h3 class="admin-access-title">${name}</h3>
                  <span class="admin-active-row-chip">No attempts yet</span>
                </div>
                <p class="admin-access-email">${email}</p>
              </div>
            </div>
            <div class="admin-active-time">
              <span class="admin-active-time-label">Access expires</span>
              <span class="admin-active-expires">${expiresAt}</span>
              ${timeLeft ? `<span class="admin-active-remaining">${timeLeft}</span>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  },

  renderAccessControl() {
    renderAdminAccessMenu({
      container: this.dom.adminAccessMenu,
      buckets: this.state.statsModel?.accessBuckets || [],
      escapeHtml: this.escapeHtml.bind(this),
    });

    this.showAccessCategory(this.state.accessCategory || "menu");
  },

  renderAccessCategoryList(category) {
    const rows = this.state.accessRows.filter((row) => row.status === category);
    renderAdminAccessCategoryList({
      container: this.dom.adminAccessList,
      rows,
      escapeHtml: this.escapeHtml.bind(this),
      formatDateTime: this.formatDateTime.bind(this),
      getAccessTimeLeftLabel: this.getAccessTimeLeftLabel.bind(this),
      renderAccessActions: this.renderAccessActions.bind(this),
      getAccessStatusMeta: this.getAccessStatusMeta.bind(this),
    });
  },

  renderAccessActions(row) {
    const userId = this.escapeHtml(row.user_id);
    const actions = [];
    const iconClock = `
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6"></circle>
        <path d="M8 5v3.2l2 1.6"></path>
      </svg>
    `;
    const iconBlock = `
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6"></circle>
        <path d="M5 5l6 6"></path>
      </svg>
    `;
    const iconCheck = `
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.5 8.5 6 12l7.5-8"></path>
      </svg>
    `;
    const buildAction = ({
      action,
      title,
      note,
      tone = "",
      icon = "",
      full = false,
    }) => `
      <button class="admin-access-btn ${tone} ${full ? "is-full" : ""}" type="button" data-access-action="${action}" data-user-id="${userId}">
        <span class="admin-access-btn-icon">
          ${icon}
        </span>
        <span class="admin-access-btn-copy">
          <strong>${title}</strong>
          <small>${note}</small>
        </span>
      </button>
    `;

    if (row.status === "active") {
      actions.push(
        buildAction({
          action: "extend",
          title: "Extend 30 Days",
          note: "Add another 30 days",
          tone: "is-extend",
          icon: iconClock,
        })
      );
      actions.push(
        buildAction({
          action: "block",
          title: "Block",
          note: "Restrict immediately",
          tone: "is-danger",
          icon: iconBlock,
        })
      );
    } else if (row.status === "expired") {
      actions.push(
        buildAction({
          action: "grant",
          title: "Renew 30 Days",
          note: "Restart access from today",
          tone: "is-extend",
          icon: iconClock,
        })
      );
      actions.push(
        buildAction({
          action: "block",
          title: "Block",
          note: "Restrict immediately",
          tone: "is-danger",
          icon: iconBlock,
        })
      );
    } else if (row.status === "no_access") {
      actions.push(
        buildAction({
          action: "grant",
          title: "Grant 30 Days",
          note: "Activate this new account",
          tone: "is-activate",
          icon: iconCheck,
        })
      );
      actions.push(
        buildAction({
          action: "block",
          title: "Block",
          note: "Restrict before activation",
          tone: "is-danger",
          icon: iconBlock,
        })
      );
    } else if (row.status === "blocked") {
      actions.push(
        buildAction({
          action: "unblock",
          title: "Unblock Access",
          note: "Restore account access state",
          tone: "is-unblock",
          icon: iconCheck,
          full: true,
        })
      );
    }

    return actions.join("");
  },

  showAccessCategory(category) {
    this.state.accessCategory = category;

    const config = getAccessCategoryMeta(category);
    const summary = this.state.statsModel?.accessSummary || {
      active: 0,
      expired: 0,
      noAccess: 0,
      blocked: 0,
      totalTracked: 0,
      activeRate: 0,
    };
    const counts = {
      active: summary.active,
      expired: summary.expired,
      no_access: summary.noAccess,
      blocked: summary.blocked,
    };
    const totalTracked = summary.totalTracked || 0;
    const categoryCount = counts[category] || 0;
    if (this.dom.adminAccessMenu) {
      this.dom.adminAccessMenu
        .querySelectorAll("[data-access-category]")
        .forEach((button) => {
          button.classList.toggle(
            "is-selected",
            button.dataset.accessCategory === category
          );
        });
      this.dom.adminAccessMenu.hidden = category !== "menu";
    }

    if (this.dom.adminAccessMenuShell) {
      this.dom.adminAccessMenuShell.hidden = category !== "menu";
    }

    if (this.dom.adminAccessCategoryShell) {
      this.dom.adminAccessCategoryShell.hidden = category === "menu";
    }

    if (this.dom.adminAccessShellTitle) {
      this.dom.adminAccessShellTitle.textContent = config.title;
    }
    if (this.dom.adminAccessShellSubtitle) {
      this.dom.adminAccessShellSubtitle.textContent = config.subtitle;
    }
    if (this.dom.adminAccessSectionTitle) {
      this.dom.adminAccessSectionTitle.textContent =
        category === "menu" ? "Access Lanes" : "Access Lanes";
    }
    if (this.dom.adminAccessSectionCount) {
      this.dom.adminAccessSectionCount.textContent =
        category === "menu"
          ? "4 live lists"
          : `${categoryCount} ${categoryCount === 1 ? "account" : "accounts"} selected`;
    }
    if (this.dom.adminAccessCategoryTitle) {
      this.dom.adminAccessCategoryTitle.textContent = config.title;
    }
    if (this.dom.adminAccessCategoryCount) {
      this.dom.adminAccessCategoryCount.textContent =
        category === "menu"
          ? "Live accounts"
          : `${categoryCount} ${categoryCount === 1 ? "account" : "accounts"}`;
    }
    if (category !== "menu") {
      this.renderAccessCategoryList(category);
    }

    this.syncAdminBackButtons();
  },

  getAccessStatusMeta(status) {
    switch (status) {
      case "active":
        return { label: "Active", className: "is-active" };
      case "expired":
        return { label: "Expired", className: "is-expired" };
      case "blocked":
        return { label: "Blocked", className: "is-blocked" };
      default:
        return { label: "No Access", className: "is-no-access" };
    }
  },

  async handleAccessAction(action, userId) {
    const user = this.state.accessRows.find((row) => row.user_id === userId);
    if (!user) return;

    try {
      this.setAccessFeedback("", "");

      switch (action) {
        case "grant": {
          const payload = await formDialog({
            title: "Grant access",
            message: `Activate ${user.display_name || user.email} with a fresh access window.`,
            submitLabel: "Grant access",
            fields: [
              {
                id: "days",
                label: "Days",
                type: "number",
                value: 30,
                required: true,
                min: 1,
              },
              { id: "notes", label: "Note", value: "Initial paid access" },
            ],
          });
          if (!payload) return;
          const { error } = await grantUserAccess(
            this.getSupabase(),
            userId,
            payload.days,
            payload.notes
          );
          if (error) throw error;
          this.setAccessFeedback(
            `Access granted to ${user.display_name || user.email}.`,
            "success"
          );
          break;
        }
        case "extend": {
          const payload = await formDialog({
            title: "Extend access",
            message: `Add more access time for ${user.display_name || user.email}.`,
            submitLabel: "Extend access",
            fields: [
              {
                id: "days",
                label: "Days",
                type: "number",
                value: 30,
                required: true,
                min: 1,
              },
              { id: "notes", label: "Note", value: "Renewed paid access" },
            ],
          });
          if (!payload) return;
          const { error } = await extendUserAccess(
            this.getSupabase(),
            userId,
            payload.days,
            payload.notes
          );
          if (error) throw error;
          this.setAccessFeedback(
            `Access extended for ${user.display_name || user.email}.`,
            "success"
          );
          break;
        }
        case "block": {
          const payload = await formDialog({
            title: "Block account",
            message: `Restrict ${user.display_name || user.email} immediately.`,
            submitLabel: "Block account",
            danger: true,
            fields: [
              {
                id: "reason",
                label: "Reason",
                value: "Access suspended by admin",
                required: true,
                multiline: true,
              },
            ],
          });
          if (!payload) return;
          const { error } = await blockUserAccess(
            this.getSupabase(),
            userId,
            payload.reason
          );
          if (error) throw error;
          this.setAccessFeedback(
            `${user.display_name || user.email} has been blocked.`,
            "success"
          );
          break;
        }
        case "unblock": {
          const confirmed = await confirmDialog({
            title: "Unblock account",
            message: `Restore the account state for ${user.display_name || user.email}?`,
            submitLabel: "Continue",
          });
          if (!confirmed) return;

          const payload = await formDialog({
            title: "Restore account",
            message: "Add an optional note for the restored account.",
            submitLabel: "Unblock account",
            fields: [{ id: "notes", label: "Note", value: "Access restored" }],
          });
          if (!payload) return;
          const { error } = await unblockUserAccess(
            this.getSupabase(),
            userId,
            payload.notes
          );
          if (error) throw error;
          this.setAccessFeedback(
            `${user.display_name || user.email} has been unblocked.`,
            "success"
          );
          break;
        }
        default:
          return;
      }

      await this.loadDashboard();
    } catch (error) {
      console.error("Access action failed:", error);
      this.setAccessFeedback(
        error?.message || "Access update failed.",
        "error"
      );
    }
  },

  setAccessFeedback(message, type) {
    if (!this.dom.adminAccessFeedback) return;

    if (!message) {
      this.dom.adminAccessFeedback.hidden = true;
      this.dom.adminAccessFeedback.textContent = "";
      this.dom.adminAccessFeedback.className = "admin-access-feedback";
      return;
    }

    this.dom.adminAccessFeedback.hidden = false;
    this.dom.adminAccessFeedback.textContent = message;
    this.dom.adminAccessFeedback.className = `admin-access-feedback ${type}`;
  },

  showDenied(message) {
    this.dom.loadingView.hidden = true;
    this.dom.deniedView.hidden = false;
    const note =
      this.dom.deniedView.querySelector(".admin-dashboard-lead") ||
      this.dom.deniedView.querySelector("p");
    if (note) {
      note.textContent = message;
    }
  },

  getDisplayNameForUser(user) {
    const metaDisplayName = String(
      user?.user_metadata?.display_name || ""
    ).trim();
    if (metaDisplayName) return metaDisplayName;

    const fullName = String(user?.user_metadata?.full_name || "").trim();
    if (fullName) return fullName;

    const email = String(user?.email || "").trim();
    if (email.includes("@")) {
      return email.split("@")[0];
    }

    return "Owner";
  },

  getFirstName(value) {
    const safeValue = String(value || "").trim();
    if (!safeValue) return "Owner";
    return safeValue.split(/\s+/)[0] || "Owner";
  },

  getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning,";
    if (hour < 18) return "Good afternoon,";
    return "Good evening,";
  },

  formatModeLabel(mode) {
    return mode === "exam" ? "Exam" : "Study";
  },

  formatDateTime(value) {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  },

  getAccessTimeLeftLabel(row) {
    const expiresAtRaw = row?.access_expires_at;
    if (!expiresAtRaw) return "";

    const expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime())) return "";

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / msPerDay
    );

    if (row?.status === "active") {
      if (diffDays <= 0) return "Last day";
      if (diffDays === 1) return "1 day left";
      return `${diffDays} days left`;
    }

    if (row?.status === "expired") {
      const elapsedDays = Math.abs(diffDays);
      if (elapsedDays <= 1) return "Expired 1 day ago";
      return `Expired ${elapsedDays} days ago`;
    }

    if (row?.status === "blocked") {
      if (diffDays <= 0) return "Access expired";
      if (diffDays === 1) return "1 day remained";
      return `${diffDays} days remained`;
    }

    return "";
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },
};
