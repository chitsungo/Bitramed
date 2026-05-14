import { TYPE_META } from "../core/type-meta.js";
import { confirmDialog, durationPickerDialog } from "../ui/dialog.js";

export const learnerFeatures = {
  async refreshDatabase({
    silent = false,
    forceToast = false,
    includePersonalization = false,
  } = {}) {
    if (this.state.refreshInFlight) return;

    this.state.refreshInFlight = true;
    this.setRefreshButtonLoading(true);

    try {
      this.state.modulesByArea = {};
      this.state.subtopicProgressByArea = {};
      this.state.quizzesByModule = {};
      this.state.moduleTypeCountsByModule = {};

      const tasks = [this.loadAreaCatalog()];
      if (includePersonalization) {
        tasks.push(this.loadPersonalizationData());
      }
      await Promise.all(tasks);

      if (!silent) {
        await this.router();
      } else if (this.state.topbar.searchOpen) {
        await this.renderSearchResults();
      }

      if (forceToast) this.showToast("Database refreshed.");
    } catch (error) {
      console.error("Supabase load error:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showFatalLoadError(
        error?.message || "Could not load data from Supabase."
      );
      if (forceToast) this.showToast("Refresh failed.");
    } finally {
      this.state.refreshInFlight = false;
      this.setRefreshButtonLoading(false);
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
      ["PGRST202", "42883", "42P01"].includes(code) ||
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

  async loadPersonalizationData() {
    const userId = this.state.currentUser?.id;
    if (!userId) return;

    try {
      const { data, error } = await this.withTimeout(
        this.getSupabase().rpc("app_user_attempts_enriched"),
        12000,
        "Loading account stats"
      );

      if (error) throw error;

      const attempts = (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        quizId: row.quiz_id,
        level: row.level ? String(row.level).trim() : "",
        area: row.area ? String(row.area).trim() : "",
        sub: row.sub ? String(row.sub).trim() : "",
        quizTitle: row.quiz_title ? String(row.quiz_title).trim() : "",
        questionType:
          row.question_type === "tf"
            ? "tf"
            : row.question_type === "sba"
              ? "sba"
              : "",
        mode: row.mode === "exam" ? "exam" : "study",
        score: Number(row.score || 0),
        totalQuestions: Number(row.total_questions || 0),
        correctCount: Number(row.correct_count || 0),
        wrongCount: Number(row.wrong_count || 0),
        unansweredCount: Number(row.unanswered_count || 0),
        percentage: Number(row.percentage || 0),
        completedAt: row.completed_at || "",
      }));

      this.setAttemptsData(attempts);
      (data || []).forEach((row) => {
        if (!row.level) return;
        this.registerQuizDescriptor({
          level: row.level,
          quizId: row.quiz_id,
          area: row.area,
          sub: row.sub,
          type: row.question_type,
          title: row.quiz_title,
          count: row.question_count ?? row.total_questions,
        });
      });

      const needsHydration = attempts.some((attempt) => {
        if (
          attempt.level &&
          attempt.area &&
          attempt.sub &&
          attempt.quizTitle &&
          attempt.questionType
        ) {
          return false;
        }
        return !this.getQuizDescriptorById(attempt.quizId);
      });

      if (needsHydration) {
        void this.hydrateAttemptDescriptors(attempts)
          .then(async () => {
            this.setAttemptsData(
              this.enrichAttemptsWithDescriptors(this.state.attempts)
            );

            const routeRoot =
              window.location.pathname
                .replace(/^\/+|\/+$/g, "")
                .split("/")
                .filter(Boolean)[0] || "dashboard";
            if (
              [
                "dashboard",
                "modules",
                "subtopics",
                "types",
                "quizzes",
                "account",
              ].includes(routeRoot)
            ) {
              await this.router();
            }
          })
          .catch((hydrationError) => {
            console.error(
              "Deferred attempt descriptor hydration failed:",
              hydrationError
            );
          });
      }
    } catch (error) {
      console.error("Personalization load error:", error);
      this.showToast("Could not load account stats.");
      this.setAttemptsData([]);
    }
  },

  async hydrateAttemptDescriptors(attempts) {
    const quizIds = [
      ...new Set(
        (attempts || []).map((attempt) => attempt.quizId).filter(Boolean)
      ),
    ];
    if (!quizIds.length) return;

    const missingQuizIds = quizIds.filter(
      (quizId) => !this.state.quizDetailsById[quizId]
    );
    if (!missingQuizIds.length) return;

    try {
      await this.loadQuizDescriptorsByIds(
        missingQuizIds,
        "Loading attempted quiz details"
      );
    } catch (error) {
      console.error("Attempt descriptor hydration failed:", error);
    }
  },

  async loadQuizDescriptorsByIds(quizIds, label = "Loading quiz details") {
    const ids = [...new Set((quizIds || []).filter(Boolean))];
    if (!ids.length) return;

    const missingQuizIds = ids.filter(
      (quizId) => !this.state.quizDetailsById[quizId]
    );
    if (!missingQuizIds.length) return;

    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_quiz_catalog_rows", {
        p_quiz_ids: missingQuizIds,
      }),
      12000,
      label
    );

    if (error) throw error;

    this.registerQuizCatalogRows(data || []);
  },

  async loadQuizDescriptorsByIdsLegacy(
    quizIds,
    label = "Loading quiz details"
  ) {
    const missingQuizIds = [...new Set((quizIds || []).filter(Boolean))];
    if (!missingQuizIds.length) return;

    const supabase = this.getSupabase();
    const quizzesRes = await this.withTimeout(
      supabase
        .from("quizzes")
        .select("id, subtopic_id, title, question_type")
        .in("id", missingQuizIds),
      12000,
      label
    );

    if (quizzesRes.error) throw quizzesRes.error;

    const quizzes = quizzesRes.data || [];
    const subtopicIds = [
      ...new Set(quizzes.map((row) => row.subtopic_id).filter(Boolean)),
    ];
    const loadedQuizIds = quizzes.map((row) => row.id).filter(Boolean);

    const [subtopicsRes, countsRes] = await Promise.all([
      subtopicIds.length
        ? this.withTimeout(
            supabase
              .from("subtopics")
              .select("id, module_id, name")
              .in("id", subtopicIds),
            12000,
            `${label} subtopics`
          )
        : Promise.resolve({ data: [], error: null }),
      loadedQuizIds.length
        ? this.withTimeout(
            supabase
              .from("quiz_question_counts")
              .select("quiz_id, total_questions")
              .in("quiz_id", loadedQuizIds),
            12000,
            `${label} counts`
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (subtopicsRes.error) throw subtopicsRes.error;
    if (countsRes.error) throw countsRes.error;

    const moduleIds = [
      ...new Set(
        (subtopicsRes.data || []).map((row) => row.module_id).filter(Boolean)
      ),
    ];
    const modulesRes = moduleIds.length
      ? await this.withTimeout(
          supabase
            .from("modules")
            .select("id, level_id, name")
            .in("id", moduleIds),
          12000,
          `${label} courses`
        )
      : { data: [], error: null };
    if (modulesRes.error) throw modulesRes.error;

    const levelIds = [
      ...new Set(
        (modulesRes.data || []).map((row) => row.level_id).filter(Boolean)
      ),
    ];
    const levelsRes = levelIds.length
      ? await this.withTimeout(
          supabase.from("levels").select("id, name").in("id", levelIds),
          12000,
          `${label} levels`
        )
      : { data: [], error: null };
    if (levelsRes.error) throw levelsRes.error;

    this.registerQuizCollection({
      quizzes,
      questionCountsMap: Object.fromEntries(
        (countsRes.data || []).map((row) => [row.quiz_id, row.total_questions])
      ),
      subtopicsById: Object.fromEntries(
        (subtopicsRes.data || []).map((row) => [row.id, row])
      ),
      modulesById: Object.fromEntries(
        (modulesRes.data || []).map((row) => [row.id, row])
      ),
      levelsById: Object.fromEntries(
        (levelsRes.data || []).map((row) => [row.id, row])
      ),
    });
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
    this.state.subtopicProgressByArea = {};
    this.state.accountSummary = null;
    this.state.quizAttemptSummariesById = {};
  },

  setAttemptsData(attempts) {
    const normalizedAttempts = this.normalizeAttempts(attempts);
    const attemptsSignature = this.buildAttemptsSignature(normalizedAttempts);
    const attemptsChanged = attemptsSignature !== this.state.attemptsSignature;

    this.state.attempts = normalizedAttempts;
    this.state.attemptsSignature = attemptsSignature;
    this.state.attemptsByQuizId =
      this.groupAttemptsByQuizId(normalizedAttempts);
    this.state.userStats = this.buildUserStats(normalizedAttempts);

    if (attemptsChanged && !this.restoringAppDataCache) {
      this.invalidateAttemptDerivedCaches();
    }

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

  enrichAttemptsWithDescriptors(attempts) {
    return (attempts || []).map((attempt) => {
      const descriptor = this.getQuizDescriptorById(attempt.quizId);
      if (!descriptor) return attempt;

      return {
        ...attempt,
        level: attempt.level || descriptor.level || "",
        area: attempt.area || descriptor.area || "",
        sub: attempt.sub || descriptor.sub || "",
        quizTitle: attempt.quizTitle || descriptor.title || "",
        questionType: attempt.questionType || descriptor.type || "",
      };
    });
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

  registerQuizDescriptor({ quizId, level, area, sub, type, title, count }) {
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

  buildUserStats(attempts) {
    const quizIds = new Set();
    const modes = { study: [], exam: [] };
    const courseMap = {};

    (attempts || []).forEach((attempt) => {
      if (attempt?.quizId) {
        quizIds.add(attempt.quizId);
      }
      modes[attempt.mode].push(attempt);

      const quiz = this.getQuizDescriptorById(attempt.quizId);
      const levelName = attempt.level || quiz?.level || "";
      const areaName = attempt.area || quiz?.area || "Unknown course";
      const courseLabel = levelName ? `${levelName} - ${areaName}` : areaName;
      if (!courseMap[courseLabel]) courseMap[courseLabel] = [];
      courseMap[courseLabel].push(attempt);
    });

    const bestAttempt = (attempts || []).reduce((best, current) => {
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
          courseAttempts.map((attempt) => attempt.quizId).filter(Boolean)
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
      attemptsCount: attempts.length,
      quizzesDoneCount: quizIds.size,
      averagePercentage: this.calculateAveragePercentage(attempts || []),
      bestAttempt,
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
      recentAttempts: (attempts || []).slice(0, 10),
    };
  },

  buildModuleAssessmentSummary({
    moduleData = {},
    level = "",
    area = "",
    sub = "",
  } = {}) {
    const quizIds = ["sba", "tf"].flatMap((type) =>
      Object.values(moduleData?.[type] || {})
        .map((quizMeta) => quizMeta?.id)
        .filter(Boolean)
    );

    const uniqueQuizIds = [...new Set(quizIds)];
    const doneCount = uniqueQuizIds.filter(
      (quizId) => (this.state.attemptsByQuizId[quizId] || []).length
    ).length;

    return {
      doneCount,
      totalCount: uniqueQuizIds.length,
    };
  },

  buildAreaAssessmentSummary(modules, progressByModule) {
    const summary = (modules || []).reduce(
      (aggregate, moduleRecord) => {
        const progress = progressByModule?.[moduleRecord.name] || {
          doneCount: 0,
          totalCount: 0,
        };
        aggregate.doneCount += Number(progress.doneCount || 0);
        aggregate.totalCount += Number(progress.totalCount || 0);
        return aggregate;
      },
      {
        doneCount: 0,
        totalCount: 0,
      }
    );

    return {
      ...summary,
      moduleCount: (modules || []).length,
      percent: this.getCompletionPercent(summary),
    };
  },

  getCompletionPercent({ doneCount = 0, totalCount = 0 } = {}) {
    return totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  },

  getCachedAreaModuleProgress(area, levelOverride = this.state.currentLevel) {
    if (!area) return null;

    const level = levelOverride;
    const cacheKey = this.getAreaCacheKey(level, area);
    if (this.state.subtopicProgressByArea[cacheKey]) {
      return this.state.subtopicProgressByArea[cacheKey];
    }

    const modules = this.state.modulesByArea[cacheKey];
    if (!Array.isArray(modules)) {
      return null;
    }

    const progressEntries = [];
    for (const moduleRecord of modules) {
      const moduleData =
        this.state.quizzesByModule[
          this.getModuleCacheKey(level, area, moduleRecord.name)
        ];
      if (!moduleData) {
        return null;
      }

      progressEntries.push([
        moduleRecord.name,
        this.buildModuleAssessmentSummary({
          moduleData,
          level,
          area,
          sub: moduleRecord.name,
        }),
      ]);
    }

    const progressByModule = Object.fromEntries(progressEntries);
    this.state.subtopicProgressByArea[cacheKey] = progressByModule;
    this.scheduleAppDataCacheWrite();
    return progressByModule;
  },

  getCachedAreaProgressSummary(level, area) {
    if (!level || !area) {
      return null;
    }

    const modules = this.state.modulesByArea[this.getAreaCacheKey(level, area)];
    if (!Array.isArray(modules)) {
      return null;
    }

    const progressByModule = this.getCachedAreaModuleProgress(area, level);
    if (!progressByModule) {
      return null;
    }

    return this.buildAreaAssessmentSummary(modules, progressByModule);
  },

  getCachedLevelProgressSummary(level) {
    if (!level) {
      return null;
    }

    const areas = this.state.areasByLevel[level] || [];
    const areaSummaries = [];

    for (const areaRecord of areas) {
      const areaSummary = this.getCachedAreaProgressSummary(
        level,
        areaRecord.name
      );
      if (!areaSummary) {
        return null;
      }
      areaSummaries.push(areaSummary);
    }

    const summary = areaSummaries.reduce(
      (aggregate, areaSummary) => {
        aggregate.doneCount += Number(areaSummary.doneCount || 0);
        aggregate.totalCount += Number(areaSummary.totalCount || 0);
        return aggregate;
      },
      {
        doneCount: 0,
        totalCount: 0,
      }
    );

    return {
      ...summary,
      courseCount: areas.length,
      percent: this.getCompletionPercent(summary),
    };
  },

  async getAreaProgressSummary(level, area) {
    const cachedSummary = this.getCachedAreaProgressSummary(level, area);
    if (cachedSummary) {
      return cachedSummary;
    }

    if (!level || !area) {
      return {
        doneCount: 0,
        totalCount: 0,
        moduleCount: 0,
        percent: 0,
      };
    }

    const modules = await this.ensureAreaModulesLoaded(area, level);
    const progressByModule = await this.getAreaModuleProgress(area, level);
    return this.buildAreaAssessmentSummary(modules, progressByModule);
  },

  async getLevelProgressSummary(level) {
    const cachedSummary = this.getCachedLevelProgressSummary(level);
    if (cachedSummary) {
      return cachedSummary;
    }

    if (!level) {
      return {
        doneCount: 0,
        totalCount: 0,
        courseCount: 0,
        percent: 0,
      };
    }

    const areas = this.state.areasByLevel[level] || [];
    const areaSummaries = await Promise.all(
      areas.map((areaRecord) => this.getAreaProgressSummary(level, areaRecord.name))
    );
    const summary = areaSummaries.reduce(
      (aggregate, areaSummary) => {
        aggregate.doneCount += Number(areaSummary.doneCount || 0);
        aggregate.totalCount += Number(areaSummary.totalCount || 0);
        return aggregate;
      },
      {
        doneCount: 0,
        totalCount: 0,
      }
    );

    return {
      ...summary,
      courseCount: areas.length,
      percent: this.getCompletionPercent(summary),
    };
  },

  async loadAccountSummary(force = false) {
    if (!force && this.state.accountSummary) return this.state.accountSummary;

    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_account_summary"),
      12000,
      "Loading account summary"
    );

    if (error) throw error;

    const summary = data || {
      attemptsCount: 0,
      quizzesDoneCount: 0,
      averagePercentage: 0,
      bestAttempt: null,
      modeStats: {
        study: { attemptsCount: 0, averagePercentage: 0 },
        exam: { attemptsCount: 0, averagePercentage: 0 },
      },
      courseStats: [],
      recentAttempts: [],
    };

    this.state.accountSummary = summary;
    return summary;
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

  async getModuleTypeCounts(area, sub, force = false) {
    const cacheKey = this.getModuleCacheKey(this.state.currentLevel, area, sub);
    if (!force && this.state.moduleTypeCountsByModule[cacheKey]) {
      return this.state.moduleTypeCountsByModule[cacheKey];
    }
    const moduleData = await this.ensureModuleQuizzesLoaded(area, sub, force);
    const counts = {
      sba: Object.keys(moduleData.sba || {}).length,
      tf: Object.keys(moduleData.tf || {}).length,
    };
    this.state.moduleTypeCountsByModule[cacheKey] = counts;
    return counts;
  },

  async saveAttemptRecord(payload) {
    const userId = this.state.currentUser?.id;
    if (!userId) return { success: false, error: new Error("No active user.") };

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
    return { success: true, attempt: savedAttempt };
  },

  async resetAccountData() {
    const userId = this.state.currentUser?.id;
    if (!userId) return;
    const confirmed = await confirmDialog({
      title: "Reset account history",
      message:
        "This will delete your saved quiz attempts and performance stats.",
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
      const { error } = await this.withTimeout(
        this.getSupabase().from("quiz_attempts").delete().eq("user_id", userId),
        12000,
        "Resetting account"
      );
      if (error) throw error;
      this.setAttemptsData([]);
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

  hasAreaModulesCached(level, area) {
    return Array.isArray(
      this.state.modulesByArea[this.getAreaCacheKey(level, area)]
    );
  },

  hasAreaProgressCached(level, area) {
    return !!this.state.subtopicProgressByArea[
      this.getAreaCacheKey(level, area)
    ];
  },

  hasModuleQuizzesCached(level, area, sub) {
    return !!this.state.quizzesByModule[
      this.getModuleCacheKey(level, area, sub)
    ];
  },

  getAreaRecord(level, area) {
    return (
      (this.state.areasByLevel[level] || []).find(
        (item) => item.name === area
      ) || null
    );
  },

  async getSubtopicRecord(area, sub, levelOverride = this.state.currentLevel) {
    const modules = await this.ensureAreaModulesLoaded(area, levelOverride);
    return modules.find((item) => item.name === sub) || null;
  },

  async ensureAreaModulesLoaded(area, levelOverride = this.state.currentLevel) {
    if (!area) return [];
    const level = levelOverride;
    const cacheKey = this.getAreaCacheKey(level, area);
    if (this.state.modulesByArea[cacheKey])
      return this.state.modulesByArea[cacheKey];

    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_course_subtopics_progress", {
        p_level: level,
        p_area: area,
      }),
      12000,
      "Loading modules"
    );
    if (error) throw error;

    const modules = (data || [])
      .map((row) => ({
        id: row.subtopic_id,
        name: String(row.subtopic_name || "").trim() || "General",
        areaId: row.course_id || "",
      }))
      .sort((a, b) => this.compareDisplayOrder(a.name, b.name));

    this.state.modulesByArea[cacheKey] = modules;
    this.scheduleAppDataCacheWrite();
    return modules;
  },

  async ensureAreaModulesLoadedLegacy(area, levelOverride = this.state.currentLevel) {
    if (!area) return [];
    const level = levelOverride;
    const cacheKey = this.getAreaCacheKey(level, area);
    if (this.state.modulesByArea[cacheKey])
      return this.state.modulesByArea[cacheKey];

    const areaRecord = this.getAreaRecord(level, area);
    if (!areaRecord?.id) return [];

    const { data, error } = await this.withTimeout(
      this.getSupabase()
        .from("subtopics")
        .select("id, module_id, name")
        .eq("module_id", areaRecord.id),
      12000,
      "Loading modules"
    );

    if (error) throw error;

    const modules = (data || [])
      .map((row) => ({
        id: row.id,
        name: String(row.name || "").trim() || "General",
        areaId: row.module_id,
      }))
      .sort((a, b) => this.compareDisplayOrder(a.name, b.name));

    this.state.modulesByArea[cacheKey] = modules;
    return modules;
  },

  async getAreaModuleProgress(area, levelOverride = this.state.currentLevel) {
    if (!area) return {};
    const level = levelOverride;
    const cacheKey = this.getAreaCacheKey(level, area);
    const cachedProgress = this.getCachedAreaModuleProgress(area, level);
    if (cachedProgress) {
      return cachedProgress;
    }

    const modules = await this.ensureAreaModulesLoaded(area, level);
    const progressEntries = await Promise.all(
      modules.map(async (moduleRecord) => {
        const moduleData = await this.ensureModuleQuizzesLoaded(
          area,
          moduleRecord.name,
          false,
          level
        );
        return [
          moduleRecord.name,
          this.buildModuleAssessmentSummary({
            moduleData,
            level,
            area,
            sub: moduleRecord.name,
          }),
        ];
      })
    );

    const progress = Object.fromEntries(progressEntries);
    this.state.subtopicProgressByArea[cacheKey] = progress;
    this.scheduleAppDataCacheWrite();
    return progress;
  },

  async getAreaModuleProgressLegacy(area, levelOverride = this.state.currentLevel) {
    if (!area) return {};
    const level = levelOverride;
    const cacheKey = this.getAreaCacheKey(level, area);
    if (this.state.subtopicProgressByArea[cacheKey]) {
      return this.state.subtopicProgressByArea[cacheKey];
    }
    const modules = await this.ensureAreaModulesLoadedLegacy(area, level);
    const subtopicIds = modules.map((row) => row.id).filter(Boolean);
    if (!subtopicIds.length) {
      this.state.subtopicProgressByArea[cacheKey] = {};
      return {};
    }

    const { data, error } = await this.withTimeout(
      this.getSupabase()
        .from("quizzes")
        .select("id, subtopic_id")
        .in("subtopic_id", subtopicIds),
      12000,
      "Loading module progress"
    );
    if (error) throw error;

    const attemptsByQuizId = this.state.attemptsByQuizId || {};
    const progressByModule = {};

    (data || []).forEach((quiz) => {
      const moduleRecord = modules.find((item) => item.id === quiz.subtopic_id);
      if (!moduleRecord) return;
      if (!progressByModule[moduleRecord.name]) {
        progressByModule[moduleRecord.name] = {
          doneQuizIds: new Set(),
          totalCount: 0,
        };
      }

      progressByModule[moduleRecord.name].totalCount += 1;
      if ((attemptsByQuizId[quiz.id] || []).length) {
        progressByModule[moduleRecord.name].doneQuizIds.add(quiz.id);
      }
    });

    const progress = Object.fromEntries(
      modules.map((moduleRecord) => {
        const moduleProgress = progressByModule[moduleRecord.name] || {
          doneQuizIds: new Set(),
          totalCount: 0,
        };
        return [
          moduleRecord.name,
          {
            doneCount: moduleProgress.doneQuizIds.size,
            totalCount: moduleProgress.totalCount,
          },
        ];
      })
    );

    this.state.subtopicProgressByArea[cacheKey] = progress;
    return progress;
  },

  async ensureModuleQuizzesLoaded(
    area,
    sub,
    force = false,
    levelOverride = this.state.currentLevel
  ) {
    const level = levelOverride;
    const cacheKey = this.getModuleCacheKey(level, area, sub);
    if (!force && this.state.quizzesByModule[cacheKey])
      return this.state.quizzesByModule[cacheKey];

    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_subtopic_quiz_list", {
        p_level: level,
        p_area: area,
        p_sub: sub,
      }),
      12000,
      "Loading quizzes"
    );
    if (error) throw error;

    const grouped = this.registerQuizCatalogRows(
      (data || []).map((row) => ({
        quiz_id: row.quiz_id,
        level,
        area,
        sub,
        quiz_title: row.quiz_title,
        question_type: row.question_type,
        question_count: row.question_count,
      }))
    );

    const moduleData = grouped[cacheKey] || { sba: {}, tf: {} };
    this.state.quizzesByModule[cacheKey] = moduleData;
    this.state.moduleTypeCountsByModule[cacheKey] = {
      sba: Object.keys(moduleData.sba || {}).length,
      tf: Object.keys(moduleData.tf || {}).length,
    };
    this.scheduleAppDataCacheWrite();
    return moduleData;
  },

  async ensureModuleQuizzesLoadedLegacy(
    area,
    sub,
    force = false,
    levelOverride = this.state.currentLevel
  ) {
    const level = levelOverride;
    const cacheKey = this.getModuleCacheKey(level, area, sub);
    if (!force && this.state.quizzesByModule[cacheKey])
      return this.state.quizzesByModule[cacheKey];

    const subtopicRecord = await this.getSubtopicRecord(area, sub, level);
    if (!subtopicRecord?.id) return { sba: {}, tf: {} };

    const supabase = this.getSupabase();
    const quizzesRes = await this.withTimeout(
      supabase
        .from("quizzes")
        .select("id, title, question_type, subtopic_id")
        .eq("subtopic_id", subtopicRecord.id),
      12000,
      "Loading quizzes"
    );
    if (quizzesRes.error) throw quizzesRes.error;

    const quizIds = (quizzesRes.data || [])
      .map((row) => row.id)
      .filter(Boolean);
    const countsRes = quizIds.length
      ? await this.withTimeout(
          supabase
            .from("quiz_question_counts")
            .select("quiz_id, total_questions")
            .in("quiz_id", quizIds),
          12000,
          "Loading quiz counts"
        )
      : { data: [], error: null };
    if (countsRes.error) throw countsRes.error;

    const countByQuizId = Object.fromEntries(
      (countsRes.data || []).map((row) => [row.quiz_id, row.total_questions])
    );

    const grouped = { sba: {}, tf: {} };
    (quizzesRes.data || [])
      .slice()
      .sort((a, b) => this.compareDisplayOrder(a.title, b.title))
      .forEach((row) => {
        const type = row.question_type === "tf" ? "tf" : "sba";
        const title = String(row.title || "").trim() || "Review Quiz";
        const quizId = row.id;
        const count = Number(countByQuizId[quizId] || 0);

        grouped[type][title] = { id: quizId, count };
        this.registerQuizDescriptor({
          level,
          quizId,
          area,
          sub,
          type,
          title,
          count,
        });
      });

    this.state.quizzesByModule[cacheKey] = grouped;
    return grouped;
  },

  async ensureSearchIndexLoaded() {
    if (this.state.search.indexLoaded) return;
    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_quiz_catalog_rows"),
      12000,
      "Loading search index"
    );
    if (error) throw error;

    this.registerQuizCatalogRows(data || []);
    this.state.search.indexLoaded = true;
  },

  async ensureSearchIndexLoadedLegacy() {
    if (this.state.search.indexLoaded) return;

    const supabase = this.getSupabase();
    const quizzesRes = await this.withTimeout(
      supabase.from("quizzes").select("id, subtopic_id, title, question_type"),
      12000,
      "Loading search index"
    );
    if (quizzesRes.error) throw quizzesRes.error;

    const quizzes = quizzesRes.data || [];
    const subtopicIds = [
      ...new Set(quizzes.map((row) => row.subtopic_id).filter(Boolean)),
    ];
    const quizIds = quizzes.map((row) => row.id).filter(Boolean);

    const countsRes = quizIds.length
      ? await this.withTimeout(
          supabase
            .from("quiz_question_counts")
            .select("quiz_id, total_questions")
            .in("quiz_id", quizIds),
          12000,
          "Loading search counts"
        )
      : { data: [], error: null };
    if (countsRes.error) throw countsRes.error;

    const subtopicsRes = subtopicIds.length
      ? await this.withTimeout(
          supabase
            .from("subtopics")
            .select("id, module_id, name")
            .in("id", subtopicIds),
          12000,
          "Loading search modules"
        )
      : { data: [], error: null };
    if (subtopicsRes.error) throw subtopicsRes.error;

    const moduleIds = [
      ...new Set(
        (subtopicsRes.data || []).map((row) => row.module_id).filter(Boolean)
      ),
    ];
    const modulesRes = moduleIds.length
      ? await this.withTimeout(
          supabase
            .from("modules")
            .select("id, name, level_id")
            .in("id", moduleIds),
          12000,
          "Loading search courses"
        )
      : { data: [], error: null };
    if (modulesRes.error) throw modulesRes.error;

    const levelIds = [
      ...new Set(
        (modulesRes.data || []).map((row) => row.level_id).filter(Boolean)
      ),
    ];
    const levelsRes = levelIds.length
      ? await this.withTimeout(
          supabase.from("levels").select("id, name").in("id", levelIds),
          12000,
          "Loading search levels"
        )
      : { data: [], error: null };
    if (levelsRes.error) throw levelsRes.error;

    this.registerQuizCollection({
      quizzes,
      questionCountsMap: Object.fromEntries(
        (countsRes.data || []).map((row) => [row.quiz_id, row.total_questions])
      ),
      subtopicsById: Object.fromEntries(
        (subtopicsRes.data || []).map((row) => [row.id, row])
      ),
      modulesById: Object.fromEntries(
        (modulesRes.data || []).map((row) => [row.id, row])
      ),
      levelsById: Object.fromEntries(
        (levelsRes.data || []).map((row) => [row.id, row])
      ),
    });

    this.state.search.indexLoaded = true;
  },

  registerQuizCatalogRows(rows) {
    const groupedByModule = {};

    (rows || [])
      .slice()
      .sort((a, b) => this.compareDisplayOrder(a.quiz_title, b.quiz_title))
      .forEach((row) => {
        const level = String(row.level || "").trim();
        const area = String(row.area || "").trim();
        const sub = String(row.sub || "").trim() || "General";
        const type = row.question_type === "tf" ? "tf" : "sba";
        const title = String(row.quiz_title || "").trim() || "Review Quiz";
        const quizId = row.quiz_id;
        const count = Number(row.question_count || 0);
        const cacheKey = this.getModuleCacheKey(level, area, sub);

        if (!groupedByModule[cacheKey]) {
          groupedByModule[cacheKey] = { sba: {}, tf: {} };
        }

        groupedByModule[cacheKey][type][title] = { id: quizId, count };
        this.registerQuizDescriptor({
          level,
          quizId,
          area,
          sub,
          type,
          title,
          count,
        });
      });

    Object.entries(groupedByModule).forEach(([cacheKey, grouped]) => {
      this.state.quizzesByModule[cacheKey] = grouped;
    });

    this.scheduleAppDataCacheWrite();
    return groupedByModule;
  },

  registerQuizCollection({
    quizzes,
    questionCountsMap = {},
    subtopicsById = {},
    modulesById = {},
    levelsById = {},
  }) {
    const groupedByModule = {};

    (quizzes || [])
      .slice()
      .sort((a, b) => this.compareDisplayOrder(a.title, b.title))
      .forEach((quizRow) => {
        const subtopicRow = subtopicsById[quizRow.subtopic_id];
        if (!subtopicRow) return;
        const moduleRow = modulesById[subtopicRow.module_id];
        if (!moduleRow) return;
        const levelRow = levelsById[moduleRow.level_id];
        if (!levelRow) return;

        const level = String(levelRow.name || "").trim();
        const area = String(moduleRow.name || "").trim();
        const sub = String(subtopicRow.name || "").trim() || "General";
        const type = quizRow.question_type === "tf" ? "tf" : "sba";
        const title = String(quizRow.title || "").trim() || "Review Quiz";
        const quizId = quizRow.id;
        const count = questionCountsMap[quizId] || 0;
        const cacheKey = this.getModuleCacheKey(level, area, sub);

        if (!groupedByModule[cacheKey]) {
          groupedByModule[cacheKey] = { sba: {}, tf: {} };
        }

        groupedByModule[cacheKey][type][title] = { id: quizId, count };
        this.state.quizMap[this.buildQuizKey(level, area, sub, type, title)] = {
          id: quizId,
          count,
        };
        this.state.quizDetailsById[quizId] = {
          level,
          area,
          sub,
          type,
          title,
          quizId,
          count,
        };
      });

    Object.entries(groupedByModule).forEach(([cacheKey, grouped]) => {
      this.state.quizzesByModule[cacheKey] = grouped;
    });

    this.scheduleAppDataCacheWrite();
    return groupedByModule;
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

  async fetchQuestionsForCurrentQuiz() {
    await this.ensureModuleQuizzesLoaded(
      this.state.currentArea,
      this.state.currentSub
    );
    const quizMeta = this.getCurrentQuizMeta();
    if (!quizMeta) return [];
    if (this.state.questionsByQuizId[quizMeta.id])
      return this.state.questionsByQuizId[quizMeta.id];

    try {
      const { data, error } = await this.withTimeout(
        this.getSupabase().rpc("app_quiz_questions", {
          p_quiz_id: quizMeta.id,
        }),
        12000,
        "Loading quiz questions"
      );

      if (error) throw error;

      const questions = (data || []).map((row) => {
        const type = this.state.currentType === "tf" ? "tf" : "sba";
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
          type === "tf"
            ? this.normalizeTfAnswer(row.correct_answer)
            : this.normalizeSbaAnswer(row.correct_answer, options);

        return {
          key: this.buildQuestionIdentity(row, type, options, normalizedAnswer),
          q: String(row.question_text || "").trim(),
          a: normalizedAnswer,
          exp: row.explanation ? String(row.explanation).trim() : "",
          img: row.image_url ? String(row.image_url).trim() : "",
          options: type === "sba" ? options : null,
          type,
        };
      });

      this.state.questionsByQuizId[quizMeta.id] = questions;
      return questions;
    } catch (error) {
      console.error("Question fetch error:", error);
      if (await this.handleAccessRestriction(error)) {
        return [];
      }
      return [];
    }
  },

  showFatalLoadError(message) {
    this.showOnly("loading-view");
    if (!this.dom.loadingView) return;
    this.dom.loadingView.innerHTML = `
      <div class="result-card incorrect">
        <div class="result-top">
          <span>Database Error</span>
          <span class="result-status incorrect-text">Load failed</span>
        </div>
        <div>${this.escapeHtml(message)}</div>
        <div class="explanation">
          <strong>Check:</strong> Supabase URL, anon key, RLS policies, and view permissions.
        </div>
      </div>
    `;
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

  isPastPapersArea(area = this.state.currentArea) {
    return this.normalizeText(area) === "past papers";
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

    if (this.isPastPapersArea()) {
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

  remapDraftAnswersToQuestionOrder(savedDraft, questions) {
    if (
      !savedDraft?.answers ||
      !Array.isArray(questions) ||
      !questions.length
    ) {
      return savedDraft;
    }

    const savedOrder = Array.isArray(savedDraft.questionOrder)
      ? savedDraft.questionOrder
      : null;
    if (!savedOrder?.some((key) => typeof key === "string" && key.trim())) {
      return savedDraft;
    }

    const questionIndexesByKey = new Map(
      questions.map((question, index) => [question?.key, index])
    );
    const remappedAnswers = {};

    savedOrder.forEach((key, savedIndex) => {
      if (typeof key !== "string" || !key.trim()) {
        return;
      }

      const savedFieldName = this.buildQuestionFieldName(savedIndex);
      if (
        !Object.prototype.hasOwnProperty.call(
          savedDraft.answers,
          savedFieldName
        )
      ) {
        return;
      }

      const nextIndex = questionIndexesByKey.get(key);
      if (!Number.isInteger(nextIndex)) {
        return;
      }

      remappedAnswers[this.buildQuestionFieldName(nextIndex)] =
        savedDraft.answers[savedFieldName];
    });

    return {
      ...savedDraft,
      answers: remappedAnswers,
    };
  },

  getQuizDraftForRestore(savedDraft, questions) {
    if (!savedDraft?.answers) return savedDraft;
    if (!this.isPastPapersArea()) return savedDraft;
    return this.remapDraftAnswersToQuestionOrder(savedDraft, questions);
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
    const progressText = `${hasProgressBar ? safePercent : 0}%`;
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
    const highestExistingYear = this.state.levelList.reduce(
      (maxYear, levelRecord) => {
        const levelNumber = Number(
          String(levelRecord.name).match(/\d+/)?.[0] || 0
        );
        return Math.max(maxYear, levelNumber);
      },
      0
    );
    const dashboardYearCount = Math.max(
      5,
      highestExistingYear || this.state.levelList.length || 0
    );

    return Array.from({ length: dashboardYearCount }, (_, index) => {
      const name = `Year ${index + 1}`;
      return (
        existingLevelsByName[name] || {
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

    card.onclick = isLocked ? null : () => this.navigate("modules", { level });
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

  buildQuizContextKey({
    level,
    area,
    sub,
    type,
    title,
    mode,
    durationMinutes,
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
      durationMinutes:
        this.state.mode === "exam"
          ? this.state.currentExamDurationMinutes
          : null,
    };
  },

  normalizeExamDurationMinutes(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) return 10;
    return Math.min(30, Math.max(5, parsed));
  },

  formatQuizTimer(totalSeconds) {
    const safeSeconds = Math.max(0, Number.parseInt(totalSeconds, 10) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  },

  async startExamModeFlow() {
    const durationMinutes = await durationPickerDialog({
      title: "Set exam duration",
      message: "Choose a timed pass between 5 and 30 minutes.",
      submitLabel: "Start exam",
      cancelLabel: "Cancel",
      min: 5,
      max: 30,
      initial: this.normalizeExamDurationMinutes(
        this.state.currentExamDurationMinutes
      ),
    });
    if (!durationMinutes) return;

    this.navigate("quiz", {
      level: this.state.currentLevel,
      area: this.state.currentArea,
      sub: this.state.currentSub,
      type: this.state.currentType,
      title: this.state.currentQuizTitle,
      mode: "exam",
      duration: durationMinutes,
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
    if (this.state.mode !== "exam") return;
    const fallbackSeconds =
      this.normalizeExamDurationMinutes(this.state.currentExamDurationMinutes) *
      60;
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

  startQuizCountdown() {
    this.stopQuizCountdown();
    if (this.state.mode !== "exam") return;

    const durationMinutes = this.normalizeExamDurationMinutes(
      this.state.currentExamDurationMinutes
    );
    this.state.currentExamDurationMinutes = durationMinutes;
    this.state.quizTimeRemainingSeconds = durationMinutes * 60;
    this.quizCountdownDeadline =
      Date.now() + this.state.quizTimeRemainingSeconds * 1000;
    this.updateQuizTimerUI();

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

  loadSavedQuizDraft(context = this.getCurrentQuizContext()) {
    return this.readStoredJson(this.getQuizDraftStorageKey(context));
  },

  saveQuizDraft(draft, context = this.getCurrentQuizContext()) {
    this.writeStoredJson(this.getQuizDraftStorageKey(context), draft);
  },

  clearQuizDraft(context = this.getCurrentQuizContext()) {
    this.removeStoredJson(this.getQuizDraftStorageKey(context));
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
    this.saveQuizDraft(this.serializeQuizDraft());
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
      this.dom.quizProgressCopy.textContent =
        this.state.mode === "exam"
          ? this.formatQuizTimer(
              Number.isFinite(this.state.quizTimeRemainingSeconds)
                ? this.state.quizTimeRemainingSeconds
                : this.normalizeExamDurationMinutes(
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
      .map(([title, quiz]) => ({
        ...quiz,
        title,
      }));
    const quizIndex =
      Math.max(
        0,
        orderedQuizzes.findIndex(
          (quiz) =>
            quiz.id === this.state.currentQuizId ||
            quiz.title === this.state.currentQuizTitle
        )
      ) + 1;
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
      this.dom.resultsModeLabel.textContent = this.formatModeLabel(
        snapshot.mode
      );
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

  renderStoredResultCards(snapshot) {
    const results = Array.isArray(snapshot?.results) ? snapshot.results : null;
    const setReviewCountLabel = (count, isMissedOnly = false) => {
      if (!this.dom.resultsReviewCount) return;
      this.dom.resultsReviewCount.textContent = isMissedOnly
        ? `${count} missed`
        : `${count} question${count === 1 ? "" : "s"}`;
    };

    if (!results) {
      const rawHtml = snapshot?.cardsHtml || "";
      if (!this.state.reviewWrongOnly) {
        this.dom.resultsContainer.innerHTML = rawHtml;
        const count = rawHtml
          ? (rawHtml.match(/class="result-card/g) || []).length
          : 0;
        setReviewCountLabel(count);
        this.updateResultsStickySummary(snapshot);
        return;
      }

      const temp = document.createElement("div");
      temp.innerHTML = rawHtml;
      const filteredCards = [...temp.querySelectorAll(".result-card")].filter(
        (card) => !card.classList.contains("correct")
      );

      if (!filteredCards.length) {
        this.dom.resultsContainer.innerHTML =
          this.buildResultsEmptyReviewMarkup();
        if (this.dom.resultsReviewCount) {
          this.dom.resultsReviewCount.textContent = "All clear";
        }
        this.updateResultsStickySummary(snapshot);
        return;
      }

      this.dom.resultsContainer.innerHTML = filteredCards
        .map((card) => card.outerHTML)
        .join("");
      setReviewCountLabel(filteredCards.length, true);
      this.updateResultsStickySummary(snapshot);
      return;
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

    const activeYears = this.state.levelList.filter((levelRecord) => {
      const attemptsForLevel = (this.state.attempts || []).filter((attempt) => {
        const descriptor = this.getQuizDescriptorById(attempt.quizId);
        return (attempt.level || descriptor?.level || "") === levelRecord.name;
      });
      return attemptsForLevel.length > 0;
    }).length;
    const completedCount = Number(this.state.userStats?.quizzesDoneCount || 0);
    const averageScore = Number(this.state.userStats?.averagePercentage || 0);

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

    const levelSummaries = await Promise.all(
      displayLevels.map(async (levelRecord) => [
        levelRecord.name,
        levelRecord.locked
          ? this.getDefaultLevelProgressSummary(levelRecord)
          : await this.getLevelProgressSummary(levelRecord.name),
      ])
    );
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
    if (!level || !this.state.levelIdByName[level]) {
      this.navigate("home");
      return;
    }

    const areaRecords = this.state.areasByLevel[level] || [];
    const areaSummaries = await Promise.all(
      areaRecords.map(async (areaRecord) => [
        areaRecord.name,
        await this.getAreaProgressSummary(level, areaRecord.name),
      ])
    );
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    document.getElementById("module-page-title").textContent = level;
    document.getElementById("modules-page-kicker").textContent = level;
    document.getElementById("module-page-subtitle").textContent = "";
    document.getElementById("modules-section-count").textContent =
      `${areaRecords.length} total`;
    this.dom.moduleGrid.innerHTML = "";

    const areaSummaryByName = Object.fromEntries(areaSummaries);
    areaRecords.forEach((areaRecord, index) => {
      const card = document.createElement("div");
      this.renderAreaBrowseCard(
        card,
        level,
        areaRecord,
        index,
        areaSummaryByName[areaRecord.name]
      );
      this.dom.moduleGrid.appendChild(card);
    });

    this.showOnly("modules-view");
  },

  async renderSubtopics() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const { currentLevel, currentArea } = this.state;
    if (
      !currentLevel ||
      !currentArea ||
      !this.getAreaRecord(currentLevel, currentArea)
    ) {
      this.navigate("modules", { level: currentLevel });
      return;
    }

    const areaCacheKey = this.getAreaCacheKey(currentLevel, currentArea);
    const everythingCached =
      this.hasAreaModulesCached(currentLevel, currentArea) &&
      !!this.state.subtopicProgressByArea[areaCacheKey];

    if (!everythingCached) {
      this.showLoadingView();
    }

    let modules;
    try {
      modules = await this.ensureAreaModulesLoaded(currentArea);
    } catch (error) {
      console.error("Module load failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showFatalLoadError(error?.message || "Could not load modules.");
      return;
    }

    let progressByModule =
      this.getCachedAreaModuleProgress(currentArea, currentLevel) || {};

    if (!this.state.subtopicProgressByArea[areaCacheKey] && modules.length) {
      try {
        const progressEntries = await Promise.all(
          modules.map(async (moduleRecord) => {
            const moduleData = await this.ensureModuleQuizzesLoaded(
              currentArea,
              moduleRecord.name
            );
            return [
              moduleRecord.name,
              this.buildModuleAssessmentSummary({
                moduleData,
                level: currentLevel,
                area: currentArea,
                sub: moduleRecord.name,
              }),
            ];
          })
        );
        progressByModule = Object.fromEntries(progressEntries);
        this.state.subtopicProgressByArea[areaCacheKey] = progressByModule;
        this.scheduleAppDataCacheWrite();
      } catch (error) {
        console.error("Module progress load failed:", error);
        if (await this.handleAccessRestriction(error)) {
          return;
        }
        this.showToast("Could not load module progress.");
        return;
      }
    }

    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

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
        progressByModule[moduleRecord.name]
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
    const { currentLevel, currentArea, currentSub } = this.state;
    if (!currentLevel || !currentArea || !currentSub) {
      this.navigate("subtopics", { level: currentLevel, area: currentArea });
      return;
    }

    if (
      !this.hasAreaModulesCached(currentLevel, currentArea) ||
      !this.hasModuleQuizzesCached(currentLevel, currentArea, currentSub)
    ) {
      this.showLoadingView();
    }

    let moduleData;
    try {
      await this.ensureAreaModulesLoaded(currentArea);
      moduleData = await this.ensureModuleQuizzesLoaded(
        currentArea,
        currentSub
      );
    } catch (error) {
      console.error("Quiz type summary load failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showFatalLoadError(error?.message || "Could not load quiz types.");
      return;
    }

    const formatCards = [{ type: "sba" }, { type: "tf" }];

    const allQuizzes = formatCards.flatMap(({ type }) =>
      Object.entries(moduleData?.[type] || {}).map(([title, quiz]) => ({
        ...quiz,
        title,
        type,
      }))
    );

    const totalQuestions = allQuizzes.reduce(
      (sum, quiz) => sum + Number(quiz.count || 0),
      0
    );
    const overallAssessmentProgress = this.buildModuleAssessmentSummary({
      moduleData,
      level: currentLevel,
      area: currentArea,
      sub: currentSub,
    });
    const overallCompletePercent = overallAssessmentProgress.totalCount
      ? Math.round(
          (overallAssessmentProgress.doneCount /
            overallAssessmentProgress.totalCount) *
            100
        )
      : 0;

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

    formatCards.forEach(({ type }) => {
      const quizzes = Object.values(moduleData?.[type] || {});
      const quizCount = quizzes.length;
      const questionCount = quizzes.reduce(
        (sum, quiz) => sum + Number(quiz.count || 0),
        0
      );
      const completedCount = new Set(
        quizzes
          .filter((quiz) => this.getAttemptsForQuizId(quiz.id).length)
          .map((quiz) => quiz.id)
      ).size;
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
    });

    this.showOnly("types-view");
  },

  async renderQuizList() {
    const { currentLevel, currentArea, currentSub, currentType } = this.state;
    if (!currentLevel || !currentArea || !currentSub || !currentType) {
      this.navigate("types", {
        level: currentLevel,
        area: currentArea,
        sub: currentSub,
      });
      return;
    }

    if (
      !this.hasAreaModulesCached(currentLevel, currentArea) ||
      !this.hasModuleQuizzesCached(currentLevel, currentArea, currentSub)
    ) {
      this.showLoadingView();
    }

    let moduleData;
    let modules;
    try {
      [modules, moduleData] = await Promise.all([
        this.ensureAreaModulesLoaded(currentArea),
        this.ensureModuleQuizzesLoaded(currentArea, currentSub),
      ]);
    } catch (error) {
      console.error("Quiz list load failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      this.showFatalLoadError(error?.message || "Could not load quizzes.");
      return;
    }

    const meta = this.getTypeMeta(currentType);
    const typePresentation = this.getTypePresentation(currentType);
    const quizzes = Object.entries(moduleData?.[currentType] || {})
      .sort(([titleA], [titleB]) => this.compareDisplayOrder(titleA, titleB))
      .map(([title, quizMeta]) => ({
        ...quizMeta,
        title,
      }));

    const topicIndex =
      Math.max(
        0,
        (modules || []).findIndex(
          (moduleRecord) => moduleRecord.name === currentSub
        )
      ) + 1;

    const completedQuizzes = quizzes
      .map((quizMeta) => ({
        quizMeta,
        attemptStats: this.getAttemptStatsForQuizId(quizMeta.id),
      }))
      .filter((entry) => !!entry.attemptStats);

    const averagePercentage = completedQuizzes.length
      ? Math.round(
          completedQuizzes.reduce((sum, entry) => {
            const preferredAttempt = this.getPreferredAttemptForDisplay(
              entry.attemptStats
            );
            return sum + Number(preferredAttempt?.percentage || 0);
          }, 0) / completedQuizzes.length
        )
      : null;

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
      this.dom.quizListCompletedCount.textContent = String(
        completedQuizzes.length
      );
      this.dom.quizListCompletedCount.classList.toggle(
        "good",
        completedQuizzes.length > 0
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
      const attemptStats = this.getAttemptStatsForQuizId(quizMeta.id);
      const featuredAttempt = this.getPreferredAttemptForDisplay(attemptStats);
      const isDone = !!attemptStats;
      const totalAttempts = Number(attemptStats?.totalAttempts || 0);
      const questionCount = Number(quizMeta.count || 0);
      const percentage = Number(featuredAttempt?.percentage || 0);
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
      row.onclick = () => this.navigate("setup", { quizId: quizMeta.id });
      row.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.navigate("setup", { quizId: quizMeta.id });
        }
      };
      this.dom.quizList.appendChild(row);
    });

    this.showOnly("quiz-list-view");
  },

  async renderSetup() {
    const quizMeta = this.getCurrentQuizMeta();
    if (!quizMeta) {
      this.navigate("quizzes", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
      });
      return;
    }

    const meta = this.getTypeMeta(this.state.currentType);
    const setupView = document.getElementById("setup-view");
    const questionCount = Number(quizMeta.count || 0);
    const currentModule =
      this.state.quizzesByModule[
        this.getModuleCacheKey(
          this.state.currentLevel,
          this.state.currentArea,
          this.state.currentSub
        )
      ] || {};
    const orderedQuizzes = Object.entries(
      currentModule?.[this.state.currentType] || {}
    )
      .sort(([titleA], [titleB]) => this.compareDisplayOrder(titleA, titleB))
      .map(([title, quiz]) => ({
        ...quiz,
        title,
      }));
    const quizIndex =
      Math.max(
        0,
        orderedQuizzes.findIndex(
          (quiz) =>
            quiz.id === quizMeta.id ||
            quiz.title === this.state.currentQuizTitle
        )
      ) + 1;

    if (setupView) {
      setupView.dataset.type = this.state.currentType;
    }

    document.getElementById("setup-kicker").textContent =
      `Assessment ${quizIndex}`;
    document.getElementById("setup-title").textContent =
      this.state.currentQuizTitle;
    document.getElementById("setup-meta").textContent =
      `${this.state.currentSub} / ${questionCount} question${questionCount === 1 ? "" : "s"}`;
    document.getElementById("setup-question-count").textContent =
      String(questionCount);

    let attemptStats = null;
    try {
      attemptStats = this.getAttemptStatsForQuizId(quizMeta.id);
    } catch (error) {
      console.error("Setup summary load failed:", error);
      attemptStats = null;
    }

    const bestAttempt = this.getPreferredAttemptForDisplay(attemptStats);
    const totalAttempts = Number(attemptStats?.totalAttempts || 0);
    document.getElementById("setup-attempt-count").textContent =
      String(totalAttempts);
    document.getElementById("setup-best-score").textContent = bestAttempt
      ? `${bestAttempt.percentage}%`
      : "--";
    document.getElementById("setup-study-action-label").textContent =
      attemptStats?.study?.attempts ? "Continue" : "Fresh start";
    document.getElementById("setup-exam-action-label").textContent =
      attemptStats?.exam?.attempts ? "Try again" : "Timed pass";
    document.getElementById("setup-study-note").textContent =
      "Untimed practice with no negative marking. Reset freely and build recall.";
    document.getElementById("setup-exam-note").textContent =
      "Strictly timed with negative marking (-1 per wrong answer) for a realistic rehearsal.";

    this.showOnly("setup-view");
  },

  async renderQuiz() {
    this.showLoadingView();
    this.stopQuizCountdown();
    const baseQuestions = await this.fetchQuestionsForCurrentQuiz();
    const savedDraft = this.loadSavedQuizDraft();
    const questions = this.getQuizSessionQuestions(baseQuestions, savedDraft);
    const restoreDraft = this.getQuizDraftForRestore(savedDraft, questions);

    if (!questions.length) {
      this.navigate("setup", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
        title: this.state.currentQuizTitle,
      });
      return;
    }

    this.state.activeQuestions = questions;
    this.showOnly("quiz-view");

    const typeMeta = this.getTypeMeta(this.state.currentType);
    const modeText = this.state.mode === "exam" ? "Exam Mode" : "Study Mode";
    const modeStatText = this.state.mode === "exam" ? "Exam" : "Study";
    const currentModule =
      this.state.quizzesByModule[
        this.getModuleCacheKey(
          this.state.currentLevel,
          this.state.currentArea,
          this.state.currentSub
        )
      ] || {};
    const orderedQuizzes = Object.entries(
      currentModule?.[this.state.currentType] || {}
    )
      .sort(([titleA], [titleB]) => this.compareDisplayOrder(titleA, titleB))
      .map(([title, quiz]) => ({
        ...quiz,
        title,
      }));
    const quizIndex =
      Math.max(
        0,
        orderedQuizzes.findIndex(
          (quiz) =>
            quiz.id === this.state.currentQuizId ||
            quiz.title === this.state.currentQuizTitle
        )
      ) + 1;
    const quizView = document.getElementById("quiz-view");
    if (quizView) {
      quizView.dataset.type = this.state.currentType;
      quizView.dataset.mode = this.state.mode;
    }

    document.getElementById("quiz-mode-badge").textContent =
      `${typeMeta.label.toUpperCase()} \u00b7 ${modeText.toUpperCase()}`;
    if (this.dom.quizPageKicker) {
      this.dom.quizPageKicker.textContent = `ASSESSMENT ${quizIndex}`;
    }
    document.getElementById("quiz-page-title").textContent =
      this.state.currentQuizTitle;
    document.getElementById("quiz-page-meta").innerHTML =
      `<span>${this.escapeHtml(this.state.currentLevel)}</span> &middot; ${this.escapeHtml(this.state.currentArea)} &middot; ${this.escapeHtml(this.state.currentSub)}`;
    if (this.dom.quizModeStat) {
      this.dom.quizModeStat.textContent =
        this.state.mode === "exam" && this.state.currentExamDurationMinutes
          ? `${this.state.currentExamDurationMinutes} min`
          : modeStatText;
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
              <span class="q-type-badge">${modeText.toUpperCase()}</span>
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
    this.startQuizCountdown();
  },

  renderResults() {
    this.stopResultsStickyObserver?.();
    this.showOnly("results-view");
    const resultsView = document.getElementById("results-view");
    if (resultsView) {
      resultsView.dataset.type = this.state.currentType || "sba";
      resultsView.dataset.mode = this.state.mode || "study";
    }
    if (this.dom.toggleReviewWrongBtn) {
      this.dom.toggleReviewWrongBtn.hidden = true;
    }
    const restored = this.renderResultsSnapshot(this.loadSavedQuizResult());
    if (!restored) {
      this.state.currentResultsSnapshot = null;
      this.navigate("setup", {
        level: this.state.currentLevel,
        area: this.state.currentArea,
        sub: this.state.currentSub,
        type: this.state.currentType,
        title: this.state.currentQuizTitle,
      });
      return;
    }
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
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
        snapshot?.mode === "exam"
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
            <span class="verdict-badge correct">ALL CLEAR</span>
          </div>
          <p class="review-stem">Nothing missed in this attempt.</p>
          <div class="explanation">
            <div class="explanation-label">NEXT STEP</div>
            <p class="explanation-text">You do not have any wrong or unanswered questions to review here. Move on, or retry for another clean run.</p>
          </div>
        </div>
      </article>
    `;
  },

  buildResultReviewCardMarkup(item) {
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
    const badgeText =
      item.statusClass === "notsure"
        ? "UNANSWERED (0)"
        : this.escapeHtml(String(item.statusText || "").toUpperCase());
    const answerGrid =
      item.statusClass === "correct"
        ? `
          <div class="answer-grid single">
            <div class="answer-chip your">
              <span class="chip-label">Your answer</span>
              <span class="chip-val">${this.escapeHtml(item.userAnswer)}</span>
            </div>
          </div>
        `
        : `
          <div class="answer-grid">
            <div class="answer-chip ${item.statusClass === "notsure" ? "yours-unsure" : "yours-wrong"}">
              <span class="chip-label">Your answer</span>
              <span class="chip-val">${this.escapeHtml(item.userAnswer)}</span>
            </div>
            <div class="answer-chip correct-ans">
              <span class="chip-label">Correct</span>
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
          <div class="explanation">
            <div class="explanation-label">Explanation</div>
            <p class="explanation-text">${this.escapeHtml(item.explanation || "No explanation provided.")}</p>
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
    if (userAns === "NS") return "Not sure / Not answered";
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

    const stats =
      this.state.userStats || this.buildUserStats(this.state.attempts || []);

    this.showOnly("account-view");
    const displayName = this.getDisplayNameForUser(this.state.currentUser);
    this.dom.accountPageTitle.textContent = `${displayName}'s Account`;
    this.dom.accountPageSubtitle.textContent =
      "Your key stats, overall performance, and course-by-course results";

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
        label: "Overall Average",
        value: `${stats.averagePercentage}%`,
        note: "Across all saved quiz attempts",
      },
      {
        label: "Best Score",
        value: this.formatAttemptScore(stats.bestAttempt),
        note: stats.bestAttempt
          ? `${this.formatModeLabel(stats.bestAttempt.mode)} mode`
          : "No attempts",
      },
    ]
      .map(
        (card) => `
      <div class="account-stat-card">
        <span class="account-stat-label">${this.escapeHtml(card.label)}</span>
        <span class="account-stat-value">${this.escapeHtml(card.value)}</span>
        <span class="account-stat-note">${this.escapeHtml(card.note)}</span>
      </div>
    `
      )
      .join("");

    this.dom.accountModeGrid.innerHTML = ["study", "exam"]
      .map((mode) => {
        const modeStats = stats.modeStats[mode];
        return `
        <div class="account-stat-card">
          <span class="account-stat-label">${this.escapeHtml(this.formatModeLabel(mode))} Mode</span>
          <span class="account-stat-value">${modeStats.averagePercentage}%</span>
          <span class="account-stat-note">${modeStats.attemptsCount} attempt${modeStats.attemptsCount === 1 ? "" : "s"}</span>
        </div>
      `;
      })
      .join("");

    this.dom.accountCourseGrid.innerHTML = stats.courseStats
      .map(
        (course) => `
      <div class="account-course-card">
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
        const sub = attempt.sub || quiz?.sub || "Unknown module";
        return `
        <div class="account-recent-card">
          <div class="account-recent-head">
            <div>
              <h3 class="account-recent-title">${this.escapeHtml(title)}</h3>
              <p class="account-recent-meta">${this.escapeHtml(area)} - ${this.escapeHtml(sub)} - ${this.escapeHtml(this.formatModeLabel(attempt.mode))}</p>
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

    let access;
    try {
      access = await this.loadAccessStatus();
    } catch (error) {
      console.error("Settings access load failed:", error);
      if (await this.handleAccessRestriction(error)) {
        return;
      }
      access = this.state.accessStatus || {};
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
      if (this.state.mode === "study") {
        const confirmed = await confirmDialog({
          title: "Submit incomplete quiz",
          message: `${unansweredQuestions} unanswered question${unansweredQuestions === 1 ? "" : "s"} remaining. Submit anyway?`,
          submitLabel: "Submit anyway",
          cancelLabel: "Keep answering",
        });
        if (!confirmed) return;
      } else {
        await confirmDialog({
          title: "Finish exam before submitting",
          message: `${unansweredQuestions} unanswered question${unansweredQuestions === 1 ? "" : "s"} remaining. You need to finish every question before you can submit in exam mode.`,
          submitLabel: "Continue quiz",
          cancelLabel: "Close",
        });
        return;
      }
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
      const negativeMarking = this.state.mode === "exam";
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
        Number(this.getAttemptStatsForQuizId(quizMeta.id)?.totalAttempts || 0)
      );
      this.clearQuizDraft();
      this.saveQuizResultSnapshot(resultsSnapshot);

      this.navigate("results", {
        quizId: quizMeta.id,
        mode: this.state.mode,
        duration:
          this.state.mode === "exam"
            ? this.state.currentExamDurationMinutes
            : "",
      });
    } finally {
      this.quizSubmissionInFlight = false;
    }
  },
};
