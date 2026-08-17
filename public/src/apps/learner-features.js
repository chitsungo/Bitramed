import { TYPE_META } from "../core/type-meta.js";
import {
  normalizeThemePreference,
  writeStoredThemePreference,
} from "../core/supabase.js";
import {
  deleteAllAssessmentProgress,
  deleteAssessmentProgress,
  fetchAssessmentProgress,
  upsertAssessmentProgress,
} from "../services/assessment-progress-service.js";
import {
  fetchHomeBootstrap,
  fetchShellBootstrap,
} from "../services/home-bootstrap-service.js";
import { confirmDialog, quizSettingsDialog } from "../ui/dialog.js";

export const learnerFeatures = {
  assessmentProgressWriteQueue: Promise.resolve(),
  assessmentProgressUnavailable: false,

  ensureRouteDataState() {
    if (!this.state.routeData) {
      this.state.routeData = {
        yearByLevel: {},
        coursesByLevel: {},
        subtopicsByCourse: {},
        typesBySubtopic: {},
        quizzesByType: {},
        accountByKey: {},
        searchByQuery: {},
      };
    }
    if (!this.routeDataLoadPromises) this.routeDataLoadPromises = {};
    return this.state.routeData;
  },

  getScopedRouteDataKey(...parts) {
    return JSON.stringify(parts.map((part) => String(part ?? "").trim()));
  },

  requireScopedRouteParts(label, parts) {
    const normalized = Object.fromEntries(
      Object.entries(parts).map(([key, value]) => [
        key,
        String(value ?? "").trim(),
      ])
    );
    if (Object.values(normalized).some((value) => !value)) {
      throw new Error(`${label} requires complete route parameters.`);
    }
    return normalized;
  },

  assertScopedRouteContext(payload, expected, label) {
    for (const [key, value] of Object.entries(expected)) {
      if (String(payload?.[key] ?? "").trim() !== String(value).trim()) {
        throw new Error(`${label} returned data for a different route.`);
      }
    }
  },

  rememberInitialRoutePrefetch(routeKey, promise) {
    const trackedPromise = Promise.resolve(promise);
    this.initialRoutePrefetch = {
      location: `${window.location.pathname}${window.location.search}`,
      routeKey,
      promise: trackedPromise,
    };
    return trackedPromise;
  },

  consumeInitialRoutePrefetch(routeKey) {
    const prefetch = this.initialRoutePrefetch;
    if (
      !prefetch ||
      prefetch.routeKey !== routeKey ||
      prefetch.location !==
        `${window.location.pathname}${window.location.search}`
    ) {
      return null;
    }
    this.initialRoutePrefetch = null;
    return prefetch.promise;
  },

  async loadScopedRouteData({
    cacheName,
    cacheKey,
    rpcName,
    params = {},
    label,
    normalize,
    force = false,
  }) {
    const routeData = this.ensureRouteDataState();
    const requestGeneration = Number(this.routeDataGeneration || 0);
    if (!routeData[cacheName]) routeData[cacheName] = {};
    const cache = routeData[cacheName];
    if (!force && cache && Object.hasOwn(cache, cacheKey)) {
      return cache[cacheKey];
    }

    const requestKey = `${requestGeneration}:${cacheName}:${cacheKey}`;
    const activeRequest = this.routeDataLoadPromises[requestKey];
    if (activeRequest) {
      if (!force) return activeRequest;
      try {
        await activeRequest;
      } catch {
        // The forced request below is the retry.
      }
    }

    const request = (async () => {
      const { data, error } = await this.withTimeout(
        this.getSupabase().rpc(rpcName, params),
        12000,
        label
      );
      if (error) throw error;
      if (
        !data ||
        Array.isArray(data) ||
        typeof data !== "object" ||
        Number(data.schemaVersion) !== 1
      ) {
        throw new Error(`${label} returned an invalid response.`);
      }
      const normalized = normalize(data);
      if (Number(this.routeDataGeneration || 0) === requestGeneration) {
        routeData[cacheName][cacheKey] = normalized;
      }
      return normalized;
    })();

    this.routeDataLoadPromises[requestKey] = request;
    try {
      return await request;
    } finally {
      if (this.routeDataLoadPromises?.[requestKey] === request) {
        delete this.routeDataLoadPromises[requestKey];
      }
    }
  },

  async refreshDatabase() {
    return this.hardRefreshFromDatabase();
  },

  prefetchInitialRouteData() {
    const segments = window.location.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    const [root = "home"] = segments;
    const params = new URLSearchParams(window.location.search);
    const routeParam = (name) => String(params.get(name) || "").trim();

    switch (root) {
      case "year": {
        const level = routeParam("year");
        return level ? this.loadYearOverview(level) : null;
      }
      case "modules": {
        const level = routeParam("level");
        return level ? this.loadBrowseCourses(level) : null;
      }
      case "subtopics": {
        const level = routeParam("level");
        const area = routeParam("area");
        return level && area ? this.loadBrowseSubtopics(level, area) : null;
      }
      case "types": {
        const level = routeParam("level");
        const area = routeParam("area");
        const sub = routeParam("sub");
        return level && area && sub
          ? this.loadBrowseTypes(level, area, sub)
          : null;
      }
      case "quizzes": {
        const level = routeParam("level");
        const area = routeParam("area");
        const sub = routeParam("sub");
        const type = routeParam("type").toLowerCase();
        return level && area && sub && ["sba", "tf"].includes(type)
          ? this.loadBrowseQuizzes(level, area, sub, type)
          : null;
      }
      case "quiz": {
        const quizId = routeParam("quizId");
        if (!quizId) return null;
        this.state.currentQuizId = quizId;
        this.state.currentExamDurationMinutes =
          this.normalizeQuizDurationMinutes(params.get("duration"));
        this.state.negativeMarking = params.has("negative")
          ? params.get("negative") === "1"
          : params.get("mode") === "exam";
        this.state.mode =
          this.state.currentExamDurationMinutes || this.state.negativeMarking
            ? "exam"
            : "study";
        return this.rememberInitialRoutePrefetch(
          "quiz",
          this.loadQuizSessionPage(quizId)
        );
      }
      case "results": {
        const quizId = routeParam("quizId");
        if (!quizId) return null;
        this.state.currentQuizId = quizId;
        return this.rememberInitialRoutePrefetch(
          "results",
          this.loadQuizDescriptorsByIds([quizId])
        );
      }
      case "past-papers": {
        const [, pastPaperView = "topics"] = segments;
        const pastPapers = this.getPastPaperState();
        if (pastPaperView === "exams") {
          const year = routeParam("year");
          const topic = routeParam("topic");
          if (!year || !topic) return null;
          pastPapers.currentYear = year;
          pastPapers.currentTopic = topic;
          return this.rememberInitialRoutePrefetch(
            "past-paper-exams",
            this.ensurePastPaperExamsLoaded(year, topic)
          );
        }
        if (pastPaperView === "session") {
          const setId = routeParam("setId");
          if (!setId) return null;
          pastPapers.currentSetId = setId;
          pastPapers.currentYear = routeParam("year");
          pastPapers.currentTopic = routeParam("topic");
          pastPapers.durationMinutes = this.normalizeQuizDurationMinutes(
            params.get("duration")
          );
          pastPapers.negativeMarking = params.get("negative") === "1";
          return this.rememberInitialRoutePrefetch(
            "past-paper-session",
            this.loadPastPaperSessionPage(setId)
          );
        }
        if (pastPaperView === "review") {
          const attemptId = routeParam("attemptId");
          return attemptId
            ? this.rememberInitialRoutePrefetch(
                "past-paper-review",
                this.loadPastPaperAttemptReview(attemptId)
              )
            : null;
        }

        const year = routeParam("year");
        if (!year) return null;
        pastPapers.currentYear = year;
        return this.rememberInitialRoutePrefetch(
          "past-paper-topics",
          this.ensurePastPaperTopicsLoaded(year)
        );
      }
      case "account":
        return this.loadAccountPage();
      default:
        return null;
    }
  },

  async loadAreaCatalog() {
    const rows = await this.fetchLevelCourseCatalogRows();
    this.setAreaCatalogFromRows(rows);
  },

  isRpcUnavailable(error) {
    const code = String(error?.code || "").trim();
    const message = String(error?.message || "").toLowerCase();

    return (
      ["PGRST202", "PGRST205", "42883", "42P01"].includes(code) ||
      message.includes("could not find the function") ||
      message.includes("does not exist") ||
      message.includes("schema cache")
    );
  },

  async fetchLevelCourseCatalogRows() {
    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_level_course_catalog"),
      12000,
      "Loading levels and courses"
    );
    if (error) throw error;
    return data || [];
  },

  setAreaCatalogFromRows(rows) {
    const levelList = rows
      .map((row) => ({
        id: row.level_id,
        name: String(row.level || "").trim(),
        displayOrder: Number(row.display_order || 0),
      }))
      .filter((row) => row.id && row.name)
      .filter(
        (row, index, list) =>
          list.findIndex((item) => item.id === row.id) === index
      )
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder)
          return a.displayOrder - b.displayOrder;
        return this.compareDisplayOrder(a.name, b.name);
      });

    const levelNameById = Object.fromEntries(
      levelList.map((row) => [row.id, row.name])
    );
    const areasByLevel = {};
    levelList.forEach((level) => {
      areasByLevel[level.name] = [];
    });

    rows
      .map((row) => ({
        id: row.course_id,
        name: String(row.area || "").trim(),
        levelId: row.level_id || "",
      }))
      .filter(
        (row) => row.id && row.name && row.levelId && levelNameById[row.levelId]
      )
      .sort((a, b) => this.compareDisplayOrder(a.name, b.name))
      .forEach((row) => {
        const levelName = levelNameById[row.levelId];
        if (!areasByLevel[levelName]) {
          areasByLevel[levelName] = [];
        }
        areasByLevel[levelName].push(row);
      });

    this.state.levelList = levelList;
    this.state.levelIdByName = Object.fromEntries(
      levelList.map((row) => [row.name, row.id])
    );
    this.state.areasByLevel = areasByLevel;
    this.state.areaList = levelList.flatMap(
      (level) => areasByLevel[level.name] || []
    );
    this.scheduleAppDataCacheWrite();
  },

  isHomeBootstrapUnavailable(error) {
    const code = String(error?.code || "")
      .trim()
      .toUpperCase();
    const message = String(error?.message || "").toLowerCase();

    return (
      code === "PGRST202" ||
      (message.includes("app_home_bootstrap") &&
        (code === "42883" ||
          message.includes("could not find the function") ||
          message.includes("does not exist") ||
          message.includes("schema cache")))
    );
  },

  isHomeBootstrapPayload(payload) {
    return (
      !!payload &&
      !Array.isArray(payload) &&
      typeof payload === "object" &&
      Number(payload.schemaVersion) === 1 &&
      !!payload.access &&
      typeof payload.access === "object" &&
      !!payload.dashboard &&
      typeof payload.dashboard === "object" &&
      Array.isArray(payload.dashboard.levels) &&
      Array.isArray(payload.dashboard.pastPaperYears)
    );
  },

  isShellBootstrapPayload(payload) {
    return (
      !!payload &&
      !Array.isArray(payload) &&
      typeof payload === "object" &&
      Number(payload.schemaVersion) === 1 &&
      !!payload.access &&
      typeof payload.access === "object"
    );
  },

  applyShellBootstrap(payload) {
    const access = payload.access || {};
    this.state.accessStatus = {
      ...access,
      hasAccess: !!(access.hasAccess ?? access.has_access),
      accessExpiresAt:
        access.accessExpiresAt ?? access.access_expires_at ?? null,
      blockReason: access.blockReason ?? access.block_reason ?? "",
    };

    const remoteTheme = payload.themePreference;
    if (remoteTheme === "dark" || remoteTheme === "light") {
      const resolvedTheme = writeStoredThemePreference(
        normalizeThemePreference(remoteTheme)
      );
      this.applyThemePreference(resolvedTheme);
    }
  },

  applyHomeBootstrap(payload) {
    this.applyShellBootstrap(payload);
    this.homeBootstrapLoadedThisPage = true;

    const dashboard = payload.dashboard || {};
    const levels = (dashboard.levels || [])
      .map((row) => ({
        id: row.levelId || row.level_id || "",
        name: String(row.name || row.level || "").trim(),
        displayOrder: Number(row.displayOrder ?? row.display_order ?? 0),
        courseCount: Number(row.courseCount ?? row.course_count ?? 0),
        doneCount: Number(row.doneCount ?? row.done_count ?? 0),
        totalCount: Number(row.totalCount ?? row.total_count ?? 0),
        percent: Number(row.percent || 0),
      }))
      .filter((row) => row.id && row.name)
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return this.compareDisplayOrder(a.name, b.name);
      });

    this.state.levelList = levels.map(({ id, name, displayOrder }) => ({
      id,
      name,
      displayOrder,
    }));
    this.state.levelIdByName = Object.fromEntries(
      levels.map((row) => [row.name, row.id])
    );
    this.state.areasByLevel = Object.fromEntries(
      levels.map((row) => [
        row.name,
        Array.isArray(this.state.areasByLevel[row.name])
          ? this.state.areasByLevel[row.name]
          : [],
      ])
    );
    this.state.areaList = this.state.levelList.flatMap(
      (level) => this.state.areasByLevel[level.name] || []
    );

    this.state.homeDashboard = {
      loaded: true,
      generatedAt: payload.generatedAt || "",
      stats: {
        activeYears: Number(dashboard.activeYears || 0),
        completedCount: Number(dashboard.completedCount || 0),
        averageScore: Number(dashboard.averageScore || 0),
      },
      levelProgressByName: Object.fromEntries(
        levels.map((row) => [
          row.name,
          {
            doneCount: row.doneCount,
            totalCount: row.totalCount,
            courseCount: row.courseCount,
            percent: row.percent,
          },
        ])
      ),
    };

    const pastPapers = this.getPastPaperState?.();
    if (pastPapers) {
      pastPapers.years = this.normalizePastPaperYearRows(
        dashboard.pastPaperYears
      );
      pastPapers.yearsLoaded = true;
    }
    this.scheduleAppDataCacheWrite();
  },

  async loadHomeBootstrap() {
    if (this.homeBootstrapLoadPromise) return this.homeBootstrapLoadPromise;

    const request = (async () => {
      const { data, error } = await this.withTimeout(
        fetchHomeBootstrap(this.getSupabase()),
        12000,
        "Loading homepage"
      );
      if (error) {
        if (this.isHomeBootstrapUnavailable(error)) {
          this.homeBootstrapUnavailable = true;
          return false;
        }
        throw error;
      }
      if (!this.isHomeBootstrapPayload(data)) {
        throw new Error("The homepage bootstrap response is invalid.");
      }

      this.applyHomeBootstrap(data);
      this.homeBootstrapUnavailable = false;
      return true;
    })();

    this.homeBootstrapLoadPromise = request;
    try {
      return await request;
    } finally {
      if (this.homeBootstrapLoadPromise === request) {
        this.homeBootstrapLoadPromise = null;
      }
    }
  },

  async loadShellBootstrap() {
    if (this.shellBootstrapLoadPromise) return this.shellBootstrapLoadPromise;

    const request = (async () => {
      const { data, error } = await this.withTimeout(
        fetchShellBootstrap(this.getSupabase()),
        12000,
        "Loading application access"
      );
      if (error) {
        if (this.isRpcUnavailable(error)) return false;
        throw error;
      }
      if (!this.isShellBootstrapPayload(data)) {
        throw new Error("The application bootstrap response is invalid.");
      }
      this.applyShellBootstrap(data);
      return true;
    })();

    this.shellBootstrapLoadPromise = request;
    try {
      return await request;
    } finally {
      if (this.shellBootstrapLoadPromise === request) {
        this.shellBootstrapLoadPromise = null;
      }
    }
  },

  async loadYearOverview(level, force = false) {
    const { level: normalizedLevel } = this.requireScopedRouteParts(
      "Year overview",
      { level }
    );
    const cacheKey = this.getScopedRouteDataKey(normalizedLevel);
    return this.loadScopedRouteData({
      cacheName: "yearByLevel",
      cacheKey,
      rpcName: "app_year_overview",
      params: { p_level: normalizedLevel },
      label: "Loading year overview",
      force,
      normalize: (payload) => {
        this.assertScopedRouteContext(
          payload,
          { level: normalizedLevel },
          "Year overview"
        );
        const normalSource = payload.normal || null;
        const pastPaperSource = payload.pastPaper || payload.past_paper || null;
        const normal = normalSource
          ? {
              levelId: normalSource.levelId || normalSource.level_id || "",
              courseCount: Number(
                normalSource.courseCount ?? normalSource.course_count ?? 0
              ),
              doneCount: Number(
                normalSource.doneCount ?? normalSource.done_count ?? 0
              ),
              totalCount: Number(
                normalSource.totalCount ?? normalSource.total_count ?? 0
              ),
              percent: Number(normalSource.percent || 0),
            }
          : null;
        const normalizedPastPaper = pastPaperSource
          ? this.normalizePastPaperYearRows([pastPaperSource])[0] || null
          : null;
        return {
          level: String(payload.level || normalizedLevel).trim(),
          normal,
          pastPaper: normalizedPastPaper,
        };
      },
    });
  },

  async loadBrowseCourses(level, force = false) {
    const { level: normalizedLevel } = this.requireScopedRouteParts(
      "Course page",
      { level }
    );
    const cacheKey = this.getScopedRouteDataKey(normalizedLevel);
    const requestGeneration = Number(this.routeDataGeneration || 0);
    const page = await this.loadScopedRouteData({
      cacheName: "coursesByLevel",
      cacheKey,
      rpcName: "app_browse_courses",
      params: { p_level: normalizedLevel },
      label: "Loading courses",
      force,
      normalize: (payload) => {
        this.assertScopedRouteContext(
          payload,
          { level: normalizedLevel },
          "Course page"
        );
        return {
          level: normalizedLevel,
          courses: (Array.isArray(payload.courses) ? payload.courses : [])
            .map((row) => {
              const doneCount = Number(row.doneCount ?? row.done_count ?? 0);
              const totalCount = Number(row.totalCount ?? row.total_count ?? 0);
              return {
                id: row.courseId || row.course_id || "",
                name: String(row.name || row.area || "").trim(),
                summary: {
                  moduleCount: Number(row.moduleCount ?? row.module_count ?? 0),
                  doneCount,
                  totalCount,
                  percent: Number(
                    row.percent ??
                      (totalCount
                        ? Math.round((doneCount / totalCount) * 100)
                        : 0)
                  ),
                },
              };
            })
            .filter((row) => row.id && row.name)
            .sort((a, b) => this.compareDisplayOrder(a.name, b.name)),
        };
      },
    });

    if (Number(this.routeDataGeneration || 0) !== requestGeneration) {
      return page;
    }
    this.state.areasByLevel[normalizedLevel] = page.courses.map(
      ({ id, name }) => ({ id, name })
    );
    this.state.areaList = Object.values(this.state.areasByLevel)
      .flat()
      .filter(
        (row, index, rows) =>
          row?.id &&
          rows.findIndex((candidate) => candidate.id === row.id) === index
      );
    return page;
  },

  async loadBrowseSubtopics(level, area, force = false) {
    const { level: normalizedLevel, area: normalizedArea } =
      this.requireScopedRouteParts("Subtopic page", { level, area });
    const cacheKey = this.getScopedRouteDataKey(
      normalizedLevel,
      normalizedArea
    );
    const requestGeneration = Number(this.routeDataGeneration || 0);
    const page = await this.loadScopedRouteData({
      cacheName: "subtopicsByCourse",
      cacheKey,
      rpcName: "app_browse_subtopics",
      params: { p_level: normalizedLevel, p_area: normalizedArea },
      label: "Loading subtopics",
      force,
      normalize: (payload) => {
        this.assertScopedRouteContext(
          payload,
          { level: normalizedLevel, area: normalizedArea },
          "Subtopic page"
        );
        return {
          level: normalizedLevel,
          area: normalizedArea,
          courseId: payload.courseId || payload.course_id || "",
          subtopics: (Array.isArray(payload.subtopics) ? payload.subtopics : [])
            .map((row) => {
              const doneCount = Number(row.doneCount ?? row.done_count ?? 0);
              const totalCount = Number(row.totalCount ?? row.total_count ?? 0);
              return {
                id: row.subtopicId || row.subtopic_id || "",
                name: String(row.name || row.subtopic_name || "").trim(),
                summary: {
                  doneCount,
                  totalCount,
                  percent: Number(
                    row.percent ??
                      (totalCount
                        ? Math.round((doneCount / totalCount) * 100)
                        : 0)
                  ),
                },
              };
            })
            .filter((row) => row.id && row.name)
            .sort((a, b) => this.compareDisplayOrder(a.name, b.name)),
        };
      },
    });

    if (Number(this.routeDataGeneration || 0) !== requestGeneration) {
      return page;
    }
    const areaCacheKey = this.getAreaCacheKey(normalizedLevel, normalizedArea);
    this.state.modulesByArea[areaCacheKey] = page.subtopics.map(
      ({ id, name }) => ({ id, name, areaId: page.courseId })
    );
    this.state.subtopicProgressByArea[areaCacheKey] = Object.fromEntries(
      page.subtopics.map((row) => [row.name, row.summary])
    );
    return page;
  },

  async loadBrowseTypes(level, area, sub, force = false) {
    const {
      level: normalizedLevel,
      area: normalizedArea,
      sub: normalizedSub,
    } = this.requireScopedRouteParts("Question-format page", {
      level,
      area,
      sub,
    });
    const cacheKey = this.getScopedRouteDataKey(
      normalizedLevel,
      normalizedArea,
      normalizedSub
    );
    return this.loadScopedRouteData({
      cacheName: "typesBySubtopic",
      cacheKey,
      rpcName: "app_browse_types",
      params: {
        p_level: normalizedLevel,
        p_area: normalizedArea,
        p_sub: normalizedSub,
      },
      label: "Loading question formats",
      force,
      normalize: (payload) => {
        this.assertScopedRouteContext(
          payload,
          {
            level: normalizedLevel,
            area: normalizedArea,
            sub: normalizedSub,
          },
          "Question-format page"
        );
        const providedTypes = Object.fromEntries(
          (Array.isArray(payload.types) ? payload.types : []).map((row) => [
            row.type === "tf" ? "tf" : "sba",
            row,
          ])
        );
        const types = ["sba", "tf"].map((type) => {
          const row = providedTypes[type] || {};
          const quizCount = Number(row.quizCount ?? row.quiz_count ?? 0);
          const completedCount = Number(
            row.completedCount ?? row.completed_count ?? 0
          );
          return {
            type,
            quizCount,
            questionCount: Number(row.questionCount ?? row.question_count ?? 0),
            completedCount,
            percent: Number(
              row.percent ??
                (quizCount ? Math.round((completedCount / quizCount) * 100) : 0)
            ),
          };
        });
        const totalQuizCount = Number(
          payload.totalQuizCount ??
            payload.total_quiz_count ??
            types.reduce((sum, row) => sum + row.quizCount, 0)
        );
        const completedQuizCount = Number(
          payload.completedQuizCount ??
            payload.completed_quiz_count ??
            types.reduce((sum, row) => sum + row.completedCount, 0)
        );
        return {
          level: normalizedLevel,
          area: normalizedArea,
          sub: normalizedSub,
          totalQuestions: Number(
            payload.totalQuestions ??
              payload.total_questions ??
              types.reduce((sum, row) => sum + row.questionCount, 0)
          ),
          totalQuizCount,
          completedQuizCount,
          percent: Number(
            payload.percent ??
              (totalQuizCount
                ? Math.round((completedQuizCount / totalQuizCount) * 100)
                : 0)
          ),
          types,
        };
      },
    });
  },

  async loadBrowseQuizzes(level, area, sub, type, force = false) {
    const {
      level: normalizedLevel,
      area: normalizedArea,
      sub: normalizedSub,
      type: normalizedType,
    } = this.requireScopedRouteParts("Assessment page", {
      level,
      area,
      sub,
      type,
    });
    if (!["sba", "tf"].includes(normalizedType)) {
      throw new Error("Assessment page received an invalid question type.");
    }
    const cacheKey = this.getScopedRouteDataKey(
      normalizedLevel,
      normalizedArea,
      normalizedSub,
      normalizedType
    );
    const requestGeneration = Number(this.routeDataGeneration || 0);
    const page = await this.loadScopedRouteData({
      cacheName: "quizzesByType",
      cacheKey,
      rpcName: "app_browse_quizzes",
      params: {
        p_level: normalizedLevel,
        p_area: normalizedArea,
        p_sub: normalizedSub,
        p_type: normalizedType,
      },
      label: "Loading assessments",
      force,
      normalize: (payload) => {
        this.assertScopedRouteContext(
          payload,
          {
            level: normalizedLevel,
            area: normalizedArea,
            sub: normalizedSub,
            type: normalizedType,
          },
          "Assessment page"
        );
        const quizzes = (Array.isArray(payload.quizzes) ? payload.quizzes : [])
          .map((row) => ({
            id: row.quizId || row.quiz_id || "",
            title: String(row.title || row.quiz_title || "").trim(),
            count: Number(row.questionCount ?? row.question_count ?? 0),
            totalAttempts: Number(row.totalAttempts ?? row.total_attempts ?? 0),
            bestPercentage:
              row.bestPercentage === null ||
              row.best_percentage === null ||
              (row.bestPercentage === undefined &&
                row.best_percentage === undefined)
                ? null
                : Number(row.bestPercentage ?? row.best_percentage ?? 0),
          }))
          .filter((row) => row.id && row.title)
          .sort((a, b) => this.compareDisplayOrder(a.title, b.title));
        const summary = payload.summary || {};
        const completedCount = Number(
          summary.completedCount ??
            summary.completed_count ??
            quizzes.filter((row) => row.totalAttempts > 0).length
        );
        return {
          level: normalizedLevel,
          area: normalizedArea,
          sub: normalizedSub,
          type: normalizedType,
          topicIndex: Math.max(
            1,
            Number(payload.topicIndex ?? payload.topic_index ?? 1)
          ),
          summary: {
            assessmentCount: Number(
              summary.assessmentCount ??
                summary.assessment_count ??
                quizzes.length
            ),
            completedCount,
            averageBestPercentage:
              summary.averageBestPercentage === null ||
              summary.average_best_percentage === null ||
              (summary.averageBestPercentage === undefined &&
                summary.average_best_percentage === undefined)
                ? null
                : Number(
                    summary.averageBestPercentage ??
                      summary.average_best_percentage ??
                      0
                  ),
          },
          quizzes,
        };
      },
    });

    if (Number(this.routeDataGeneration || 0) !== requestGeneration) {
      return page;
    }
    const moduleCacheKey = this.getModuleCacheKey(
      normalizedLevel,
      normalizedArea,
      normalizedSub
    );
    const moduleData = this.state.quizzesByModule[moduleCacheKey] || {
      sba: {},
      tf: {},
    };
    moduleData[normalizedType] = Object.fromEntries(
      page.quizzes.map((quiz) => [
        quiz.title,
        { id: quiz.id, count: quiz.count },
      ])
    );
    this.state.quizzesByModule[moduleCacheKey] = moduleData;
    page.quizzes.forEach((quiz, index) => {
      this.registerQuizDescriptor({
        level: normalizedLevel,
        quizId: quiz.id,
        area: normalizedArea,
        sub: normalizedSub,
        type: normalizedType,
        title: quiz.title,
        count: quiz.count,
        quizIndex: index + 1,
      });
    });
    return page;
  },

  getEmptyAccountPage() {
    const emptySection = {
      attemptsCount: 0,
      assessmentsDoneCount: 0,
      averagePercentage: 0,
    };
    return {
      attemptsCount: 0,
      quizzesDoneCount: 0,
      averagePercentage: 0,
      bestAttempt: null,
      sectionStats: {
        normal: { ...emptySection },
        exam: { ...emptySection },
        combined: { ...emptySection },
      },
      courseStats: [],
      recentAttempts: [],
    };
  },

  normalizeAccountAttempt(row) {
    if (!row || typeof row !== "object") return null;
    return {
      id: row.id || row.attemptKey || row.attempt_key || "",
      quizId: row.quizId || row.quiz_id || "",
      setId: row.setId || row.set_id || "",
      assessmentKind:
        row.assessmentKind === "past_paper" ||
        row.assessment_kind === "past_paper"
          ? "past_paper"
          : "quiz",
      level: String(row.level || "").trim(),
      area: String(row.area || "").trim(),
      sub: String(row.sub || "").trim(),
      quizTitle: String(
        row.quizTitle || row.quiz_title || row.title || ""
      ).trim(),
      mode: row.mode === "exam" ? "exam" : "study",
      score: Number(row.score || 0),
      totalQuestions: Number(
        row.totalQuestions ?? row.total_questions ?? row.totalMarks ?? 0
      ),
      correctCount: Number(row.correctCount ?? row.correct_count ?? 0),
      wrongCount: Number(row.wrongCount ?? row.wrong_count ?? 0),
      unansweredCount: Number(row.unansweredCount ?? row.unanswered_count ?? 0),
      percentage: Number(row.percentage || 0),
      completedAt: row.completedAt || row.completed_at || "",
    };
  },

  normalizeAccountPage(payload) {
    const source = payload?.summary || payload || {};
    const empty = this.getEmptyAccountPage();
    const normalizeSection = (key) => {
      const row =
        source.sectionStats?.[key] || source.section_stats?.[key] || {};
      return {
        attemptsCount: Number(row.attemptsCount ?? row.attempts_count ?? 0),
        assessmentsDoneCount: Number(
          row.assessmentsDoneCount ?? row.assessments_done_count ?? 0
        ),
        averagePercentage: Number(
          row.averagePercentage ?? row.average_percentage ?? 0
        ),
      };
    };
    const recentSource =
      payload?.history?.items ||
      source.recentAttempts ||
      source.recent_attempts ||
      [];
    return {
      ...empty,
      attemptsCount: Number(source.attemptsCount ?? source.attempts_count ?? 0),
      quizzesDoneCount: Number(
        source.quizzesDoneCount ??
          source.quizzes_done_count ??
          source.assessmentsDoneCount ??
          source.assessments_done_count ??
          0
      ),
      averagePercentage: Number(
        source.averagePercentage ?? source.average_percentage ?? 0
      ),
      bestAttempt: this.normalizeAccountAttempt(
        source.bestAttempt || source.best_attempt
      ),
      sectionStats: {
        normal: normalizeSection("normal"),
        exam: normalizeSection("exam"),
        combined: normalizeSection("combined"),
      },
      courseStats: (source.courseStats || source.course_stats || [])
        .map((row) => ({
          area: String(row.area || "Unknown course").trim(),
          attempts: Number(row.attempts || 0),
          quizzesDone: Number(
            row.quizzesDone ??
              row.quizzes_done ??
              row.assessmentsDone ??
              row.assessments_done ??
              0
          ),
          averagePercentage: Number(
            row.averagePercentage ?? row.average_percentage ?? 0
          ),
          bestAttempt: this.normalizeAccountAttempt(
            row.bestAttempt || row.best_attempt
          ),
        }))
        .sort(
          (a, b) =>
            b.averagePercentage - a.averagePercentage ||
            this.compareDisplayOrder(a.area, b.area)
        ),
      recentAttempts: recentSource
        .map((row) => this.normalizeAccountAttempt(row))
        .filter(Boolean)
        .slice(0, 10),
    };
  },

  async loadAccountPage(force = false) {
    return this.loadScopedRouteData({
      cacheName: "accountByKey",
      cacheKey: "first-page",
      rpcName: "app_account_page",
      params: { p_limit: 10 },
      label: "Loading account",
      force,
      normalize: (payload) => this.normalizeAccountPage(payload),
    });
  },

  async loadQuizSearchPage(rawQuery, force = false) {
    const query = String(rawQuery ?? "").trim();
    const cacheKey = this.normalizeSearchText
      ? this.normalizeSearchText(query)
      : query.toLowerCase();
    const requestGeneration = Number(this.routeDataGeneration || 0);
    const page = await this.loadScopedRouteData({
      cacheName: "searchByQuery",
      cacheKey,
      rpcName: "app_quiz_search",
      params: { p_query: cacheKey, p_limit: cacheKey ? 18 : 12 },
      label: "Searching assessments",
      force,
      normalize: (payload) => ({
        displayQuery: query,
        browseMode: !!(payload.browseMode ?? payload.browse_mode ?? !query),
        totalItems: Number(payload.totalItems ?? payload.total_items ?? 0),
        totalMatches: Number(
          payload.totalMatches ?? payload.total_matches ?? 0
        ),
        results: (Array.isArray(payload.results) ? payload.results : [])
          .map((row) => ({
            quizId: row.quizId || row.quiz_id || "",
            level: String(row.level || "").trim(),
            area: String(row.area || "").trim(),
            sub: String(row.sub || "").trim(),
            type:
              row.type === "tf" || row.question_type === "tf" ? "tf" : "sba",
            title: String(row.title || row.quiz_title || "").trim(),
            count: Number(
              row.count ?? row.questionCount ?? row.question_count ?? 0
            ),
          }))
          .filter((row) => row.quizId && row.title),
      }),
    });
    if (Number(this.routeDataGeneration || 0) !== requestGeneration) {
      return page;
    }
    page.results.forEach((item) => {
      this.registerQuizDescriptor({
        level: item.level,
        quizId: item.quizId,
        area: item.area,
        sub: item.sub,
        type: item.type,
        title: item.title,
        count: item.count,
      });
    });
    return page;
  },

  applyQuizContextPayload(payload) {
    if (
      !payload ||
      Array.isArray(payload) ||
      typeof payload !== "object" ||
      Number(payload.schemaVersion) !== 1
    ) {
      throw new Error("Quiz context returned an invalid response.");
    }

    const descriptorRow = payload.descriptor;
    if (!descriptorRow || typeof descriptorRow !== "object") return null;
    const quizId = descriptorRow.quiz_id || descriptorRow.quizId || "";
    const descriptor = this.registerQuizDescriptor({
      quizId,
      level: descriptorRow.level,
      area: descriptorRow.area,
      sub: descriptorRow.sub,
      type: descriptorRow.question_type || descriptorRow.type,
      title: descriptorRow.quiz_title || descriptorRow.title,
      count: descriptorRow.question_count ?? descriptorRow.count,
    });
    if (descriptor) {
      const siblings = (Array.isArray(payload.siblings) ? payload.siblings : [])
        .map((row) => ({
          quizId: row.quizId || row.quiz_id || "",
          title: String(row.title || row.quiz_title || "").trim(),
        }))
        .filter((row) => row.quizId && row.title)
        .sort((a, b) => this.compareDisplayOrder(a.title, b.title));
      descriptor.quizIndex = Math.max(
        1,
        siblings.findIndex((row) => row.quizId === quizId) + 1
      );
    }
    return descriptor;
  },

  async loadQuizDescriptorsByIds(quizIds, label = "Loading quiz details") {
    const ids = [...new Set((quizIds || []).filter(Boolean))];
    const missingQuizIds = ids.filter(
      (quizId) => !this.state.quizDetailsById[quizId]
    );
    if (!missingQuizIds.length) return;

    await Promise.all(
      missingQuizIds.map(async (quizId) => {
        const { data, error } = await this.withTimeout(
          this.getSupabase().rpc("app_quiz_context", {
            p_quiz_id: quizId,
          }),
          12000,
          label
        );
        if (error) throw error;
        this.applyQuizContextPayload(data);
      })
    );
  },

  async ensureQuizContextFromId(quizId) {
    if (!quizId) return false;

    if (!this.state.quizDetailsById[quizId]) {
      await this.loadQuizDescriptorsByIds([quizId]);
    }

    const descriptor = this.state.quizDetailsById[quizId];
    if (!descriptor) return false;

    this.state.currentQuizId = descriptor.quizId;
    this.state.currentLevel = descriptor.level;
    this.state.currentArea = descriptor.area;
    this.state.currentSub = descriptor.sub;
    this.state.currentType = descriptor.type;
    this.state.currentQuizTitle = descriptor.title;
    return true;
  },

  buildAttemptsSignature(attempts) {
    return (attempts || [])
      .map((attempt) =>
        [
          attempt?.id ? `id:${attempt.id}` : "",
          attempt?.quizId || "",
          attempt?.mode || "",
          Number(attempt?.score || 0),
          Number(attempt?.totalQuestions || 0),
          Number(attempt?.correctCount || 0),
          Number(attempt?.wrongCount || 0),
          Number(attempt?.unansweredCount || 0),
          Number(attempt?.percentage || 0),
          attempt?.completedAt || "",
        ].join("|||")
      )
      .join("::::");
  },

  invalidateAttemptDerivedCaches() {
    this.routeDataGeneration += 1;
    this.state.subtopicProgressByArea = {};
    this.state.accountSummary = null;
    this.state.quizAttemptSummariesById = {};
    const routeData = this.ensureRouteDataState();
    routeData.yearByLevel = {};
    routeData.coursesByLevel = {};
    routeData.subtopicsByCourse = {};
    routeData.typesBySubtopic = {};
    routeData.quizzesByType = {};
    routeData.accountByKey = {};
  },

  invalidatePastPaperDerivedCaches() {
    this.routeDataGeneration += 1;
    const routeData = this.ensureRouteDataState();
    routeData.yearByLevel = {};
    routeData.accountByKey = {};
    const pastPapers = this.getPastPaperState?.();
    if (pastPapers) {
      pastPapers.yearsLoaded = false;
      pastPapers.topicsByYear = {};
      pastPapers.examsByTopic = {};
    }
  },

  invalidateHomeDashboardData() {
    this.homeBootstrapLoadedThisPage = false;
    this.state.homeDashboard = {
      loaded: false,
      generatedAt: "",
      stats: null,
      levelProgressByName: {},
    };
    this.clearPersistedAppDataCache?.();
  },

  setAttemptsData(attempts) {
    const normalizedAttempts = this.normalizeAttempts(attempts);
    const attemptsSignature = this.buildAttemptsSignature(normalizedAttempts);
    const attemptsChanged = attemptsSignature !== this.state.attemptsSignature;

    this.state.attempts = normalizedAttempts;
    this.state.attemptsSignature = attemptsSignature;
    this.state.attemptsByQuizId =
      this.groupAttemptsByQuizId(normalizedAttempts);
    this.state.userStats = this.buildUserStats(
      normalizedAttempts,
      this.state.pastPaperAttempts || []
    );

    if (attemptsChanged && !this.restoringAppDataCache) {
      this.invalidateAttemptDerivedCaches();
    }

    this.scheduleAppDataCacheWrite();
  },

  setPastPaperAttemptsData(attempts) {
    const seen = new Set();
    this.state.pastPaperAttempts = (attempts || [])
      .filter((attempt) => {
        const key = String(
          attempt?.id ||
            `past_paper:${attempt?.setId || ""}:${attempt?.completedAt || ""}`
        );
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b?.completedAt || 0).getTime() -
          new Date(a?.completedAt || 0).getTime()
      );
    this.state.userStats = this.buildUserStats(
      this.state.attempts || [],
      this.state.pastPaperAttempts
    );
    this.state.accountSummary = null;
    this.scheduleAppDataCacheWrite();
  },

  normalizeAttempts(attempts) {
    const seen = new Set();

    return (attempts || [])
      .filter((attempt) => {
        const key = attempt?.id
          ? `id:${attempt.id}`
          : [
              attempt?.quizId || "",
              attempt?.mode || "",
              attempt?.completedAt || "",
              attempt?.score || 0,
              attempt?.percentage || 0,
            ].join("|||");

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b?.completedAt || 0).getTime() -
          new Date(a?.completedAt || 0).getTime()
      );
  },

  groupAttemptsByQuizId(attempts) {
    const grouped = {};
    (attempts || []).forEach((attempt) => {
      if (!grouped[attempt.quizId]) grouped[attempt.quizId] = [];
      grouped[attempt.quizId].push(attempt);
    });
    return grouped;
  },

  getQuizDescriptorById(quizId) {
    return this.state.quizDetailsById[quizId] || null;
  },

  getAttemptsForQuizId(quizId) {
    return this.state.attemptsByQuizId[quizId] || [];
  },

  getAttemptStatsForQuizId(quizId) {
    const attempts = this.getAttemptsForQuizId(quizId);
    if (!attempts.length) return null;

    const summarize = (mode) => {
      const modeAttempts = attempts.filter((attempt) => attempt.mode === mode);
      if (!modeAttempts.length) return null;

      const latest = modeAttempts[0];
      const best = modeAttempts.reduce((bestAttempt, currentAttempt) => {
        if (!bestAttempt) return currentAttempt;
        if (currentAttempt.percentage > bestAttempt.percentage)
          return currentAttempt;
        if (
          currentAttempt.percentage === bestAttempt.percentage &&
          currentAttempt.score > bestAttempt.score
        )
          return currentAttempt;
        return bestAttempt;
      }, null);

      return { latest, best, attempts: modeAttempts.length };
    };

    return {
      totalAttempts: attempts.length,
      latest: attempts[0],
      study: summarize("study"),
      exam: summarize("exam"),
    };
  },

  formatModeLabel(mode) {
    return mode === "exam" ? "Exam" : "Study";
  },

  formatQuizSettingsLabel(snapshot) {
    const durationMinutes = this.normalizeQuizDurationMinutes(
      snapshot?.context?.durationMinutes
    );
    const negativeMarking =
      snapshot?.negativeMarking ??
      snapshot?.context?.negativeMarking ??
      snapshot?.mode === "exam";
    const timerLabel = durationMinutes ? `${durationMinutes} min` : "No time";
    return `${timerLabel} · ${negativeMarking ? "Negative marking" : "Standard marking"}`;
  },

  formatAttemptScore(attempt) {
    if (!attempt) return "No attempts";
    return `${attempt.score}/${attempt.totalQuestions} (${attempt.percentage}%)`;
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

  registerQuizDescriptor({
    quizId,
    level,
    area,
    sub,
    type,
    title,
    count,
    quizIndex,
  }) {
    if (!quizId) return null;

    const normalizedLevel = String(level || "").trim() || "Unknown level";
    const normalizedArea = String(area || "").trim() || "Unknown course";
    const normalizedSub = String(sub || "").trim() || "Unknown module";
    const normalizedType = type === "tf" ? "tf" : "sba";
    const normalizedTitle = String(title || "").trim() || "Review Quiz";
    const normalizedCount = Number(count || 0);

    this.state.quizMap[
      this.buildQuizKey(
        normalizedLevel,
        normalizedArea,
        normalizedSub,
        normalizedType,
        normalizedTitle
      )
    ] = {
      id: quizId,
      count: normalizedCount,
    };

    this.state.quizDetailsById[quizId] = {
      level: normalizedLevel,
      area: normalizedArea,
      sub: normalizedSub,
      type: normalizedType,
      title: normalizedTitle,
      quizId,
      count: normalizedCount,
      quizIndex: Math.max(1, Number(quizIndex || 1)),
    };

    return this.state.quizDetailsById[quizId];
  },

  calculateAveragePercentage(attempts) {
    if (!attempts.length) return 0;
    const total = attempts.reduce(
      (sum, attempt) => sum + Number(attempt.percentage || 0),
      0
    );
    return Math.round(total / attempts.length);
  },

  buildUserStats(attempts, pastPaperAttempts = []) {
    const normalAttempts = (attempts || []).map((attempt) => ({
      ...attempt,
      assessmentKind: "quiz",
      section: "normal",
    }));
    const examAttempts = (pastPaperAttempts || []).map((attempt) => ({
      ...attempt,
      assessmentKind: "past_paper",
      section: "exam",
      mode: "exam",
    }));
    const combinedAttempts = [...normalAttempts, ...examAttempts].sort(
      (a, b) =>
        new Date(b?.completedAt || 0).getTime() -
        new Date(a?.completedAt || 0).getTime()
    );
    const assessmentIds = new Set();
    const modes = { study: [], exam: [] };
    const courseMap = {};

    combinedAttempts.forEach((attempt) => {
      if (attempt.assessmentKind === "past_paper" && attempt?.setId) {
        assessmentIds.add(`past_paper:${attempt.setId}`);
      } else if (attempt?.quizId) {
        assessmentIds.add(`quiz:${attempt.quizId}`);
      }
      if (attempt.assessmentKind === "quiz" && modes[attempt.mode]) {
        modes[attempt.mode].push(attempt);
      }

      const quiz = this.getQuizDescriptorById(attempt.quizId);
      const levelName = attempt.level || quiz?.level || "";
      const areaName = attempt.area || quiz?.area || "Unknown course";
      const courseLabel = levelName ? `${levelName} - ${areaName}` : areaName;
      if (!courseMap[courseLabel]) courseMap[courseLabel] = [];
      courseMap[courseLabel].push(attempt);
    });

    const bestAttempt = combinedAttempts.reduce((best, current) => {
      if (!best) return current;
      if (current.percentage > best.percentage) return current;
      if (current.percentage === best.percentage && current.score > best.score)
        return current;
      return best;
    }, null);

    const courseStats = Object.entries(courseMap)
      .map(([area, courseAttempts]) => ({
        area,
        attempts: courseAttempts.length,
        quizzesDone: new Set(
          courseAttempts
            .map((attempt) =>
              attempt.assessmentKind === "past_paper"
                ? attempt.setId
                  ? `past_paper:${attempt.setId}`
                  : ""
                : attempt.quizId
                  ? `quiz:${attempt.quizId}`
                  : ""
            )
            .filter(Boolean)
        ).size,
        averagePercentage: this.calculateAveragePercentage(courseAttempts),
        bestAttempt: courseAttempts.reduce((best, current) => {
          if (!best) return current;
          if (current.percentage > best.percentage) return current;
          if (
            current.percentage === best.percentage &&
            current.score > best.score
          )
            return current;
          return best;
        }, null),
      }))
      .sort((a, b) => {
        if (b.averagePercentage !== a.averagePercentage)
          return b.averagePercentage - a.averagePercentage;
        return this.compareDisplayOrder(a.area, b.area);
      });

    return {
      attemptsCount: combinedAttempts.length,
      quizzesDoneCount: assessmentIds.size,
      averagePercentage: this.calculateAveragePercentage(combinedAttempts),
      bestAttempt,
      sectionStats: {
        normal: {
          attemptsCount: normalAttempts.length,
          assessmentsDoneCount: new Set(
            normalAttempts.map((attempt) => attempt.quizId).filter(Boolean)
          ).size,
          averagePercentage: this.calculateAveragePercentage(normalAttempts),
        },
        exam: {
          attemptsCount: examAttempts.length,
          assessmentsDoneCount: new Set(
            examAttempts.map((attempt) => attempt.setId).filter(Boolean)
          ).size,
          averagePercentage: this.calculateAveragePercentage(examAttempts),
        },
        combined: {
          attemptsCount: combinedAttempts.length,
          assessmentsDoneCount: assessmentIds.size,
          averagePercentage: this.calculateAveragePercentage(combinedAttempts),
        },
      },
      modeStats: {
        study: {
          attemptsCount: modes.study.length,
          averagePercentage: this.calculateAveragePercentage(modes.study),
        },
        exam: {
          attemptsCount: modes.exam.length,
          averagePercentage: this.calculateAveragePercentage(modes.exam),
        },
      },
      courseStats,
      recentAttempts: combinedAttempts.slice(0, 10),
    };
  },

  async getQuizAttemptSummary(quizId, force = false) {
    if (!quizId) return null;
    if (!force && this.state.quizAttemptSummariesById[quizId]) {
      return this.state.quizAttemptSummariesById[quizId];
    }

    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_quiz_attempt_summary", {
        p_quiz_id: quizId,
      }),
      12000,
      "Loading quiz attempt summary"
    );

    if (error) throw error;

    this.state.quizAttemptSummariesById[quizId] = data || null;
    return this.state.quizAttemptSummariesById[quizId];
  },

  getCachedQuizAttemptCount(quizId) {
    const summaryCount =
      this.state.quizAttemptSummariesById[quizId]?.totalAttempts;
    if (
      summaryCount !== null &&
      summaryCount !== undefined &&
      Number.isFinite(Number(summaryCount))
    ) {
      return Number(summaryCount);
    }

    for (const page of Object.values(
      this.state.routeData?.quizzesByType || {}
    )) {
      const quiz = page?.quizzes?.find((row) => row.id === quizId);
      if (quiz) return Number(quiz.totalAttempts || 0);
    }

    const localAttempts = this.getAttemptsForQuizId(quizId);
    return localAttempts.length ? localAttempts.length : null;
  },

  async saveAttemptRecord(payload) {
    const userId = this.state.currentUser?.id;
    if (!userId) return { success: false, error: new Error("No active user.") };
    const previousAttemptCount = this.getCachedQuizAttemptCount(payload.quizId);

    const { data, error } = await this.withTimeout(
      this.getSupabase()
        .from("quiz_attempts")
        .insert({
          user_id: userId,
          quiz_id: payload.quizId,
          mode: payload.mode,
          score: payload.score,
          total_questions: payload.totalQuestions,
          correct_count: payload.correctCount,
          wrong_count: payload.wrongCount,
          unanswered_count: payload.unansweredCount,
          percentage: payload.percentage,
        })
        .select(
          "id, user_id, quiz_id, mode, score, total_questions, correct_count, wrong_count, unanswered_count, percentage, completed_at"
        )
        .single(),
      12000,
      "Saving quiz result"
    );

    if (error) return { success: false, error };

    const savedAttempt = {
      id: data.id,
      userId: data.user_id,
      quizId: data.quiz_id,
      mode: data.mode === "exam" ? "exam" : "study",
      score: Number(data.score || 0),
      totalQuestions: Number(data.total_questions || 0),
      correctCount: Number(data.correct_count || 0),
      wrongCount: Number(data.wrong_count || 0),
      unansweredCount: Number(data.unanswered_count || 0),
      percentage: Number(data.percentage || 0),
      completedAt: data.completed_at || "",
    };

    this.setAttemptsData([savedAttempt, ...this.state.attempts]);
    this.state.accountSummary = null;
    delete this.state.quizAttemptSummariesById[payload.quizId];
    this.invalidateHomeDashboardData();

    let attemptCount =
      previousAttemptCount === null ? null : previousAttemptCount + 1;
    if (attemptCount === null) {
      try {
        const summary = await this.getQuizAttemptSummary(payload.quizId, true);
        attemptCount = Number(summary?.totalAttempts || 1);
      } catch (summaryError) {
        console.error("Quiz attempt count refresh failed:", summaryError);
        attemptCount = this.getAttemptsForQuizId(payload.quizId).length || 1;
      }
    }

    return { success: true, attempt: savedAttempt, attemptCount };
  },

  async resetAccountData() {
    const userId = this.state.currentUser?.id;
    if (!userId) return;
    const confirmed = await confirmDialog({
      title: "Reset account history",
      message:
        "This will delete your saved quiz and exam attempts, drafts, and performance stats.",
      submitLabel: "Reset account",
      danger: true,
    });
    if (!confirmed) return;

    const resetButton = this.dom.settingsResetAccountBtn;
    if (resetButton) {
      resetButton.disabled = true;
      resetButton.textContent = "Resetting...";
    }

    try {
      this.cancelPendingAssessmentProgressWrites();
      await this.assessmentProgressWriteQueue.catch(() => undefined);
      const resetResult = await this.withTimeout(
        this.getSupabase().rpc("app_reset_account_history"),
        12000,
        "Resetting account history"
      );

      if (resetResult.error && this.isRpcUnavailable(resetResult.error)) {
        const [attemptsResult, progressResult] = await Promise.all([
          this.withTimeout(
            this.getSupabase()
              .from("quiz_attempts")
              .delete()
              .eq("user_id", userId),
            12000,
            "Resetting quiz history"
          ),
          this.withTimeout(
            deleteAllAssessmentProgress(this.getSupabase(), userId),
            12000,
            "Resetting saved progress"
          ),
        ]);
        if (attemptsResult.error) throw attemptsResult.error;
        if (progressResult.error) throw progressResult.error;
      } else if (resetResult.error) {
        throw resetResult.error;
      }
      this.setAttemptsData([]);
      this.setPastPaperAttemptsData([]);
      this.invalidateAttemptDerivedCaches();
      this.invalidatePastPaperDerivedCaches();
      this.invalidateHomeDashboardData();
      this.state.accountSummary = null;
      this.state.quizAttemptSummariesById = {};
      this.showToast("Account history reset.");
      this.router();
    } catch (error) {
      console.error("Account reset failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showToast("Account reset failed.");
    } finally {
      if (resetButton) {
        resetButton.disabled = false;
        resetButton.textContent = "Reset Account";
      }
    }
  },

  getAreaCacheKey(level, area) {
    return `${level}|||${area}`;
  },

  getModuleCacheKey(level, area, sub) {
    return `${level}|||${area}|||${sub}`;
  },

  buildQuizKey(level, area, sub, type, title) {
    return `${level}|||${area}|||${sub}|||${type}|||${title}`;
  },

  getCurrentQuizMeta() {
    if (
      this.state.currentQuizId &&
      this.state.quizDetailsById[this.state.currentQuizId]
    ) {
      const descriptor = this.state.quizDetailsById[this.state.currentQuizId];
      return {
        id: descriptor.quizId,
        count: descriptor.count,
      };
    }

    return (
      this.state.quizMap[
        this.buildQuizKey(
          this.state.currentLevel,
          this.state.currentArea,
          this.state.currentSub,
          this.state.currentType,
          this.state.currentQuizTitle
        )
      ] || null
    );
  },

  getCurrentQuizIndex(type = this.state.currentType) {
    const descriptor = this.state.quizDetailsById[this.state.currentQuizId];
    const descriptorIndex = Number(descriptor?.quizIndex || 0);
    if (descriptorIndex > 0) return descriptorIndex;

    const currentModule =
      this.state.quizzesByModule[
        this.getModuleCacheKey(
          this.state.currentLevel,
          this.state.currentArea,
          this.state.currentSub
        )
      ] || {};
    const orderedQuizzes = Object.entries(currentModule?.[type] || {})
      .sort(([titleA], [titleB]) => this.compareDisplayOrder(titleA, titleB))
      .map(([title, quiz]) => ({ ...quiz, title }));
    return (
      Math.max(
        0,
        orderedQuizzes.findIndex(
          (quiz) =>
            quiz.id === this.state.currentQuizId ||
            quiz.title === this.state.currentQuizTitle
        )
      ) + 1
    );
  },

  normalizeQuizQuestionRows(rows, type = this.state.currentType) {
    const normalizedType = type === "tf" ? "tf" : "sba";
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const options = [
        row.option_a,
        row.option_b,
        row.option_c,
        row.option_d,
        row.option_e,
      ]
        .filter((value) => value && String(value).trim())
        .map((value) => String(value).trim());
      const normalizedAnswer =
        normalizedType === "tf"
          ? this.normalizeTfAnswer(row.correct_answer)
          : this.normalizeSbaAnswer(row.correct_answer, options);

      return {
        key: this.buildQuestionIdentity(
          row,
          normalizedType,
          options,
          normalizedAnswer
        ),
        q: String(row.question_text || "").trim(),
        a: normalizedAnswer,
        exp: row.explanation ? String(row.explanation).trim() : "",
        img: row.image_url ? String(row.image_url).trim() : "",
        options: normalizedType === "sba" ? options : null,
        type: normalizedType,
      };
    });
  },

  showFatalLoadError() {
    this.showOnly("loading-view");
    if (!this.dom.loadingView) return;
    this.dom.loadingView.setAttribute("aria-busy", "false");
    this.dom.loadingView.innerHTML = `
      <div class="load-error-card" role="alert">
        <h2>Couldn't connect</h2>
        <p>Check your internet connection and try again.</p>
        <button id="btn-retry-load" class="load-error-retry-btn" type="button">Retry</button>
      </div>
    `;

    document
      .getElementById("btn-retry-load")
      ?.addEventListener("click", (event) => {
        const retryButton = event.currentTarget;
        retryButton.disabled = true;
        retryButton.textContent = "Retrying…";
        this.dom.loadingView.setAttribute("aria-busy", "true");
        window.location.reload();
      });
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  normalizeText(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  },

  normalizeTfAnswer(value) {
    const raw = this.normalizeText(value);
    if (!raw) return "";
    if (["true", "t", "1", "yes"].includes(raw)) return "TRUE";
    if (["false", "f", "0", "no"].includes(raw)) return "FALSE";
    return raw.toUpperCase();
  },

  buildQuestionIdentity(row, type, options, normalizedAnswer) {
    const explicitId = row?.question_id ?? row?.id ?? row?.quiz_question_id;
    if (
      explicitId !== null &&
      explicitId !== undefined &&
      String(explicitId).trim()
    ) {
      return `id:${String(explicitId).trim()}`;
    }

    return [
      type || "",
      this.normalizeText(row?.question_text || ""),
      normalizedAnswer || "",
      this.normalizeText(row?.explanation || ""),
      String(row?.image_url || "").trim(),
      (options || []).map((value) => this.normalizeText(value)).join("|"),
    ].join("|||");
  },

  buildQuestionFieldName(index) {
    return `q${index}`;
  },

  shuffleArray(items) {
    const shuffled = [...(items || [])];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }

    return shuffled;
  },

  getQuizSessionQuestions(baseQuestions, savedDraft = null) {
    const questions = Array.isArray(baseQuestions) ? [...baseQuestions] : [];
    const currentType =
      this.state.currentType === "tf" || this.state.currentType === "sba"
        ? this.state.currentType
        : "";

    if (!questions.length || !currentType) {
      return questions;
    }

    const savedOrder = Array.isArray(savedDraft?.questionOrder)
      ? savedDraft.questionOrder
      : null;
    const questionMap = new Map(
      questions.map((question) => [question.key, question])
    );

    if (
      savedOrder?.length === questions.length &&
      savedOrder.every((key) => questionMap.has(key))
    ) {
      return savedOrder.map((key) => questionMap.get(key));
    }

    if (savedDraft?.answers && !savedOrder?.length) {
      return questions;
    }

    return this.shuffleArray(questions);
  },

  normalizeSbaAnswer(answerValue, options) {
    const raw = String(answerValue ?? "").trim();
    if (!raw) return "";

    const upper = raw.toUpperCase();
    if (/^[A-E]$/.test(upper)) return upper;

    const normalizedRaw = this.normalizeText(raw);
    const letters = ["A", "B", "C", "D", "E"];
    for (let index = 0; index < (options || []).length; index += 1) {
      if (this.normalizeText(options[index]) === normalizedRaw) {
        return letters[index];
      }
    }

    const match = upper.match(/\b([A-E])\b/);
    if (match) return match[1];
    return upper.charAt(0);
  },

  getTypeMeta(type) {
    return TYPE_META[type] || TYPE_META.sba;
  },

  getTypePresentation(type) {
    if (type === "tf") {
      return {
        modeTag: "Speed",
        selectionDescription: "Binary format / fast recall",
        listDescription: "Speed format / binary answers",
      };
    }

    return {
      modeTag: "Precision",
      selectionDescription: "Five-option MCQ / A-E format",
      listDescription: "Precision format / five-option answers",
    };
  },

  getPreferredAttemptForDisplay(attemptStats) {
    if (!attemptStats) return null;

    const candidates = [
      attemptStats.study?.best
        ? { ...attemptStats.study.best, mode: "study" }
        : null,
      attemptStats.exam?.best
        ? { ...attemptStats.exam.best, mode: "exam" }
        : null,
    ].filter(Boolean);

    if (!candidates.length) return attemptStats.latest || null;

    return candidates.reduce((bestAttempt, currentAttempt) => {
      if (!bestAttempt) return currentAttempt;
      if (
        Number(currentAttempt.percentage || 0) >
        Number(bestAttempt.percentage || 0)
      )
        return currentAttempt;
      if (
        Number(currentAttempt.percentage || 0) ===
          Number(bestAttempt.percentage || 0) &&
        Number(currentAttempt.correctCount || 0) >
          Number(bestAttempt.correctCount || 0)
      ) {
        return currentAttempt;
      }
      return bestAttempt;
    }, null);
  },

  getBrowseToneClass(index) {
    return `tone-${(index % 4) + 1}`;
  },

  getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning,";
    if (hour < 18) return "Good afternoon,";
    return "Good evening,";
  },

  getBrowseMetaIcon(kind = "book") {
    if (kind === "attempt") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6v6l4 2"></path>
          <circle cx="12" cy="12" r="9"></circle>
        </svg>
      `;
    }

    if (kind === "chapter") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <path d="M13 2v7h7"></path>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    `;
  },

  buildBrowseCardMarkup({
    badge,
    title,
    kickerLabel = "",
    toneClass,
    statusLabel,
    statusClass,
    metaKind = "book",
    metaLabel = "",
    progressPercent = 0,
    progressLabel = "",
    secondaryMetaText = "",
    metricValue = "",
    metricLabel = "",
    locked = false,
    lockedLabel = "Available soon",
  }) {
    const safePercent = Math.max(
      0,
      Math.min(100, Number(progressPercent || 0))
    );
    const showMetaIcon = !!metaKind;
    const hasMetaRow = locked
      ? !!metaLabel
      : !!metaLabel || !!secondaryMetaText;
    const hasMetric = !!metricValue || !!metricLabel;
    const hasProgressBar = !locked && !!progressLabel && safePercent > 0;
    const metricClassName = hasMetric
      ? "browse-card-metric"
      : "browse-card-metric is-empty";
    const progressClassName = hasProgressBar
      ? "browse-card-progress"
      : locked
        ? "browse-card-progress is-empty"
        : "browse-card-progress is-ghost";
    const progressFillPercent = hasProgressBar ? safePercent : 0;
    const progressText =
      progressLabel || `${hasProgressBar ? safePercent : 0}%`;
    const metaClassName = hasMetaRow
      ? "browse-card-meta"
      : "browse-card-meta is-empty";
    const trailingClassName = [
      "browse-card-trailing",
      hasMetric ? "" : "is-arrow-only",
      locked ? "has-hidden-action" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <div class="browse-card ${this.escapeHtml(toneClass || "tone-1")} ${locked ? "locked" : ""}">
        <div class="browse-card-inner browse-card-row">
          <div class="browse-card-badge browse-card-index">${this.escapeHtml(badge)}</div>
          <div class="browse-card-content browse-card-main">
            <div class="browse-card-topline">
              ${
                kickerLabel
                  ? `
                <span class="browse-card-num">${this.escapeHtml(kickerLabel)}</span>
              `
                  : ""
              }
              <div class="browse-status-badge ${this.escapeHtml(statusClass || "status-fresh")}">
                ${
                  locked
                    ? `
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                `
                    : ``
                }
                ${this.escapeHtml(statusLabel)}
              </div>
            </div>
            <div class="browse-card-name browse-card-title">${this.escapeHtml(title)}</div>
            <div class="${metaClassName}">
              ${
                metaLabel
                  ? `
                <span class="browse-meta-item ${showMetaIcon ? "" : "is-plain"}">
                  ${showMetaIcon ? this.getBrowseMetaIcon(metaKind) : ""}
                  ${this.escapeHtml(metaLabel)}
                </span>
              `
                  : ""
              }
              ${
                !locked && secondaryMetaText
                  ? `
                <span class="browse-meta-item is-plain">${this.escapeHtml(secondaryMetaText)}</span>
              `
                  : ""
              }
            </div>
            <div class="${progressClassName}" aria-hidden="true">
              <div class="browse-card-progress-track">
                <div class="browse-card-progress-fill" style="width:${progressFillPercent}%"></div>
              </div>
              <span class="browse-card-progress-percent">${this.escapeHtml(progressText)}</span>
            </div>
          </div>
          <div class="${trailingClassName}">
            <div class="${metricClassName}">
              ${
                metricLabel
                  ? `
                <div class="browse-card-metric-label">${this.escapeHtml(metricLabel)}</div>
              `
                  : ""
              }
              ${
                metricValue
                  ? `
                <div class="browse-card-metric-value">${this.escapeHtml(metricValue)}</div>
              `
                  : ""
              }
            </div>
            <div class="browse-card-chevron ${locked ? "is-hidden" : ""}">
              ${
                locked
                  ? ``
                  : `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 18l6-6-6-6"></path>
                </svg>
              `
              }
            </div>
          </div>
        </div>
      </div>
    `;
  },

  buildDashboardDisplayLevels() {
    const existingLevelsByName = Object.fromEntries(
      this.state.levelList.map((levelRecord) => [levelRecord.name, levelRecord])
    );
    const pastPaperLevelsByName = Object.fromEntries(
      (this.state.pastPapers?.years || []).map((row) => [
        row.yearLabel,
        {
          id: "",
          name: row.yearLabel,
          displayOrder: 0,
          locked: false,
          pastPaperOnly: !existingLevelsByName[row.yearLabel],
        },
      ])
    );
    const highestExistingYear = this.state.levelList.reduce(
      (maxYear, levelRecord) => {
        const levelNumber = Number(
          String(levelRecord.name).match(/\d+/)?.[0] || 0
        );
        return Math.max(maxYear, levelNumber);
      },
      0
    );
    const highestPastPaperYear = (this.state.pastPapers?.years || []).reduce(
      (maxYear, yearRecord) => {
        const levelNumber = Number(
          String(yearRecord.yearLabel).match(/\d+/)?.[0] || 0
        );
        return Math.max(maxYear, levelNumber);
      },
      0
    );
    const dashboardYearCount = Math.max(
      5,
      highestExistingYear,
      highestPastPaperYear,
      this.state.levelList.length || 0
    );

    return Array.from({ length: dashboardYearCount }, (_, index) => {
      const name = `Year ${index + 1}`;
      return (
        existingLevelsByName[name] ||
        pastPaperLevelsByName[name] || {
          id: "",
          name,
          displayOrder: index + 1,
          locked: true,
        }
      );
    });
  },

  getDefaultLevelProgressSummary(levelRecord) {
    return {
      doneCount: 0,
      totalCount: 0,
      courseCount: (this.state.areasByLevel[levelRecord?.name] || []).length,
      percent: 0,
    };
  },

  renderDashboardLevelCard(card, levelRecord, index, summaryOverride = null) {
    const level = levelRecord.name;
    const isLocked = !!levelRecord.locked;
    const pastPaperSummary = this.getPastPaperYearSummary?.(level);
    const levelSummary =
      summaryOverride || this.getDefaultLevelProgressSummary(levelRecord);
    const isComplete =
      !isLocked &&
      levelSummary.totalCount > 0 &&
      levelSummary.doneCount === levelSummary.totalCount;
    const levelNumber = String(level).match(/\d+/)?.[0] || String(index + 1);

    card.className = "browse-card-button";
    card.innerHTML = this.buildBrowseCardMarkup({
      badge: `Y${levelNumber}`,
      title: level,
      kickerLabel: "",
      toneClass: this.getBrowseToneClass(index),
      statusLabel: isLocked
        ? "Locked"
        : isComplete
          ? "Done"
          : levelSummary.doneCount
            ? "Active"
            : "New",
      statusClass: isLocked
        ? "status-locked"
        : isComplete
          ? "status-complete"
          : levelSummary.doneCount
            ? "status-active"
            : "status-fresh",
      metaKind: isLocked ? "" : "book",
      metaLabel: isLocked
        ? ""
        : pastPaperSummary && !levelSummary.courseCount
          ? `${pastPaperSummary.examCount} past paper${pastPaperSummary.examCount === 1 ? "" : "s"}`
          : `${levelSummary.courseCount} course${levelSummary.courseCount === 1 ? "" : "s"}`,
      progressPercent: isLocked ? 0 : levelSummary.percent,
      progressLabel: isLocked
        ? ""
        : levelSummary.doneCount
          ? `${levelSummary.doneCount}/${levelSummary.totalCount}`
          : "",
      secondaryMetaText: "",
      metricValue: isLocked
        ? "Soon"
        : levelSummary.doneCount
          ? `${levelSummary.doneCount}/${levelSummary.totalCount}`
          : "",
      metricLabel: isLocked
        ? "opens later"
        : levelSummary.doneCount
          ? "quizzes done"
          : "",
      locked: isLocked,
      lockedLabel: "Available soon",
    });

    card.onclick = isLocked
      ? null
      : () => this.navigate("year", { year: level });
  },

  renderAreaBrowseCard(card, level, areaRecord, index, summaryOverride = null) {
    const areaSummary = summaryOverride || {
      doneCount: 0,
      totalCount: 0,
      moduleCount: 0,
      percent: 0,
    };
    const isComplete =
      areaSummary.totalCount > 0 &&
      areaSummary.doneCount === areaSummary.totalCount;
    const initials = String(areaRecord.name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    card.className = "browse-card-button";
    card.innerHTML = this.buildBrowseCardMarkup({
      badge: initials || `C${index + 1}`,
      title: areaRecord.name,
      kickerLabel: "",
      toneClass: this.getBrowseToneClass(index),
      statusLabel: isComplete
        ? "Done"
        : areaSummary.doneCount
          ? "Active"
          : "New",
      statusClass: isComplete
        ? "status-complete"
        : areaSummary.doneCount
          ? "status-active"
          : "status-fresh",
      metaKind: areaSummary.moduleCount ? "chapter" : "",
      metaLabel: areaSummary.moduleCount
        ? `${areaSummary.moduleCount} chapter${areaSummary.moduleCount === 1 ? "" : "s"}`
        : "",
      progressPercent: areaSummary.percent,
      progressLabel: areaSummary.doneCount
        ? `${areaSummary.doneCount}/${areaSummary.totalCount}`
        : "",
      metricValue: areaSummary.doneCount
        ? `${areaSummary.doneCount}/${areaSummary.totalCount}`
        : "",
      metricLabel: areaSummary.doneCount ? "quizzes done" : "",
    });
    card.onclick = () =>
      this.navigate("subtopics", { level, area: areaRecord.name });
  },

  renderSubtopicBrowseCard(card, moduleRecord, index, progressOverride = null) {
    const progress = progressOverride || {
      doneCount: 0,
      totalCount: 0,
    };
    const initials = String(moduleRecord.name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
    const progressPercent = progress.totalCount
      ? Math.round((progress.doneCount / progress.totalCount) * 100)
      : 0;
    const isComplete =
      progress.doneCount === progress.totalCount && progress.totalCount;

    card.className = "browse-card-button";
    card.innerHTML = this.buildBrowseCardMarkup({
      badge: initials || `C${index + 1}`,
      title: moduleRecord.name,
      kickerLabel: "",
      toneClass: this.getBrowseToneClass(index),
      statusLabel: progress.doneCount
        ? isComplete
          ? "Done"
          : "Active"
        : "New",
      statusClass: progress.doneCount
        ? isComplete
          ? "status-complete"
          : "status-active"
        : "status-fresh",
      metaKind: "chapter",
      metaLabel: `${progress.totalCount} assessment${progress.totalCount === 1 ? "" : "s"}`,
      progressPercent,
      progressLabel: progress.doneCount ? `${progressPercent}% complete` : "",
      secondaryMetaText: "",
      metricValue:
        progress.doneCount && progress.totalCount
          ? `${progress.doneCount}/${progress.totalCount}`
          : "",
      metricLabel: progress.doneCount ? "done" : "",
    });
  },

  showToast(message) {
    this.dom.toast.textContent = message;
    this.dom.toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(
      () => this.dom.toast.classList.remove("show"),
      2200
    );
  },

  getStorageNamespace() {
    const userId = this.state.currentUser?.id || "anonymous";
    return `quiz-app:${userId}`;
  },

  getAssessmentProgressTimestamp(draft) {
    const timestamp = Date.parse(draft?.savedAt || draft?.updatedAt || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  },

  buildAssessmentProgressKey(settings = {}) {
    const context = settings.context || {};
    const mode =
      settings.mode === "exam" || context.mode === "exam" ? "exam" : "study";
    const durationMinutes = this.normalizeQuizDurationMinutes(
      settings.durationMinutes ?? context.durationMinutes
    );
    const negativeMarking = !!(
      settings.negativeMarking ?? context.negativeMarking
    );
    return [
      mode,
      durationMinutes ? `${durationMinutes}m` : "no-time",
      negativeMarking ? "negative" : "standard",
    ].join("|");
  },

  chooseNewestAssessmentDraft(localDraft, accountDraft) {
    if (!localDraft) return accountDraft || null;
    if (!accountDraft) return localDraft;
    return this.getAssessmentProgressTimestamp(accountDraft) >=
      this.getAssessmentProgressTimestamp(localDraft)
      ? accountDraft
      : localDraft;
  },

  normalizeAccountAssessmentProgress(row) {
    if (!row || typeof row !== "object") return null;
    const progressData =
      row.progress_data && typeof row.progress_data === "object"
        ? row.progress_data
        : {};
    const context =
      row.context && typeof row.context === "object" ? row.context : {};

    return {
      ...progressData,
      context: {
        ...context,
        mode: row.mode === "exam" ? "exam" : "study",
        durationMinutes: this.normalizeQuizDurationMinutes(
          row.duration_minutes
        ),
        negativeMarking: !!row.negative_marking,
      },
      durationMinutes: this.normalizeQuizDurationMinutes(row.duration_minutes),
      negativeMarking: !!row.negative_marking,
      progressKey: row.progress_key || "",
      timerExpiresAt: row.timer_expires_at || null,
      savedAt: row.updated_at || null,
    };
  },

  handleAssessmentProgressError(error) {
    if (this.isRpcUnavailable(error)) {
      if (!this.assessmentProgressUnavailable) {
        console.warn(
          "Account progress storage is unavailable; using the on-device fallback."
        );
      }
      this.assessmentProgressUnavailable = true;
      return;
    }
    console.error("Account progress sync failed:", error);
  },

  ensureAssessmentProgressState() {
    if (!this.assessmentProgressCache) this.assessmentProgressCache = {};
    if (!this.assessmentProgressLoadPromises) {
      this.assessmentProgressLoadPromises = {};
    }
    if (!this.assessmentProgressPendingWrites) {
      this.assessmentProgressPendingWrites = {};
    }
    if (!this.assessmentSettingsById) this.assessmentSettingsById = {};
  },

  rememberAssessmentSettings(assessmentKind, assessmentId, settings = {}) {
    this.ensureAssessmentProgressState();
    const key = JSON.stringify([
      String(assessmentKind || ""),
      String(assessmentId || ""),
    ]);
    this.assessmentSettingsById[key] = {
      durationMinutes: this.normalizeQuizDurationMinutes(
        settings.durationMinutes
      ),
      negativeMarking: !!settings.negativeMarking,
    };
    try {
      window.sessionStorage?.setItem(
        `${this.getStorageNamespace()}:assessment-settings:${encodeURIComponent(key)}`,
        JSON.stringify(this.assessmentSettingsById[key])
      );
    } catch {
      // In-memory settings remain available when browser storage is blocked.
    }
    return this.assessmentSettingsById[key];
  },

  getRememberedAssessmentSettings(assessmentKind, assessmentId) {
    this.ensureAssessmentProgressState();
    const key = JSON.stringify([
      String(assessmentKind || ""),
      String(assessmentId || ""),
    ]);
    if (this.assessmentSettingsById[key]) {
      return this.assessmentSettingsById[key];
    }
    try {
      const saved = window.sessionStorage?.getItem(
        `${this.getStorageNamespace()}:assessment-settings:${encodeURIComponent(key)}`
      );
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return this.rememberAssessmentSettings(
        assessmentKind,
        assessmentId,
        parsed
      );
    } catch {
      return null;
    }
  },

  getAssessmentProgressCacheKey(
    assessmentKind,
    assessmentId,
    progressKey = ""
  ) {
    return JSON.stringify([
      String(assessmentKind || ""),
      String(assessmentId || ""),
      String(progressKey || ""),
    ]);
  },

  getCachedAssessmentProgress(assessmentKind, assessmentId, progressKey = "") {
    this.ensureAssessmentProgressState();
    const key = this.getAssessmentProgressCacheKey(
      assessmentKind,
      assessmentId,
      progressKey
    );
    return Object.hasOwn(this.assessmentProgressCache, key)
      ? { hit: true, value: this.assessmentProgressCache[key] }
      : { hit: false, value: null };
  },

  cacheAssessmentProgress(assessmentKind, assessmentId, progressKey, progress) {
    this.ensureAssessmentProgressState();
    this.assessmentProgressCache[
      this.getAssessmentProgressCacheKey(
        assessmentKind,
        assessmentId,
        progressKey
      )
    ] = progress;
    const exactKey = progress?.progressKey || progress?.progress_key || "";
    if (exactKey) {
      this.assessmentProgressCache[
        this.getAssessmentProgressCacheKey(
          assessmentKind,
          assessmentId,
          exactKey
        )
      ] = progress;
    }
  },

  invalidateAssessmentProgressCache(assessmentKind, assessmentId) {
    this.ensureAssessmentProgressState();
    Object.keys(this.assessmentProgressCache).forEach((key) => {
      try {
        const [kind, id] = JSON.parse(key);
        if (
          kind === String(assessmentKind || "") &&
          id === String(assessmentId || "")
        ) {
          delete this.assessmentProgressCache[key];
        }
      } catch {
        delete this.assessmentProgressCache[key];
      }
    });
  },

  cancelPendingAssessmentProgressWrites(
    assessmentKind = null,
    assessmentId = null,
    progressKey = null
  ) {
    if (!this.assessmentProgressPendingWrites) return;
    Object.entries(this.assessmentProgressPendingWrites).forEach(
      ([key, pending]) => {
        let matches = assessmentKind === null;
        try {
          const [kind, id, savedProgressKey] = JSON.parse(key);
          matches =
            (assessmentKind === null || kind === String(assessmentKind)) &&
            (assessmentId === null || id === String(assessmentId)) &&
            (progressKey === null || savedProgressKey === String(progressKey));
        } catch {
          matches = assessmentKind === null;
        }
        if (!matches) return;
        if (pending?.timer) window.clearTimeout(pending.timer);
        pending?.resolvers?.splice(0).forEach((resolve) => resolve());
        delete this.assessmentProgressPendingWrites[key];
      }
    );
  },

  async loadAccountAssessmentProgress(
    assessmentKind,
    assessmentId,
    progressKey = ""
  ) {
    const userId = this.state.currentUser?.id;
    if (
      !userId ||
      !assessmentKind ||
      !assessmentId ||
      this.assessmentProgressUnavailable
    ) {
      return null;
    }

    const cached = this.getCachedAssessmentProgress(
      assessmentKind,
      assessmentId,
      progressKey
    );
    if (cached.hit) return cached.value;

    const requestKey = this.getAssessmentProgressCacheKey(
      assessmentKind,
      assessmentId,
      progressKey
    );
    if (this.assessmentProgressLoadPromises[requestKey]) {
      return this.assessmentProgressLoadPromises[requestKey];
    }

    const cacheAtStart = this.assessmentProgressCache;
    const request = (async () => {
      try {
        await this.assessmentProgressWriteQueue.catch(() => undefined);
        const { data, error } = await this.withTimeout(
          fetchAssessmentProgress(
            this.getSupabase(),
            userId,
            assessmentKind,
            assessmentId,
            progressKey
          ),
          8000,
          "Loading saved progress"
        );
        if (error) throw error;
        const normalized = this.normalizeAccountAssessmentProgress(data);
        if (this.assessmentProgressCache === cacheAtStart) {
          this.cacheAssessmentProgress(
            assessmentKind,
            assessmentId,
            progressKey,
            normalized
          );
        }
        return normalized;
      } catch (error) {
        this.handleAssessmentProgressError(error);
        return null;
      }
    })();

    this.assessmentProgressLoadPromises[requestKey] = request;
    try {
      return await request;
    } finally {
      if (this.assessmentProgressLoadPromises?.[requestKey] === request) {
        delete this.assessmentProgressLoadPromises[requestKey];
      }
    }
  },

  enqueueAssessmentProgressWrite(task) {
    const runTask = async () => {
      if (this.assessmentProgressUnavailable) return;
      try {
        await task();
      } catch (error) {
        this.handleAssessmentProgressError(error);
      }
    };
    this.assessmentProgressWriteQueue = this.assessmentProgressWriteQueue.then(
      runTask,
      runTask
    );
    return this.assessmentProgressWriteQueue;
  },

  saveAccountAssessmentProgress(assessmentKind, assessmentId, draft) {
    const userId = this.state.currentUser?.id;
    if (!userId || !assessmentKind || !assessmentId || !draft) {
      return Promise.resolve();
    }

    const context = draft.context || {};
    const durationMinutes = this.normalizeQuizDurationMinutes(
      draft.durationMinutes ?? context.durationMinutes
    );
    const payload = {
      mode: draft.mode === "exam" || context.mode === "exam" ? "exam" : "study",
      durationMinutes,
      negativeMarking: !!(draft.negativeMarking ?? context.negativeMarking),
      context,
      progressData: {
        answers:
          draft.answers && typeof draft.answers === "object"
            ? draft.answers
            : {},
        questionOrder: Array.isArray(draft.questionOrder)
          ? draft.questionOrder
          : [],
      },
      timerExpiresAt: draft.timerExpiresAt || null,
    };
    payload.progressKey = this.buildAssessmentProgressKey(payload);
    this.invalidateAssessmentProgressCache(assessmentKind, assessmentId);
    this.cacheAssessmentProgress(
      assessmentKind,
      assessmentId,
      payload.progressKey,
      { ...draft, progressKey: payload.progressKey }
    );

    this.ensureAssessmentProgressState();
    const writeKey = this.getAssessmentProgressCacheKey(
      assessmentKind,
      assessmentId,
      payload.progressKey
    );
    const pending = this.assessmentProgressPendingWrites[writeKey] || {
      resolvers: [],
      timer: null,
    };
    if (pending.timer) window.clearTimeout(pending.timer);
    pending.payload = payload;

    const completion = new Promise((resolve) => {
      pending.resolvers.push(resolve);
    });
    pending.timer = window.setTimeout(async () => {
      delete this.assessmentProgressPendingWrites[writeKey];
      await this.enqueueAssessmentProgressWrite(async () => {
        const { error } = await this.withTimeout(
          upsertAssessmentProgress(
            this.getSupabase(),
            userId,
            assessmentKind,
            assessmentId,
            pending.payload
          ),
          8000,
          "Saving progress"
        );
        if (error) throw error;
      });
      pending.resolvers.splice(0).forEach((resolve) => resolve());
    }, 400);
    this.assessmentProgressPendingWrites[writeKey] = pending;
    return completion;
  },

  clearAccountAssessmentProgress(assessmentKind, assessmentId, settings = {}) {
    const userId = this.state.currentUser?.id;
    if (!userId || !assessmentKind || !assessmentId) {
      return Promise.resolve();
    }
    const progressKey = this.buildAssessmentProgressKey(settings);
    this.invalidateAssessmentProgressCache(assessmentKind, assessmentId);
    this.ensureAssessmentProgressState();
    this.cancelPendingAssessmentProgressWrites(
      assessmentKind,
      assessmentId,
      progressKey
    );

    return this.enqueueAssessmentProgressWrite(async () => {
      const { error } = await this.withTimeout(
        deleteAssessmentProgress(
          this.getSupabase(),
          userId,
          assessmentKind,
          assessmentId,
          progressKey
        ),
        8000,
        "Clearing saved progress"
      );
      if (error) throw error;
    });
  },

  buildQuizContextKey({
    level,
    area,
    sub,
    type,
    title,
    mode,
    durationMinutes,
    negativeMarking,
  }) {
    const parts = [
      level || "",
      area || "",
      sub || "",
      type || "",
      title || "",
      mode || "study",
    ];
    if (mode === "exam") {
      parts.push(String(durationMinutes || ""));
    }
    parts.push(negativeMarking ? "negative" : "standard");
    return parts.join("|||");
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
      negativeMarking: this.state.negativeMarking,
    };
  },

  normalizeQuizDurationMinutes(value) {
    if (value === null || value === undefined || String(value).trim() === "") {
      return null;
    }
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(30, Math.max(5, parsed));
  },

  formatQuizTimer(totalSeconds) {
    const safeSeconds = Math.max(0, Number.parseInt(totalSeconds, 10) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  },

  async openQuizSettings(quiz) {
    const quizId = typeof quiz === "string" ? quiz : quiz?.id;
    if (!quizId || !(await this.ensureQuizContextFromId(quizId))) return;

    const quizMeta = this.getCurrentQuizMeta();
    const rememberedSettings = this.getRememberedAssessmentSettings(
      "quiz",
      quizId
    );
    const savedProgress = rememberedSettings
      ? null
      : await this.loadAccountAssessmentProgress("quiz", quizId);
    const settings = await quizSettingsDialog({
      title: this.state.currentQuizTitle || "Start quiz",
      submitLabel: "Start quiz",
      cancelLabel: "Cancel",
      min: 5,
      max: 30,
      initial:
        rememberedSettings?.durationMinutes ||
        savedProgress?.durationMinutes ||
        null,
      negativeMarking: !!(
        rememberedSettings?.negativeMarking ?? savedProgress?.negativeMarking
      ),
    });
    if (!settings || !quizMeta) return;

    const durationMinutes = this.normalizeQuizDurationMinutes(
      settings.durationMinutes
    );
    const negativeMarking = !!settings.negativeMarking;
    const mode = durationMinutes || negativeMarking ? "exam" : "study";
    this.rememberAssessmentSettings("quiz", quizId, {
      durationMinutes,
      negativeMarking,
    });

    await this.navigate("quiz", {
      quizId: quizMeta.id,
      mode,
      duration: durationMinutes || "",
      negativeMarking,
    });
  },

  stopQuizCountdown() {
    if (this.quizCountdownInterval) {
      window.clearInterval(this.quizCountdownInterval);
      this.quizCountdownInterval = null;
    }
    this.quizCountdownDeadline = 0;
  },

  updateQuizTimerUI() {
    const durationMinutes = this.normalizeQuizDurationMinutes(
      this.state.currentExamDurationMinutes
    );
    if (!durationMinutes) return;
    const fallbackSeconds = durationMinutes * 60;
    const remainingSeconds =
      Number.isFinite(this.state.quizTimeRemainingSeconds) &&
      this.state.quizTimeRemainingSeconds !== null
        ? this.state.quizTimeRemainingSeconds
        : fallbackSeconds;

    if (this.dom.quizProgressCopy) {
      this.dom.quizProgressCopy.textContent =
        this.formatQuizTimer(remainingSeconds);
    }
  },

  startQuizCountdown(savedDraft = null) {
    this.stopQuizCountdown();
    const durationMinutes = this.normalizeQuizDurationMinutes(
      this.state.currentExamDurationMinutes
    );
    if (!durationMinutes) return;
    this.state.currentExamDurationMinutes = durationMinutes;
    const savedDeadline = Date.parse(savedDraft?.timerExpiresAt || "");
    this.quizCountdownDeadline = Number.isFinite(savedDeadline)
      ? savedDeadline
      : Date.now() + durationMinutes * 60 * 1000;
    this.state.quizTimeRemainingSeconds = Math.max(
      0,
      Math.ceil((this.quizCountdownDeadline - Date.now()) / 1000)
    );
    this.updateQuizTimerUI();

    if (this.state.quizTimeRemainingSeconds <= 0) {
      window.setTimeout(() => {
        this.showToast("Time is up. Quiz submitted automatically.");
        void this.handleSubmission({ force: true, timedOut: true });
      }, 0);
      return;
    }

    this.quizCountdownInterval = window.setInterval(async () => {
      if (window.location.pathname !== "/quiz/") {
        this.stopQuizCountdown();
        return;
      }

      const nextRemaining = Math.max(
        0,
        Math.ceil((this.quizCountdownDeadline - Date.now()) / 1000)
      );
      this.state.quizTimeRemainingSeconds = nextRemaining;
      this.updateQuizTimerUI();

      if (nextRemaining > 0) return;

      this.stopQuizCountdown();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      this.showToast("Time is up. Quiz submitted automatically.");
      await this.handleSubmission({ force: true, timedOut: true });
    }, 250);
  },

  getQuizDraftStorageKey(context = this.getCurrentQuizContext()) {
    return `${this.getStorageNamespace()}:draft:${this.buildQuizContextKey(context)}`;
  },

  getQuizResultStorageKey(context = this.getCurrentQuizContext()) {
    return `${this.getStorageNamespace()}:result:${this.buildQuizContextKey(context)}`;
  },

  readStoredJson(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Storage read failed:", error);
      return null;
    }
  },

  writeStoredJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage write failed:", error);
    }
  },

  removeStoredJson(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error("Storage remove failed:", error);
    }
  },

  isQuizDraftForContext(draft, context = this.getCurrentQuizContext()) {
    if (!draft) return false;
    const savedContext = draft.context || {};
    return (
      (savedContext.mode === "exam" ? "exam" : "study") === context.mode &&
      this.normalizeQuizDurationMinutes(savedContext.durationMinutes) ===
        this.normalizeQuizDurationMinutes(context.durationMinutes) &&
      !!savedContext.negativeMarking === !!context.negativeMarking
    );
  },

  async loadQuizSessionPage(quizId) {
    const normalizedQuizId = String(quizId || "").trim();
    if (!normalizedQuizId) return null;

    const progressKey = this.buildAssessmentProgressKey({
      mode: this.state.mode,
      durationMinutes: this.state.currentExamDurationMinutes,
      negativeMarking: this.state.negativeMarking,
    });
    const cachedProgress = this.getCachedAssessmentProgress(
      "quiz",
      normalizedQuizId,
      progressKey
    );
    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_quiz_session", {
        p_quiz_id: normalizedQuizId,
        p_progress_key: cachedProgress.hit ? null : progressKey,
      }),
      12000,
      "Loading quiz"
    );
    if (error) throw error;
    if (
      !data ||
      Array.isArray(data) ||
      typeof data !== "object" ||
      Number(data.schemaVersion) !== 1 ||
      !Array.isArray(data.questions)
    ) {
      throw new Error("Quiz session returned an invalid response.");
    }

    const descriptor = this.applyQuizContextPayload(data);
    if (!descriptor || descriptor.quizId !== normalizedQuizId) return null;
    this.state.currentQuizId = descriptor.quizId;
    this.state.currentLevel = descriptor.level;
    this.state.currentArea = descriptor.area;
    this.state.currentSub = descriptor.sub;
    this.state.currentType = descriptor.type;
    this.state.currentQuizTitle = descriptor.title;
    this.rememberAssessmentSettings("quiz", normalizedQuizId, {
      durationMinutes: this.state.currentExamDurationMinutes,
      negativeMarking: this.state.negativeMarking,
    });

    const questions = this.normalizeQuizQuestionRows(
      data.questions,
      descriptor.type
    );
    this.state.questionsByQuizId[normalizedQuizId] = questions;

    let accountDraft = cachedProgress.value;
    if (!cachedProgress.hit) {
      accountDraft = this.normalizeAccountAssessmentProgress(data.progress);
      this.cacheAssessmentProgress(
        "quiz",
        normalizedQuizId,
        progressKey,
        accountDraft
      );
    }
    const context = this.getCurrentQuizContext();
    const localDraft = this.readStoredJson(
      this.getQuizDraftStorageKey(context)
    );
    const matchingLocal = this.isQuizDraftForContext(localDraft, context)
      ? localDraft
      : null;
    const matchingAccount = this.isQuizDraftForContext(accountDraft, context)
      ? accountDraft
      : null;
    const draft = this.chooseNewestAssessmentDraft(
      matchingLocal,
      matchingAccount
    );
    if (draft === matchingAccount && draft) {
      this.writeStoredJson(this.getQuizDraftStorageKey(context), draft);
    }

    return { descriptor, questions, draft };
  },

  saveQuizDraft(draft, context = this.getCurrentQuizContext()) {
    this.writeStoredJson(this.getQuizDraftStorageKey(context), draft);
    return this.saveAccountAssessmentProgress(
      "quiz",
      this.state.currentQuizId,
      draft
    );
  },

  clearQuizDraft(context = this.getCurrentQuizContext()) {
    this.removeStoredJson(this.getQuizDraftStorageKey(context));
    return this.clearAccountAssessmentProgress(
      "quiz",
      this.state.currentQuizId,
      { context }
    );
  },

  loadSavedQuizResult(context = this.getCurrentQuizContext()) {
    return this.readStoredJson(this.getQuizResultStorageKey(context));
  },

  saveQuizResultSnapshot(snapshot, context = this.getCurrentQuizContext()) {
    this.writeStoredJson(this.getQuizResultStorageKey(context), snapshot);
  },

  serializeQuizDraft() {
    const answers = {};
    this.state.activeQuestions.forEach((_, index) => {
      const selected = this.dom.quizForm.querySelector(
        `input[name="q${index}"]:checked`
      );
      if (selected) {
        answers[`q${index}`] = selected.value;
      }
    });

    const draft = {
      context: this.getCurrentQuizContext(),
      answers,
      durationMinutes: this.state.currentExamDurationMinutes,
      negativeMarking: this.state.negativeMarking,
      timerExpiresAt:
        this.state.currentExamDurationMinutes && this.quizCountdownDeadline
          ? new Date(this.quizCountdownDeadline).toISOString()
          : null,
      savedAt: new Date().toISOString(),
    };

    if (this.state.currentType === "tf" || this.state.currentType === "sba") {
      draft.questionOrder = this.state.activeQuestions
        .map((question) => question?.key)
        .filter(Boolean);
    }

    return draft;
  },

  persistCurrentQuizDraft() {
    if (!this.state.activeQuestions.length || !this.dom.quizForm) return;
    void this.saveQuizDraft(this.serializeQuizDraft());
  },

  restoreQuizDraftIntoForm(draft) {
    if (!draft?.answers) return false;

    let restoredCount = 0;
    Object.entries(draft.answers).forEach(([fieldName, value]) => {
      const input = this.dom.quizForm.querySelector(
        `input[name="${fieldName}"][value="${value}"]`
      );
      if (!input) return;
      input.checked = true;
      (
        input.closest("[data-quiz-choice]") || input.closest("label")
      )?.classList.add("selected");
      restoredCount += 1;
    });

    return restoredCount > 0;
  },

  countAnsweredQuestions() {
    if (!this.dom.quizForm || !this.state.activeQuestions.length) return 0;

    return this.state.activeQuestions.reduce((count, _, index) => {
      return this.dom.quizForm.querySelector(`input[name="q${index}"]:checked`)
        ? count + 1
        : count;
    }, 0);
  },

  updateQuizProgressUI() {
    const totalQuestions = Number(this.state.activeQuestions?.length || 0);
    const answeredQuestions = this.countAnsweredQuestions();
    const progressPercent = totalQuestions
      ? (answeredQuestions / totalQuestions) * 100
      : 0;

    if (this.dom.quizTotalCount) {
      this.dom.quizTotalCount.textContent = String(totalQuestions);
    }

    if (this.dom.quizAnsweredCount) {
      this.dom.quizAnsweredCount.textContent = String(answeredQuestions);
    }

    if (this.dom.quizProgressCopy) {
      this.dom.quizProgressCopy.textContent = this.state
        .currentExamDurationMinutes
        ? this.formatQuizTimer(
            Number.isFinite(this.state.quizTimeRemainingSeconds)
              ? this.state.quizTimeRemainingSeconds
              : this.normalizeQuizDurationMinutes(
                  this.state.currentExamDurationMinutes
                ) * 60
          )
        : totalQuestions
          ? `${answeredQuestions}/${totalQuestions} answered`
          : "0/0 answered";
    }

    if (this.dom.quizProgressCount) {
      this.dom.quizProgressCount.textContent = `${answeredQuestions} / ${totalQuestions}`;
    }

    if (this.dom.quizProgressFill) {
      this.dom.quizProgressFill.style.width = `${progressPercent}%`;
    }

    if (this.dom.quizSubmitBtn) {
      this.dom.quizSubmitBtn.disabled = !totalQuestions;
    }
  },

  renderResultsSnapshot(snapshot) {
    if (!snapshot) return false;
    this.state.currentResultsSnapshot = snapshot;

    const type = snapshot?.context?.type || this.state.currentType || "sba";
    const typeMeta = this.getTypeMeta(type);
    const quizIndex = this.getCurrentQuizIndex(type);
    const attemptStats = this.getAttemptStatsForQuizId(
      this.state.currentQuizId
    );
    const narrative = this.getResultsNarrative(snapshot);
    const attemptCount = Math.max(
      1,
      Number(snapshot?.attemptCount || attemptStats?.totalAttempts || 1)
    );
    const total = Math.max(0, Number(snapshot?.total || 0));
    const score = Number(snapshot?.score || 0);
    const percent = Math.max(0, Number(snapshot?.percent || 0));
    const percentTone = this.getResultsPercentageTone(percent);

    if (this.dom.resultsPageKicker) {
      this.dom.resultsPageKicker.textContent = `Assessment ${quizIndex} result`;
    }
    if (this.dom.resultsPageTitle) {
      this.dom.resultsPageTitle.textContent =
        this.state.currentQuizTitle || snapshot?.context?.title || "Assessment";
    }
    if (this.dom.resultsPageMeta) {
      this.dom.resultsPageMeta.textContent = [
        this.state.currentLevel || snapshot?.context?.level || "",
        this.state.currentArea || snapshot?.context?.area || "",
        this.state.currentSub || snapshot?.context?.sub || "",
        typeMeta.short,
        `${total} question${total === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" / ");
    }
    if (this.dom.resultsModeLabel) {
      this.dom.resultsModeLabel.textContent =
        this.formatQuizSettingsLabel(snapshot);
    }
    if (this.dom.finalScore) {
      this.dom.finalScore.innerHTML = `${score}<span class="results-score-denom">/${total}</span>`;
    }
    if (this.dom.resultsAttemptCount) {
      this.dom.resultsAttemptCount.textContent = String(attemptCount);
    }
    if (this.dom.countCorrect) {
      this.dom.countCorrect.textContent = String(snapshot.correct);
    }
    if (this.dom.countWrong) {
      this.dom.countWrong.textContent = String(snapshot.wrong);
    }
    if (this.dom.countUnanswered) {
      this.dom.countUnanswered.textContent = String(snapshot.unanswered);
    }
    if (this.dom.resultsSummaryHeadline) {
      this.dom.resultsSummaryHeadline.textContent = narrative.headline;
    }
    if (this.dom.resultsSummaryCopy) {
      this.dom.resultsSummaryCopy.textContent = narrative.copy;
    }
    if (this.dom.progressText) {
      this.dom.progressText.textContent = `${percent}%`;
      this.dom.progressText.className = `results-score-pct ${percentTone}`;
    }

    const segmentDefinitions = [
      {
        node: this.dom.resultsCorrectSegment,
        value: Number(snapshot?.correct || 0),
      },
      {
        node: this.dom.resultsWrongSegment,
        value: Number(snapshot?.wrong || 0),
      },
      {
        node: this.dom.resultsUnansweredSegment,
        value: Number(snapshot?.unanswered || 0),
      },
    ];

    segmentDefinitions.forEach(({ node, value }) => {
      if (!node) return;
      const shouldShow = total > 0 && value > 0;
      node.hidden = !shouldShow;
      node.style.width = "0%";
    });

    requestAnimationFrame(() => {
      segmentDefinitions.forEach(({ node, value }) => {
        if (!node) return;
        node.style.width =
          total > 0 && value > 0 ? `${(value / total) * 100}%` : "0%";
      });
    });

    this.renderStoredResultCards(snapshot);
    this.updateResultsStickySummary(snapshot);
    this.updateResultsReviewToggleButton();
    if (this.dom.resultsStickyBar) {
      this.dom.resultsStickyBar.classList.remove("is-hidden");
    }
    this.startResultsStickyObserver();
    const retryButton = document.getElementById("btn-retry-results");
    if (retryButton) {
      retryButton.textContent = "Retry Quiz";
    }
    return true;
  },

  parseLegacyResultCards(rawHtml = "") {
    if (!rawHtml) return [];

    const temp = document.createElement("div");
    temp.innerHTML = rawHtml;

    return [...temp.querySelectorAll(".result-card")].map((card, index) => {
      const question =
        card.querySelector(".review-stem, .result-question, .question-stem")
          ?.textContent || "";
      const userAnswer =
        card.querySelector(
          ".answer-chip.your .chip-val, .answer-chip.yours-wrong .chip-val, .answer-chip.yours-unsure .chip-val"
        )?.textContent || "Not sure";
      const correctAnswer =
        card.querySelector(".answer-chip.correct-ans .chip-val")?.textContent ||
        userAnswer;
      const explanation =
        card.querySelector(".explanation-text, .explanation p")?.textContent ||
        "";
      const statusClass = card.classList.contains("correct")
        ? "correct"
        : card.classList.contains("notsure") ||
            card.classList.contains("is-unsure") ||
            /unanswered|not sure/i.test(card.textContent || "")
          ? "notsure"
          : "incorrect";
      const simpleTfAnswers = [userAnswer, correctAnswer].every((value) =>
        ["true", "false", "not sure", "not sure / not answered"].includes(
          String(value).trim().toLowerCase()
        )
      );

      return {
        index,
        type: simpleTfAnswers ? "tf" : "sba",
        statusClass,
        statusText:
          statusClass === "correct"
            ? "Correct (+1)"
            : statusClass === "notsure"
              ? "Unanswered (0)"
              : "Incorrect (0)",
        question: question.trim(),
        imageHtml: "",
        userAnswer: userAnswer.trim(),
        correctAnswer: correctAnswer.trim(),
        explanation: explanation.trim(),
      };
    });
  },

  renderStoredResultCards(snapshot) {
    let results = Array.isArray(snapshot?.results) ? snapshot.results : null;
    const setReviewCountLabel = (count, isMissedOnly = false) => {
      if (!this.dom.resultsReviewCount) return;
      this.dom.resultsReviewCount.textContent = isMissedOnly
        ? `${count} missed`
        : `${count} question${count === 1 ? "" : "s"}`;
    };

    if (!results) {
      const legacyResults = this.parseLegacyResultCards(
        snapshot?.cardsHtml || ""
      );
      if (legacyResults.length) {
        results = legacyResults;
        snapshot.results = legacyResults;
        snapshot.cardsHtml = "";
      } else {
        this.dom.resultsContainer.innerHTML =
          this.buildResultsEmptyReviewMarkup();
        if (this.dom.resultsReviewCount) {
          this.dom.resultsReviewCount.textContent = "All clear";
        }
        this.updateResultsStickySummary(snapshot);
        return;
      }
    }

    const visibleResults = this.state.reviewWrongOnly
      ? results.filter(
          (item) =>
            item.statusClass === "incorrect" || item.statusClass === "notsure"
        )
      : results;

    if (!visibleResults.length) {
      this.dom.resultsContainer.innerHTML =
        this.buildResultsEmptyReviewMarkup();
      if (this.dom.resultsReviewCount) {
        this.dom.resultsReviewCount.textContent = "All clear";
      }
      this.updateResultsStickySummary(snapshot);
      return;
    }

    this.dom.resultsContainer.innerHTML = visibleResults
      .map((item) => this.buildResultReviewCardMarkup(item))
      .join("");
    setReviewCountLabel(visibleResults.length, this.state.reviewWrongOnly);
    this.updateResultsStickySummary(snapshot);
  },

  updateResultsReviewToggleButton() {
    if (!this.dom.toggleReviewWrongBtn) return;
    this.dom.toggleReviewWrongBtn.hidden = false;
    const actionText = this.state.reviewWrongOnly
      ? "Show All Questions"
      : "Review Missed Only";
    if (this.dom.resultsStickyAction) {
      this.dom.resultsStickyAction.textContent = actionText;
    }
    this.dom.toggleReviewWrongBtn.classList.toggle(
      "is-active",
      this.state.reviewWrongOnly
    );
    this.dom.toggleReviewWrongBtn.setAttribute(
      "aria-pressed",
      this.state.reviewWrongOnly ? "true" : "false"
    );
    this.updateResultsStickySummary(
      this.state.currentResultsSnapshot || this.loadSavedQuizResult()
    );
  },

  toggleResultsReviewFilter() {
    this.state.reviewWrongOnly = !this.state.reviewWrongOnly;
    const snapshot =
      this.state.currentResultsSnapshot || this.loadSavedQuizResult();

    if (!snapshot) {
      this.state.reviewWrongOnly = false;
      this.updateResultsReviewToggleButton();
      return;
    }

    this.state.currentResultsSnapshot = snapshot;
    this.renderStoredResultCards(snapshot);
    this.updateResultsReviewToggleButton();
  },

  async renderDashboard() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const displayName = this.getDisplayNameForUser(this.state.currentUser);
    const firstName =
      displayName.split(/\s+/).filter(Boolean)[0] || displayName;
    const greetingScale =
      firstName.length >= 16
        ? 0.72
        : firstName.length >= 13
          ? 0.8
          : firstName.length >= 11
            ? 0.88
            : firstName.length >= 9
              ? 0.94
              : 1;
    const displayLevels = this.buildDashboardDisplayLevels();

    const bootstrapStats = this.state.homeDashboard?.stats;
    const activeYears = bootstrapStats
      ? Number(bootstrapStats.activeYears || 0)
      : this.state.levelList.filter((levelRecord) => {
          const attemptsForLevel = (this.state.attempts || []).filter(
            (attempt) => {
              const descriptor = this.getQuizDescriptorById(attempt.quizId);
              return (
                (attempt.level || descriptor?.level || "") === levelRecord.name
              );
            }
          );
          return attemptsForLevel.length > 0;
        }).length;
    const completedCount = bootstrapStats
      ? Number(bootstrapStats.completedCount || 0)
      : Number(this.state.userStats?.quizzesDoneCount || 0);
    const averageScore = bootstrapStats
      ? Number(bootstrapStats.averageScore || 0)
      : Number(this.state.userStats?.averagePercentage || 0);

    if (this.dom.dashboardGreeting) {
      this.dom.dashboardGreeting.textContent = this.getTimeGreeting();
    }
    if (this.dom.dashboardGreetingName) {
      this.dom.dashboardGreetingName.textContent = `${firstName}.`;
    }
    if (this.dom.dashboardGreetingRow) {
      this.dom.dashboardGreetingRow.style.setProperty(
        "--dashboard-greeting-scale",
        String(greetingScale)
      );
    }
    if (this.dom.dashboardOverallRing) {
      this.dom.dashboardOverallRing.style.setProperty(
        "--dashboard-progress",
        `${averageScore}%`
      );
    }
    if (this.dom.dashboardOverallRingValue) {
      this.dom.dashboardOverallRingValue.textContent = `${averageScore}%`;
    }
    if (this.dom.dashboardActiveYears) {
      this.dom.dashboardActiveYears.textContent = String(activeYears);
    }
    if (this.dom.dashboardCompletedCount) {
      this.dom.dashboardCompletedCount.textContent = String(completedCount);
    }
    if (this.dom.dashboardAverageScore) {
      this.dom.dashboardAverageScore.textContent = `${averageScore}%`;
    }

    const dashboardSectionCount = document.getElementById(
      "dashboard-section-count"
    );
    if (dashboardSectionCount) {
      dashboardSectionCount.textContent = `${displayLevels.length} years total`;
    }

    const levelSummaries = displayLevels.map((levelRecord) => [
      levelRecord.name,
      levelRecord.locked
        ? this.getDefaultLevelProgressSummary(levelRecord)
        : this.state.homeDashboard?.levelProgressByName?.[levelRecord.name] ||
          this.getDefaultLevelProgressSummary(levelRecord),
    ]);
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    this.dom.areaGrid.innerHTML = "";
    const levelSummaryByName = Object.fromEntries(levelSummaries);
    displayLevels.forEach((levelRecord, index) => {
      const card = document.createElement("div");
      this.renderDashboardLevelCard(
        card,
        levelRecord,
        index,
        levelSummaryByName[levelRecord.name]
      );
      this.dom.areaGrid.appendChild(card);
    });

    this.showOnly("dashboard-view");
  },

  async renderModules() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const level = this.state.currentLevel;
    if (!level) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    const cacheKey = this.getScopedRouteDataKey(level);
    if (!this.state.routeData?.coursesByLevel?.[cacheKey]) {
      this.showLoadingView();
    }

    let page;
    try {
      page = await this.loadBrowseCourses(level);
    } catch (error) {
      console.error("Course page load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(error?.message || "Could not load courses.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    const areaRecords = page.courses;

    document.getElementById("module-page-title").textContent = level;
    document.getElementById("modules-page-kicker").textContent = level;
    document.getElementById("module-page-subtitle").textContent = "";
    document.getElementById("modules-section-count").textContent =
      `${areaRecords.length} total`;
    this.dom.moduleGrid.innerHTML = "";

    areaRecords.forEach((areaRecord, index) => {
      const card = document.createElement("div");
      this.renderAreaBrowseCard(
        card,
        level,
        areaRecord,
        index,
        areaRecord.summary
      );
      this.dom.moduleGrid.appendChild(card);
    });

    this.showOnly("modules-view");
  },

  async renderSubtopics() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const { currentLevel, currentArea } = this.state;
    if (!currentLevel || !currentArea) {
      await this.navigate(
        currentLevel ? "modules" : "home",
        currentLevel ? { level: currentLevel } : {},
        { replace: true }
      );
      return;
    }

    const cacheKey = this.getScopedRouteDataKey(currentLevel, currentArea);
    if (!this.state.routeData?.subtopicsByCourse?.[cacheKey]) {
      this.showLoadingView();
    }

    let page;
    try {
      page = await this.loadBrowseSubtopics(currentLevel, currentArea);
    } catch (error) {
      console.error("Subtopic page load failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showFatalLoadError(error?.message || "Could not load subtopics.");
      return;
    }

    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    const modules = page.subtopics;

    document.getElementById("subtopics-page-title").textContent = currentArea;
    document.getElementById("subtopics-page-kicker").textContent = currentLevel;
    document.getElementById("subtopics-page-subtitle").textContent = "";
    document.getElementById("subtopics-section-count").textContent =
      `${modules.length} total`;
    this.dom.subtopicsGrid.innerHTML = "";

    modules.forEach((moduleRecord, index) => {
      const card = document.createElement("div");
      this.renderSubtopicBrowseCard(
        card,
        moduleRecord,
        index,
        moduleRecord.summary
      );
      card.onclick = () =>
        this.navigate("types", {
          level: currentLevel,
          area: currentArea,
          sub: moduleRecord.name,
        });
      this.dom.subtopicsGrid.appendChild(card);
    });

    this.showOnly("subtopics-view");
  },

  async renderTypes() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const { currentLevel, currentArea, currentSub } = this.state;
    if (!currentLevel || !currentArea || !currentSub) {
      await this.navigate(
        currentLevel && currentArea ? "subtopics" : "home",
        currentLevel && currentArea
          ? { level: currentLevel, area: currentArea }
          : {},
        { replace: true }
      );
      return;
    }

    const cacheKey = this.getScopedRouteDataKey(
      currentLevel,
      currentArea,
      currentSub
    );
    if (!this.state.routeData?.typesBySubtopic?.[cacheKey]) {
      this.showLoadingView();
    }

    let page;
    try {
      page = await this.loadBrowseTypes(currentLevel, currentArea, currentSub);
    } catch (error) {
      console.error("Quiz type summary load failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showFatalLoadError(error?.message || "Could not load quiz types.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    const formatCards = page.types;
    const totalQuestions = page.totalQuestions;
    const overallCompletePercent = page.percent;

    document.getElementById("types-page-title").textContent = currentSub;
    if (this.dom.typesPageKicker) {
      this.dom.typesPageKicker.textContent = "Question formats";
    }
    if (this.dom.typesTotalQuestions) {
      this.dom.typesTotalQuestions.textContent = String(totalQuestions);
    }
    if (this.dom.typesFormatCount) {
      this.dom.typesFormatCount.textContent = String(formatCards.length);
    }
    if (this.dom.typesCompletePercent) {
      this.dom.typesCompletePercent.textContent = `${overallCompletePercent}%`;
      this.dom.typesCompletePercent.classList.toggle(
        "muted",
        overallCompletePercent === 0
      );
    }
    this.dom.typesGrid.innerHTML = "";

    formatCards.forEach(
      ({ type, quizCount, questionCount, completedCount }) => {
        const isLocked = quizCount === 0;
        const isComplete = !!quizCount && completedCount === quizCount;
        const statusText = isLocked
          ? "Unavailable"
          : isComplete
            ? "Complete"
            : completedCount
              ? "In Progress"
              : "Not Started";
        const displayTitle =
          type === "sba" ? "Single Best Answer" : "True / False";
        const visualMarkup =
          type === "sba"
            ? `
          <div class="selection-visual selection-visual-sba" aria-hidden="true">
            ${["A", "B", "C", "D", "E"]
              .map(
                (letter, index) => `
              <span class="selection-visual-pill ${index === 2 ? "is-active" : ""}">${letter}</span>
            `
              )
              .join("")}
          </div>
        `
            : `
          <div class="selection-visual selection-visual-tf" aria-hidden="true">
            <div class="selection-visual-choice is-active">
              <span>True</span>
              <svg viewBox="0 0 24 24">
                <path d="m20 6-11 11-5-5"></path>
              </svg>
            </div>
            <div class="selection-visual-choice">
              <span>False</span>
              <span class="selection-visual-radio"></span>
            </div>
          </div>
        `;
        const card = document.createElement(isLocked ? "article" : "button");
        if (card instanceof HTMLButtonElement) {
          card.type = "button";
        }
        card.className = `selection-card type-${type} ${isLocked ? "locked" : "available"} ${isComplete ? "is-complete" : completedCount ? "is-progress" : "is-fresh"}`;
        if (!isLocked) {
          card.setAttribute("aria-label", `Open ${displayTitle} assessments`);
        }
        card.innerHTML = `
        <div class="selection-card-copy">
          <div class="selection-card-head">
            <span class="selection-card-status ${isLocked ? "is-locked" : isComplete ? "is-complete" : completedCount ? "is-progress" : "is-fresh"}">${this.escapeHtml(statusText)}</span>
          </div>
          <div class="selection-card-name">${this.escapeHtml(displayTitle)}</div>
        </div>
        <div class="selection-card-visual-wrap">
          ${visualMarkup}
        </div>
        <div class="selection-card-footer">
          <div class="selection-card-meta">
            <span>${quizCount} ${quizCount === 1 ? "Assessment" : "Assessments"}</span>
            <span class="selection-card-meta-separator" aria-hidden="true">—</span>
            <span class="selection-card-meta-dot" aria-hidden="true"></span>
            <span>${questionCount} Questions</span>
          </div>
          <span class="selection-card-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 12h14"></path>
              <path d="M12 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>
      `;
        if (!isLocked) {
          card.onclick = () =>
            this.navigate("quizzes", {
              level: currentLevel,
              area: currentArea,
              sub: currentSub,
              type,
            });
        }
        this.dom.typesGrid.appendChild(card);
      }
    );

    this.showOnly("types-view");
  },

  async renderQuizList() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const { currentLevel, currentArea, currentSub, currentType } = this.state;
    if (
      !currentLevel ||
      !currentArea ||
      !currentSub ||
      !["sba", "tf"].includes(currentType)
    ) {
      await this.navigate(
        currentLevel && currentArea && currentSub ? "types" : "home",
        currentLevel && currentArea && currentSub
          ? { level: currentLevel, area: currentArea, sub: currentSub }
          : {},
        { replace: true }
      );
      return;
    }

    const cacheKey = this.getScopedRouteDataKey(
      currentLevel,
      currentArea,
      currentSub,
      currentType
    );
    if (!this.state.routeData?.quizzesByType?.[cacheKey]) {
      this.showLoadingView();
    }

    let page;
    try {
      page = await this.loadBrowseQuizzes(
        currentLevel,
        currentArea,
        currentSub,
        currentType
      );
    } catch (error) {
      console.error("Quiz list load failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showFatalLoadError(error?.message || "Could not load quizzes.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    const meta = this.getTypeMeta(currentType);
    const typePresentation = this.getTypePresentation(currentType);
    const quizzes = page.quizzes;
    const topicIndex = page.topicIndex;
    const completedCount = page.summary.completedCount;
    const averagePercentage = page.summary.averageBestPercentage;

    if (this.dom.quizListView) {
      this.dom.quizListView.classList.remove("type-sba", "type-tf");
      this.dom.quizListView.classList.add(`type-${currentType}`);
    }
    if (this.dom.quizListKicker) {
      this.dom.quizListKicker.textContent = `Topic ${topicIndex}`;
    }
    document.getElementById("quiz-list-title").textContent = currentSub;
    if (this.dom.quizListSubtitle) {
      this.dom.quizListSubtitle.textContent = "";
    }
    if (this.dom.quizListAssessmentCount) {
      this.dom.quizListAssessmentCount.textContent = String(quizzes.length);
    }
    if (this.dom.quizListCompletedCount) {
      this.dom.quizListCompletedCount.textContent = String(completedCount);
      this.dom.quizListCompletedCount.classList.toggle(
        "good",
        completedCount > 0
      );
    }
    if (this.dom.quizListAverageScore) {
      this.dom.quizListAverageScore.textContent =
        averagePercentage === null ? "--" : `${averagePercentage}%`;
      this.dom.quizListAverageScore.classList.toggle(
        "good",
        averagePercentage !== null
      );
    }
    if (this.dom.quizListModeBadge) {
      this.dom.quizListModeBadge.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <path d="M13 2v7h7"></path>
        </svg>
        <span>${this.escapeHtml(typePresentation.listDescription)}</span>
      `;
    }
    if (this.dom.quizListModeDescription) {
      this.dom.quizListModeDescription.textContent = "";
    }
    if (this.dom.quizListSectionCount) {
      this.dom.quizListSectionCount.textContent = `${quizzes.length} total`;
    }
    this.dom.quizList.innerHTML = "";

    if (!quizzes.length) {
      this.dom.quizList.innerHTML = `
        <div class="quizlist-empty-card">
          <span class="quizlist-empty-kicker">${this.escapeHtml(meta.label)}</span>
          <h3>No assessments yet</h3>
          <p>No ${this.escapeHtml(meta.label.toLowerCase())} quizzes are available for this topic yet.</p>
        </div>
      `;
      this.showOnly("quiz-list-view");
      return;
    }

    quizzes.forEach((quizMeta, index) => {
      const isDone = quizMeta.totalAttempts > 0;
      const totalAttempts = quizMeta.totalAttempts;
      const questionCount = Number(quizMeta.count || 0);
      const percentage = Number(quizMeta.bestPercentage || 0);
      const statusLabel = isDone ? "Done" : "Ready";
      const detailLabel = isDone
        ? `${totalAttempts} attempt${totalAttempts === 1 ? "" : "s"}`
        : "";
      const row = document.createElement("button");
      row.type = "button";
      row.className = `quizlist-card ${isDone ? "done" : "fresh"}`;
      row.setAttribute(
        "aria-label",
        `Open assessment ${index + 1}: ${quizMeta.title}`
      );
      row.innerHTML = `
        <div class="quizlist-card-row">
          <span class="quizlist-card-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <div class="quizlist-card-main">
            <div class="quizlist-card-topline">
              <span class="quizlist-state-badge ${isDone ? "is-done" : "is-ready"}">${statusLabel}</span>
            </div>
            <div class="quizlist-card-title">${this.escapeHtml(quizMeta.title)}</div>
            <div class="quizlist-card-meta">
              <span class="quizlist-card-question-count">${questionCount} question${questionCount === 1 ? "" : "s"}</span>
              ${
                detailLabel
                  ? `
                <span class="quizlist-card-attempts">${this.escapeHtml(detailLabel)}</span>
              `
                  : ""
              }
            </div>
          </div>
          <div class="quizlist-card-trailing">
            ${
              isDone
                ? `
              <div class="quizlist-card-metric">
                <div class="quizlist-card-metric-label">best</div>
                <div class="quizlist-card-metric-value">${this.escapeHtml(`${percentage}%`)}</div>
              </div>
            `
                : ""
            }
            <span class="quizlist-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6"></path>
              </svg>
            </span>
          </div>
        </div>
      `;
      row.onclick = () => void this.openQuizSettings(quizMeta);
      this.dom.quizList.appendChild(row);
    });

    this.showOnly("quiz-list-view");
  },

  async renderQuiz() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    this.showLoadingView();
    this.stopQuizCountdown();
    let session;
    try {
      const prefetchedSession = this.consumeInitialRoutePrefetch("quiz");
      session = await (prefetchedSession ||
        this.loadQuizSessionPage(this.state.currentQuizId));
    } catch (error) {
      console.error("Quiz session load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(error?.message || "Could not load this quiz.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }
    if (!session) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    const { descriptor } = session;
    this.state.currentQuizId = descriptor.quizId;
    this.state.currentLevel = descriptor.level;
    this.state.currentArea = descriptor.area;
    this.state.currentSub = descriptor.sub;
    this.state.currentType = descriptor.type;
    this.state.currentQuizTitle = descriptor.title;
    const baseQuestions = session.questions;
    const savedDraft = session.draft;
    const questions = this.getQuizSessionQuestions(baseQuestions, savedDraft);
    const restoreDraft = savedDraft;

    if (!questions.length) {
      this.navigate("quizzes", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
      });
      return;
    }

    this.state.activeQuestions = questions;
    this.showOnly("quiz-view");

    const typeMeta = this.getTypeMeta(this.state.currentType);
    const timerText = this.state.currentExamDurationMinutes
      ? `${this.state.currentExamDurationMinutes} min`
      : "No time";
    const markingText = this.state.negativeMarking
      ? "Negative marking"
      : "Standard marking";
    const quizIndex = this.getCurrentQuizIndex();
    const quizView = document.getElementById("quiz-view");
    if (quizView) {
      quizView.dataset.type = this.state.currentType;
      quizView.dataset.mode = this.state.mode;
      quizView.dataset.negativeMarking = this.state.negativeMarking
        ? "true"
        : "false";
    }

    document.getElementById("quiz-mode-badge").textContent =
      `${typeMeta.label.toUpperCase()} \u00b7 ${timerText.toUpperCase()}`;
    if (this.dom.quizPageKicker) {
      this.dom.quizPageKicker.textContent = `ASSESSMENT ${quizIndex}`;
    }
    document.getElementById("quiz-page-title").textContent =
      this.state.currentQuizTitle;
    document.getElementById("quiz-page-meta").innerHTML =
      `<span>${this.escapeHtml(this.state.currentLevel)}</span> &middot; ${this.escapeHtml(this.state.currentArea)} &middot; ${this.escapeHtml(this.state.currentSub)}`;
    if (this.dom.quizModeStat) {
      this.dom.quizModeStat.textContent = timerText;
    }

    const tfChoices = [
      {
        className: "opt-true",
        value: "TRUE",
        label: "True",
        icon: `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.5 12.5l3.2 3.2L17.5 8"></path>
          </svg>
        `,
      },
      {
        className: "opt-false",
        value: "FALSE",
        label: "False",
        icon: `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 8l8 8"></path>
            <path d="M16 8l-8 8"></path>
          </svg>
        `,
      },
      {
        className: "opt-not-sure",
        value: "NS",
        label: "Not sure",
        icon: `<span class="tf-icon-mark" aria-hidden="true">?</span>`,
      },
    ];

    this.dom.quizForm.innerHTML = questions
      .map((item, index) => {
        const imageHtml = item.img
          ? `
            <div class="question-image-wrap">
              <img class="question-image" src="${this.escapeHtml(item.img)}" alt="Question image ${index + 1}">
            </div>
          `
          : "";
        const optionsHtml =
          item.type === "tf"
            ? `
              <div class="tf-options">
                ${tfChoices
                  .map(
                    (choice) => `
                      <label class="quiz-choice tf-btn ${choice.className}" data-quiz-choice>
                        <input class="quiz-choice-input" type="radio" name="q${index}" value="${choice.value}">
                        <span class="tf-icon">
                          ${choice.icon}
                        </span>
                        <span class="tf-label">${choice.label}</span>
                      </label>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="options-list">
                ${(item.options || [])
                  .map((optionText, optionIndex) => {
                    const optionLetter = String.fromCharCode(65 + optionIndex);
                    return `
                      <label class="quiz-choice option-item" data-quiz-choice>
                        <input class="quiz-choice-input" type="radio" name="q${index}" value="${optionLetter}">
                        <span class="option-radio" aria-hidden="true">
                          <span class="option-radio-dot"></span>
                        </span>
                        <span class="option-letter">${optionLetter}</span>
                        <span class="option-text">${this.escapeHtml(optionText)}</span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
            `;

        return `
          <article class="question-card question-card-${item.type}">
            <div class="question-meta">
              <span class="q-number">QUESTION ${index + 1}</span>
              <span class="q-type-badge">${markingText.toUpperCase()}</span>
            </div>
            <p class="question-stem">${this.escapeHtml(item.q)}</p>
            ${imageHtml}
            ${optionsHtml}
          </article>
        `;
      })
      .join("");

    this.dom.quizForm.onchange = (event) => {
      const input = event.target.closest?.('input[type="radio"]');
      if (!input) return;
      this.dom.quizForm
        .querySelectorAll(`input[name="${input.name}"]`)
        .forEach((radio) => {
          (
            radio.closest("[data-quiz-choice]") || radio.closest("label")
          )?.classList.remove("selected");
        });
      (
        input.closest("[data-quiz-choice]") || input.closest("label")
      )?.classList.add("selected");
      this.persistCurrentQuizDraft();
      this.updateQuizProgressUI();
    };

    if (this.restoreQuizDraftIntoForm(restoreDraft)) {
      this.showToast("Restored your saved quiz progress.");
    }
    this.updateQuizProgressUI();
    this.startQuizCountdown(restoreDraft);
    this.writeStoredJson(
      this.getQuizDraftStorageKey(),
      this.serializeQuizDraft()
    );
  },

  renderResults() {
    this.stopResultsStickyObserver?.();
    this.showOnly("results-view");
    const resultsView = document.getElementById("results-view");
    if (resultsView) {
      resultsView.dataset.type = this.state.currentType || "sba";
      resultsView.dataset.mode = this.state.mode || "study";
      resultsView.dataset.negativeMarking = this.state.negativeMarking
        ? "true"
        : "false";
    }
    if (this.dom.toggleReviewWrongBtn) {
      this.dom.toggleReviewWrongBtn.hidden = true;
    }
    const restored = this.renderResultsSnapshot(this.loadSavedQuizResult());
    if (!restored) {
      this.state.currentResultsSnapshot = null;
      this.navigate("quizzes", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
      });
      return;
    }
  },

  getResultsPercentageTone(percent) {
    if (percent >= 75) return "good";
    if (percent >= 50) return "mid";
    return "poor";
  },

  getResultsMissedCount(snapshot) {
    return Math.max(
      0,
      Number(snapshot?.wrong || 0) + Number(snapshot?.unanswered || 0)
    );
  },

  stopResultsStickyObserver() {
    if (this.resultsStickyObserver) {
      this.resultsStickyObserver.disconnect();
      this.resultsStickyObserver = null;
    }
  },

  startResultsStickyObserver() {
    this.stopResultsStickyObserver();
    if (!this.dom.resultsStickyBar || !this.dom.resultsBottomActions) return;

    this.resultsStickyObserver = new IntersectionObserver(
      ([entry]) => {
        this.dom.resultsStickyBar?.classList.toggle(
          "is-hidden",
          !!entry?.isIntersecting
        );
      },
      { threshold: 0.1 }
    );

    this.resultsStickyObserver.observe(this.dom.resultsBottomActions);
  },

  updateResultsStickySummary(snapshot) {
    if (!this.dom.resultsStickyLabel) return;
    const missedCount = this.getResultsMissedCount(snapshot);
    const actionText = this.state.reviewWrongOnly
      ? "Show All Questions"
      : "Review Missed Only";
    this.dom.resultsStickyLabel.textContent = `${missedCount} missed`;
    if (this.dom.toggleReviewWrongBtn) {
      this.dom.toggleReviewWrongBtn.setAttribute(
        "aria-label",
        `${missedCount} missed. ${actionText}.`
      );
    }
  },

  getResultsNarrative(snapshot) {
    const percent = Number(snapshot?.percent || 0);
    const total = Number(snapshot?.total || 0);
    const missed =
      Number(snapshot?.wrong || 0) + Number(snapshot?.unanswered || 0);
    const missedLabel = missed === 1 ? "1 question" : `${missed} questions`;

    if (percent >= 100) {
      return {
        headline: "Beautiful work.",
        copy: "Every answer landed cleanly. Carry that rhythm into the next assessment.",
      };
    }

    if (percent >= 85) {
      return {
        headline: "Strong finish.",
        copy: missed
          ? `Only ${missedLabel} need another look. A short review below should lock this in.`
          : "A sharp performance worth carrying forward while the details are still fresh.",
      };
    }

    if (percent >= 60) {
      return {
        headline: "A solid foundation.",
        copy: missed
          ? `Review the ${missedLabel} that slipped, then take another calm run at it.`
          : `A steady round across ${total} questions. One more pass should tighten it further.`,
      };
    }

    return {
      headline: "Room to sharpen.",
      copy:
        (snapshot?.negativeMarking ??
        snapshot?.context?.negativeMarking ??
        snapshot?.mode === "exam")
          ? "Negative marking bit here. Review the explanations carefully, then try again with a steadier pace."
          : "Use the explanations below as your next lift, then retry while the material is still warm.",
    };
  },

  buildResultsEmptyReviewMarkup() {
    return `
      <article class="result-card correct review-card is-correct result-card-empty">
        <div class="review-card-inner">
          <div class="review-top">
            <span class="review-q-num">REVIEW</span>
            <span class="verdict-badge correct">CORRECT (+1)</span>
          </div>
          <p class="review-stem">Nothing missed in this attempt.</p>
          <div class="explanation result-explanation" data-open="false">
            <button class="result-explanation-toggle" type="button" aria-expanded="false">
              <span class="result-explanation-toggle-text">VIEW EXPLANATION</span>
              <span class="result-explanation-chevron" aria-hidden="true"></span>
            </button>
            <div class="result-explanation-panel" aria-hidden="true">
              <div class="result-explanation-inner">
                <p class="explanation-text">You do not have any wrong or unanswered questions to review here. Move on, or retry for another clean run.</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  },

  buildResultReviewCardMarkup(item) {
    const isTfResult =
      item.type === "tf" ||
      [item.userAnswer, item.correctAnswer]
        .filter(Boolean)
        .every((value) =>
          ["true", "false", "not sure / not answered"].includes(
            String(value).trim().toLowerCase()
          )
        );
    const answerGridTypeClass = isTfResult
      ? "tf-answer-grid"
      : "sba-answer-grid";
    const verdictClass =
      item.statusClass === "correct"
        ? "correct"
        : item.statusClass === "notsure"
          ? "unsure"
          : "wrong";
    const cardClass =
      item.statusClass === "correct"
        ? "is-correct"
        : item.statusClass === "notsure"
          ? "is-unsure"
          : "is-wrong";
    const isCorrect = item.statusClass === "correct";
    const isUnanswered = item.statusClass === "notsure";
    const badgeText = isCorrect
      ? "CORRECT (+1)"
      : isUnanswered
        ? "UNANSWERED (0)"
        : String(item.statusText || "").includes("-1")
          ? "INCORRECT (-1)"
          : "INCORRECT (0)";
    const answerGrid = isCorrect
      ? `
          <div class="answer-grid single ${answerGridTypeClass}">
            <div class="answer-chip your">
              <span class="chip-label">YOUR ANSWER</span>
              <span class="chip-val">${this.escapeHtml(item.userAnswer)}</span>
            </div>
          </div>
        `
      : `
          <div class="answer-grid ${answerGridTypeClass}">
            <div class="answer-chip ${item.statusClass === "notsure" ? "yours-unsure" : "yours-wrong"}">
              <span class="chip-label">YOUR ANSWER</span>
              <span class="chip-val">${this.escapeHtml(item.userAnswer)}</span>
            </div>
            <div class="answer-chip correct-ans">
              <span class="chip-label">CORRECT ANSWER</span>
              <span class="chip-val">${this.escapeHtml(item.correctAnswer)}</span>
            </div>
          </div>
        `;

    return `
      <article class="result-card ${item.statusClass} review-card ${cardClass}">
        <div class="review-card-inner">
          <div class="review-top">
            <span class="review-q-num">QUESTION ${item.index + 1}</span>
            <span class="verdict-badge ${verdictClass}">${badgeText}</span>
          </div>
          <p class="review-stem">${this.escapeHtml(item.question)}</p>
          ${item.imageHtml || ""}
          ${answerGrid}
          <div class="explanation result-explanation" data-open="false">
            <button class="result-explanation-toggle" type="button" aria-expanded="false">
              <span class="result-explanation-toggle-text">VIEW EXPLANATION</span>
              <span class="result-explanation-chevron" aria-hidden="true"></span>
            </button>
            <div class="result-explanation-panel" aria-hidden="true">
              <div class="result-explanation-inner">
                <p class="explanation-text">${this.escapeHtml(item.explanation || "No explanation provided.")}</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  },

  formatCorrectAnswer(item) {
    if (item.type === "tf") return item.a === "TRUE" ? "True" : "False";
    if (item.type === "sba" && item.options && item.a) {
      const correctIndex = item.a.charCodeAt(0) - 65;
      if (correctIndex >= 0 && item.options[correctIndex]) {
        return `(${item.a}) ${item.options[correctIndex]}`;
      }
    }
    return item.a;
  },

  formatUserAnswer(item, userAns) {
    if (userAns === "NS") return "Not sure";
    if (item.type === "tf")
      return userAns === "TRUE"
        ? "True"
        : userAns === "FALSE"
          ? "False"
          : userAns;
    if (item.type === "sba" && item.options) {
      const chosenIndex = userAns.charCodeAt(0) - 65;
      if (chosenIndex >= 0 && item.options[chosenIndex]) {
        return `(${userAns}) ${item.options[chosenIndex]}`;
      }
    }
    return userAns;
  },

  async renderAccountView() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    if (
      !this.dom.accountPageTitle ||
      !this.dom.accountPageSubtitle ||
      !this.dom.accountEmptyState ||
      !this.dom.accountContent
    ) {
      this.showFatalLoadError(
        "Account view is missing required page elements."
      );
      return;
    }

    const accountCache = this.state.routeData?.accountByKey?.["first-page"];
    if (!accountCache) this.showLoadingView();

    let stats;
    try {
      stats = await this.loadAccountPage();
    } catch (error) {
      console.error("Account page load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(error?.message || "Could not load your account.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    this.showOnly("account-view");
    const displayName = this.getDisplayNameForUser(this.state.currentUser);
    this.dom.accountPageTitle.textContent = `${displayName}'s Account`;
    this.dom.accountPageSubtitle.textContent =
      "Normal quiz and Past Paper performance, together and side by side";

    const hasAttempts = !!stats?.attemptsCount;
    this.dom.accountEmptyState.hidden = hasAttempts;
    this.dom.accountContent.hidden = !hasAttempts;

    if (!hasAttempts) {
      this.dom.accountOverviewGrid.innerHTML = "";
      this.dom.accountModeGrid.innerHTML = "";
      this.dom.accountCourseGrid.innerHTML = "";
      this.dom.accountRecentList.innerHTML = "";
      return;
    }

    this.dom.accountOverviewGrid.innerHTML = [
      {
        label: "Assessments Done",
        value: String(stats.quizzesDoneCount),
        note: `${stats.attemptsCount} total attempts recorded`,
      },
      {
        label: "Combined Average",
        value: `${stats.averagePercentage}%`,
        note: "Attempt-weighted across normal quizzes and exams",
      },
      {
        label: "Best Score",
        value: this.formatAttemptScore(stats.bestAttempt),
        note: stats.bestAttempt
          ? stats.bestAttempt.assessmentKind === "past_paper"
            ? "Past Paper exam"
            : `${this.formatModeLabel(stats.bestAttempt.mode)} quiz`
          : "No attempts",
      },
    ]
      .map(
        (card) => `
      <div class="app-surface-card account-stat-card">
        <span class="account-stat-label">${this.escapeHtml(card.label)}</span>
        <span class="account-stat-value">${this.escapeHtml(card.value)}</span>
        <span class="account-stat-note">${this.escapeHtml(card.note)}</span>
      </div>
    `
      )
      .join("");

    const sectionCards = [
      { key: "normal", label: "Normal Quizzes" },
      { key: "exam", label: "Past Paper Exams" },
      { key: "combined", label: "Combined" },
    ];
    this.dom.accountModeGrid.innerHTML = sectionCards
      .map(({ key, label }) => {
        const sectionStats = stats.sectionStats[key];
        return `
        <div class="app-surface-card account-stat-card account-assessment-card" data-account-section="${this.escapeHtml(key)}">
          <span class="account-stat-label">${this.escapeHtml(label)}</span>
          <span class="account-stat-value">${sectionStats.averagePercentage}%</span>
          <span class="account-stat-note">${sectionStats.attemptsCount} attempt${sectionStats.attemptsCount === 1 ? "" : "s"} &middot; ${sectionStats.assessmentsDoneCount} completed</span>
        </div>
      `;
      })
      .join("");

    this.dom.accountCourseGrid.innerHTML = stats.courseStats
      .map(
        (course) => `
      <div class="app-surface-card account-course-card">
        <div class="account-course-head">
          <h3 class="account-course-title">${this.escapeHtml(course.area)}</h3>
          <span class="account-course-score">${course.averagePercentage}%</span>
        </div>
        <p class="account-course-meta">${course.quizzesDone} assessments done - ${course.attempts} attempts</p>
        <p class="account-course-meta">Best: ${this.escapeHtml(this.formatAttemptScore(course.bestAttempt))}</p>
      </div>
    `
      )
      .join("");

    this.dom.accountRecentList.innerHTML = stats.recentAttempts
      .map((attempt) => {
        const quiz = this.getQuizDescriptorById(attempt.quizId);
        const title = attempt.quizTitle || quiz?.title || "Quiz";
        const area = attempt.area || quiz?.area || "Unknown course";
        const sub =
          attempt.assessmentKind === "past_paper"
            ? "Past Paper Exam"
            : attempt.sub || quiz?.sub || "Unknown module";
        const modeLabel =
          attempt.assessmentKind === "past_paper"
            ? "Exam"
            : `${this.formatModeLabel(attempt.mode)} quiz`;
        return `
        <div class="app-surface-card account-recent-card">
          <div class="account-recent-head">
            <div>
              <h3 class="account-recent-title">${this.escapeHtml(title)}</h3>
              <p class="account-recent-meta">${this.escapeHtml(area)} - ${this.escapeHtml(sub)} - ${this.escapeHtml(modeLabel)}</p>
            </div>
            <span class="account-recent-score">${this.escapeHtml(this.formatAttemptScore(attempt))}</span>
          </div>
          <p class="account-recent-meta">${this.escapeHtml(this.formatDateTime(attempt.completedAt))}</p>
        </div>
      `;
      })
      .join("");
  },

  async renderSettingsView() {
    this.showLoadingView();

    let access = this.state.accessStatus;
    if (!access) {
      try {
        access = await this.loadAccessStatus();
      } catch (error) {
        console.error("Settings access load failed:", error);
        if (await this.handleAccessRestriction(error)) {
          return;
        }
        access = this.state.accessStatus || {};
      }
    }

    this.showOnly("settings-view");
    this.renderThemeToggle();

    const displayName = this.getDisplayNameForUser(this.state.currentUser);
    const email = String(this.state.currentUser?.email || "").trim();
    const status = String(access?.status || "no_access");
    const expirySummaryText = access?.accessExpiresAt
      ? (() => {
          const date = new Date(access.accessExpiresAt);
          if (Number.isNaN(date.getTime())) return "Unknown";
          return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
          }).format(date);
        })()
      : "--";
    const expiryText = access?.accessExpiresAt
      ? this.formatDateTime(access.accessExpiresAt)
      : "Not set";
    const statusLabel =
      {
        active: "Active",
        expired: "Expired",
        blocked: "Blocked",
        no_access: "Not Activated",
        signed_out: "Signed Out",
      }[status] || "Unknown";

    if (this.dom.settingsPageTitle) {
      this.dom.settingsPageTitle.textContent = `${displayName}'s Settings`;
    }
    if (this.dom.settingsPageSubtitle) {
      this.dom.settingsPageSubtitle.textContent =
        "Manage account access, appearance preference, and account actions.";
    }
    if (this.dom.settingsAccessStatusValue) {
      this.dom.settingsAccessStatusValue.textContent = statusLabel;
      this.dom.settingsAccessStatusValue.classList.remove("good", "fail");
      this.dom.settingsAccessStatusValue.classList.toggle(
        "good",
        status === "active"
      );
      this.dom.settingsAccessStatusValue.classList.toggle(
        "fail",
        ["blocked", "expired"].includes(status)
      );
    }
    if (this.dom.settingsExpiryValue) {
      this.dom.settingsExpiryValue.textContent = expirySummaryText;
    }

    if (this.dom.settingsEmailValue) {
      this.dom.settingsEmailValue.textContent = email || "No email";
    }
    if (this.dom.settingsStatusChip) {
      this.dom.settingsStatusChip.textContent = statusLabel;
      this.dom.settingsStatusChip.classList.remove(
        "is-active",
        "is-expired",
        "is-blocked",
        "is-neutral"
      );
      this.dom.settingsStatusChip.classList.add(
        status === "active"
          ? "is-active"
          : status === "expired"
            ? "is-expired"
            : status === "blocked"
              ? "is-blocked"
              : "is-neutral"
      );
    }
    if (this.dom.settingsExpiryDetailValue) {
      this.dom.settingsExpiryDetailValue.textContent = expiryText;
    }
    if (this.dom.settingsReasonRow && this.dom.settingsReasonValue) {
      const reason = String(access?.blockReason || "").trim();
      this.dom.settingsReasonValue.textContent = reason;
      this.dom.settingsReasonRow.hidden = !reason;
    }

    this.startSettingsCountdown(access);
  },

  async handleSubmission({ force = false, timedOut = false } = {}) {
    if (this.quizSubmissionInFlight) return;

    const questions = this.state.activeQuestions;
    const form = document.getElementById("quiz-form");
    const quizMeta = this.getCurrentQuizMeta();
    if (!questions.length || !form || !quizMeta) return;
    const answeredQuestions = this.countAnsweredQuestions();
    const totalQuestions = Number(questions.length || 0);
    const unansweredQuestions = Math.max(0, totalQuestions - answeredQuestions);

    if (unansweredQuestions > 0 && !force) {
      const confirmed = await confirmDialog({
        title: "Submit incomplete quiz",
        message: `${unansweredQuestions} unanswered question${unansweredQuestions === 1 ? "" : "s"} remaining. Submit anyway?`,
        submitLabel: "Submit anyway",
        cancelLabel: "Keep answering",
      });
      if (!confirmed) return;
    }

    this.quizSubmissionInFlight = true;
    this.stopQuizCountdown();
    this.showLoadingView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const formData = new FormData(form);
      this.dom.resultsContainer.innerHTML = "";

      let score = 0;
      let correct = 0;
      let wrong = 0;
      let unanswered = 0;
      const total = questions.length;
      const negativeMarking = this.state.negativeMarking;
      const results = [];

      questions.forEach((item, index) => {
        const rawUserAns = formData.get(`q${index}`) || "NS";
        const userAns =
          rawUserAns === "NS"
            ? "NS"
            : item.type === "tf"
              ? this.normalizeTfAnswer(rawUserAns)
              : this.normalizeSbaAnswer(rawUserAns, item.options || []);

        const isCorrect = userAns !== "NS" && userAns === item.a;
        let statusClass = "incorrect";
        let statusText = negativeMarking ? "Incorrect (-1)" : "Incorrect (0)";
        let points = 0;

        if (userAns === "NS") {
          statusClass = "notsure";
          statusText = "Not answered (0)";
          unanswered += 1;
        } else if (isCorrect) {
          statusClass = "correct";
          statusText = "Correct (+1)";
          points = 1;
          correct += 1;
        } else {
          wrong += 1;
          if (negativeMarking) points = -1;
        }

        score += points;
        const imageHtml = item.img
          ? `<div class="result-media"><img class="result-image" src="${this.escapeHtml(item.img)}" alt="Result image ${index + 1}"></div>`
          : "";
        const formattedUserAnswer = this.formatUserAnswer(item, userAns);
        const formattedCorrectAnswer = this.formatCorrectAnswer(item);
        results.push({
          index,
          type: item.type,
          statusClass,
          statusText,
          question: item.q,
          imageHtml,
          userAnswer: formattedUserAnswer,
          correctAnswer: formattedCorrectAnswer,
          explanation: item.exp || "",
        });
      });

      const percent = Math.round((Math.max(score, 0) / total) * 100);
      const cardsHtml = results
        .map((item) => this.buildResultReviewCardMarkup(item))
        .join("");

      const resultsSnapshot = {
        context: this.getCurrentQuizContext(),
        mode: this.state.mode,
        negativeMarking,
        score,
        total,
        correct,
        wrong,
        unanswered,
        percent,
        results,
        cardsHtml,
        timedOut,
        savedAt: new Date().toISOString(),
      };

      const saveResult = await this.saveAttemptRecord({
        quizId: quizMeta.id,
        mode: this.state.mode,
        score,
        totalQuestions: total,
        correctCount: correct,
        wrongCount: wrong,
        unansweredCount: unanswered,
        percentage: percent,
      });

      if (!saveResult.success) {
        console.error("Quiz attempt save failed:", saveResult.error);
        this.showToast(
          "Score saved locally on screen, but not to account history."
        );
      }

      resultsSnapshot.attemptCount = Math.max(
        1,
        Number(
          saveResult.attemptCount ||
            this.getAttemptStatsForQuizId(quizMeta.id)?.totalAttempts ||
            0
        )
      );
      await this.clearQuizDraft();
      this.saveQuizResultSnapshot(resultsSnapshot);

      this.navigate("results", {
        quizId: quizMeta.id,
        mode: this.state.mode,
        duration: this.state.currentExamDurationMinutes || "",
        negativeMarking: this.state.negativeMarking,
      });
    } finally {
      this.quizSubmissionInFlight = false;
    }
  },
};
