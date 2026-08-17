import {
  fetchPastPaperAttemptReview,
  fetchPastPaperExams,
  fetchPastPaperTopics,
  fetchPastPaperYears,
  submitPastPaperAttempt,
} from "../../services/past-paper-service.js";
import { confirmDialog, quizSettingsDialog } from "../../ui/dialog.js";

const PAST_PAPER_GROUP = "Past Papers";
const PAST_PAPER_DISPLAY_LABEL = "Exams";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function boolToAnswer(value) {
  return value === true ? "True" : value === false ? "False" : "Not sure";
}

export const pastPaperApp = {
  pastPaperCountdownInterval: null,
  pastPaperCountdownDeadline: 0,

  resetPastPaperState() {
    this.state.pastPapers = {
      years: [],
      yearsLoaded: false,
      topicsByYear: {},
      examsByTopic: {},
      unitsBySetId: {},
      reviewsByAttemptId: {},
      currentYear: "",
      currentTopic: "",
      currentSetId: "",
      currentAttemptId: "",
      durationMinutes: null,
      negativeMarking: false,
      timeRemainingSeconds: null,
      activeUnits: [],
      activeExam: null,
    };
  },

  getPastPaperState() {
    if (!this.state.pastPapers) {
      this.resetPastPaperState();
    }
    return this.state.pastPapers;
  },

  getPastPaperYearKey(yearLabel) {
    return normalizeText(yearLabel).toLowerCase();
  },

  getPastPaperTopicKey(yearLabel, topicLabel) {
    return `${this.getPastPaperYearKey(yearLabel)}::${normalizeText(topicLabel).toLowerCase()}`;
  },

  getPastPaperYearSummary(yearLabel) {
    const key = this.getPastPaperYearKey(yearLabel);
    return (
      this.getPastPaperState().years.find(
        (row) => this.getPastPaperYearKey(row.yearLabel) === key
      ) || null
    );
  },

  hasPastPapersForYear(yearLabel) {
    return !!this.getPastPaperYearSummary(yearLabel)?.examCount;
  },

  normalizePastPaperYearRows(rows) {
    return (rows || [])
      .map((row) => ({
        yearLabel: normalizeText(row.year_label),
        paperGroupLabel:
          normalizeText(row.paper_group_label) || PAST_PAPER_GROUP,
        topicCount: Number(row.topic_count || 0),
        examCount: Number(row.exam_count || 0),
        unitCount: Number(row.unit_count || 0),
        totalMarks: Number(row.total_marks || 0),
        attemptCount: Number(row.attempt_count || 0),
        bestPercentage: Number(row.best_percentage || 0),
      }))
      .filter((row) => row.yearLabel && row.examCount > 0)
      .sort((a, b) => this.compareDisplayOrder(a.yearLabel, b.yearLabel));
  },

  normalizePastPaperTopicRows(rows) {
    return (rows || [])
      .map((row) => ({
        yearLabel: normalizeText(row.year_label),
        paperGroupLabel:
          normalizeText(row.paper_group_label) || PAST_PAPER_GROUP,
        topicLabel: normalizeText(row.topic_label),
        examCount: Number(row.exam_count || 0),
        unitCount: Number(row.unit_count || 0),
        totalMarks: Number(row.total_marks || 0),
        attemptCount: Number(row.attempt_count || 0),
        bestPercentage: Number(row.best_percentage || 0),
      }))
      .filter((row) => row.topicLabel && row.examCount > 0)
      .sort((a, b) => this.compareDisplayOrder(a.topicLabel, b.topicLabel));
  },

  normalizePastPaperExamRows(rows) {
    return (rows || [])
      .map((row) => ({
        setId: row.set_id,
        title: normalizeText(row.title),
        yearLabel: normalizeText(row.year_label),
        paperGroupLabel:
          normalizeText(row.paper_group_label) || PAST_PAPER_GROUP,
        topicLabel: normalizeText(row.topic_label),
        unitCount: Number(row.unit_count || 0),
        totalMarks: Number(row.total_marks || 0),
        attemptCount: Number(row.attempt_count || 0),
        bestPercentage: Number(row.best_percentage || 0),
        latestPercentage: Number(row.latest_percentage || 0),
      }))
      .filter((row) => row.setId && row.title)
      .sort((a, b) => this.compareDisplayOrder(a.title, b.title));
  },

  normalizePastPaperUnitRows(rows) {
    return (rows || [])
      .map((row) => {
        const branches = (Array.isArray(row.branches) ? row.branches : [])
          .map((branch) => ({
            ...branch,
            order: Number(branch?.order || 0),
            prompt: normalizeText(branch?.prompt),
            imageUrl: normalizeText(branch?.imageUrl),
          }))
          .filter(
            (branch) =>
              branch.branchId &&
              branch.prompt &&
              branch.order >= 1 &&
              branch.order <= 5
          )
          .sort((a, b) => a.order - b.order);
        return {
          unitId: row.unit_id,
          stem: normalizeText(row.stem),
          imageUrl: normalizeText(row.image_url),
          displayOrder: Number(row.display_order || 0),
          branches,
        };
      })
      .filter(
        (row) =>
          row.unitId &&
          row.stem &&
          row.branches.length >= 1 &&
          row.branches.length <= 5
      )
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder)
          return a.displayOrder - b.displayOrder;
        return String(a.unitId).localeCompare(String(b.unitId));
      });
  },

  async loadPastPaperYears(force = false) {
    const pastPapers = this.getPastPaperState();
    if (!force && pastPapers.yearsLoaded) return pastPapers.years;

    try {
      const { data, error } = await this.withTimeout(
        fetchPastPaperYears(this.getSupabase()),
        12000,
        "Loading past papers"
      );
      if (error) throw error;
      pastPapers.years = this.normalizePastPaperYearRows(data || []);
      pastPapers.yearsLoaded = true;
      this.scheduleAppDataCacheWrite?.();
      return pastPapers.years;
    } catch (error) {
      if (this.isRpcUnavailable?.(error)) {
        pastPapers.years = [];
        pastPapers.yearsLoaded = true;
        return [];
      }
      throw error;
    }
  },

  async ensurePastPaperTopicsLoaded(yearLabel, force = false) {
    const pastPapers = this.getPastPaperState();
    const key = this.getPastPaperYearKey(yearLabel);
    if (!force && pastPapers.topicsByYear[key])
      return pastPapers.topicsByYear[key];

    const { data, error } = await this.withTimeout(
      fetchPastPaperTopics(this.getSupabase(), yearLabel, PAST_PAPER_GROUP),
      12000,
      "Loading past paper topics"
    );
    if (error) throw error;

    const topics = this.normalizePastPaperTopicRows(data || []);
    pastPapers.topicsByYear[key] = topics;
    this.scheduleAppDataCacheWrite?.();
    return topics;
  },

  async ensurePastPaperExamsLoaded(yearLabel, topicLabel, force = false) {
    const pastPapers = this.getPastPaperState();
    const key = this.getPastPaperTopicKey(yearLabel, topicLabel);
    if (!force && pastPapers.examsByTopic[key])
      return pastPapers.examsByTopic[key];

    const { data, error } = await this.withTimeout(
      fetchPastPaperExams(
        this.getSupabase(),
        yearLabel,
        topicLabel,
        PAST_PAPER_GROUP
      ),
      12000,
      "Loading past paper exams"
    );
    if (error) throw error;

    const exams = this.normalizePastPaperExamRows(data || []);
    pastPapers.examsByTopic[key] = exams;
    this.scheduleAppDataCacheWrite?.();
    return exams;
  },

  async openPastPaperSettings(exam, yearLabel, topicLabel) {
    if (!exam?.setId) return;

    const rememberedSettings = this.getRememberedAssessmentSettings(
      "past_paper",
      exam.setId
    );
    const savedProgress = rememberedSettings
      ? null
      : await this.loadAccountAssessmentProgress("past_paper", exam.setId);
    const settings = await quizSettingsDialog({
      title: exam.title || "Start exam",
      submitLabel: "Start exam",
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
    if (!settings) return;

    const durationMinutes = this.normalizeQuizDurationMinutes(
      settings.durationMinutes
    );
    this.rememberAssessmentSettings("past_paper", exam.setId, {
      durationMinutes,
      negativeMarking: !!settings.negativeMarking,
    });
    await this.navigate("past-paper-session", {
      setId: exam.setId,
      year: yearLabel,
      topic: topicLabel,
      duration: durationMinutes || "",
      negativeMarking: !!settings.negativeMarking,
    });
  },

  buildPastPaperBrowseCard({
    badge,
    title,
    statusLabel = "Open",
    statusClass = "status-fresh",
    metaLabel = "",
    metricValue = "",
    metricLabel = "",
    progressPercent = 0,
    progressLabel = "",
    index = 0,
  }) {
    return this.buildBrowseCardMarkup({
      badge,
      title,
      kickerLabel: "",
      toneClass: this.getBrowseToneClass(index),
      statusLabel,
      statusClass,
      metaKind: "book",
      metaLabel,
      progressPercent,
      progressLabel,
      metricValue,
      metricLabel,
    });
  },

  getPastPaperCompletionPercent(summary) {
    const examCount = Number(summary?.examCount || 0);
    const attemptCount = Number(summary?.attemptCount || 0);
    if (!examCount) return 0;
    return Math.min(100, Math.round((attemptCount / examCount) * 100));
  },

  async renderYearHub() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const yearLabel = normalizeText(this.state.currentLevel);
    if (!yearLabel) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    let normalSummary =
      this.state.homeDashboard?.levelProgressByName?.[yearLabel] || null;
    let pastPaperSummary = this.getPastPaperYearSummary(yearLabel);
    if (!this.homeBootstrapLoadedThisPage) {
      this.showLoadingView();
      try {
        const overview = await this.loadYearOverview(yearLabel);
        normalSummary = overview.normal;
        pastPaperSummary = overview.pastPaper;
      } catch (error) {
        console.error("Year overview load failed:", error);
        if (await this.handleAccessRestriction(error)) return;
        this.showFatalLoadError(error?.message || "Could not load this year.");
        return;
      }
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) {
      return;
    }

    const normalAvailable = !!normalSummary;
    if (!normalAvailable && !pastPaperSummary) {
      await this.navigate("home", {}, { replace: true });
      return;
    }
    const normalProgressPercent = Number(normalSummary?.percent || 0);
    const pastPaperProgressPercent =
      this.getPastPaperCompletionPercent(pastPaperSummary);

    document.getElementById("year-page-title").textContent = yearLabel;
    document.getElementById("year-page-kicker").textContent = "Year";
    document.getElementById("year-page-subtitle").textContent = "";

    const options = [];
    if (normalAvailable) {
      options.push({
        badge: "N",
        title: "Normal Study",
        metaLabel: `${Number(normalSummary?.courseCount || 0)} course${Number(normalSummary?.courseCount || 0) === 1 ? "" : "s"}`,
        metricValue: "",
        metricLabel: "",
        statusLabel: "Courses",
        statusClass: "status-active",
        progressPercent: normalProgressPercent,
        progressLabel: `${normalProgressPercent}% done`,
        onClick: () => {
          this.showLoadingView();
          this.navigate("modules", { level: yearLabel });
        },
      });
    }
    if (pastPaperSummary) {
      options.push({
        badge: "P",
        title: PAST_PAPER_DISPLAY_LABEL,
        metaLabel: `${pastPaperSummary.topicCount} topic${pastPaperSummary.topicCount === 1 ? "" : "s"}`,
        metricValue: String(pastPaperSummary.examCount),
        metricLabel: pastPaperSummary.examCount === 1 ? "exam" : "exams",
        statusLabel: pastPaperSummary.attemptCount ? "Active" : "New",
        statusClass: pastPaperSummary.attemptCount
          ? "status-active"
          : "status-fresh",
        progressPercent: pastPaperProgressPercent,
        progressLabel: `${pastPaperProgressPercent}% done`,
        onClick: () => this.navigate("past-paper-topics", { year: yearLabel }),
      });
    }

    document.getElementById("year-section-count").textContent =
      `${options.length} option${options.length === 1 ? "" : "s"}`;
    this.dom.yearOptionGrid.innerHTML = "";
    options.forEach((option, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "browse-card-button";
      card.innerHTML = this.buildPastPaperBrowseCard({ ...option, index });
      card.onclick = option.onClick;
      this.dom.yearOptionGrid.appendChild(card);
    });

    this.showOnly("year-view");
  },

  async renderPastPaperTopics() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const yearLabel = normalizeText(
      this.state.pastPapers?.currentYear || this.state.currentLevel
    );
    if (!yearLabel) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    this.showLoadingView();
    let topics;
    try {
      const prefetchedTopics =
        this.consumeInitialRoutePrefetch("past-paper-topics");
      topics = await (prefetchedTopics ||
        this.ensurePastPaperTopicsLoaded(yearLabel));
    } catch (error) {
      console.error("Past paper topics load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(
        error?.message || "Could not load past paper topics."
      );
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl)
      return;

    document.getElementById("past-paper-topics-title").textContent =
      PAST_PAPER_GROUP;
    document.getElementById("past-paper-topics-kicker").textContent = yearLabel;
    document.getElementById("past-paper-topics-subtitle").textContent = "";
    document.getElementById("past-paper-topics-count").textContent =
      `${topics.length} topic${topics.length === 1 ? "" : "s"}`;
    this.dom.pastPaperTopicsGrid.innerHTML = "";

    topics.forEach((topic, index) => {
      const topicProgressPercent = this.getPastPaperCompletionPercent(topic);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "browse-card-button";
      card.innerHTML = this.buildPastPaperBrowseCard({
        badge: topic.topicLabel.slice(0, 2).toUpperCase() || `T${index + 1}`,
        title: topic.topicLabel,
        statusLabel: topic.attemptCount ? "Active" : "New",
        statusClass: topic.attemptCount ? "status-active" : "status-fresh",
        metaLabel: `${topic.examCount} exam${topic.examCount === 1 ? "" : "s"}`,
        metricValue: String(topic.totalMarks),
        metricLabel: "marks",
        progressPercent: topicProgressPercent,
        progressLabel: `${topicProgressPercent}% done`,
        index,
      });
      card.onclick = () =>
        this.navigate("past-paper-exams", {
          year: yearLabel,
          topic: topic.topicLabel,
        });
      this.dom.pastPaperTopicsGrid.appendChild(card);
    });

    this.showOnly("past-paper-topics-view");
  },

  async renderPastPaperExams() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const pastPapers = this.getPastPaperState();
    const yearLabel = normalizeText(
      pastPapers.currentYear || this.state.currentLevel
    );
    const topicLabel = normalizeText(
      pastPapers.currentTopic || this.state.currentArea
    );
    if (!yearLabel || !topicLabel) {
      await this.navigate(
        "past-paper-topics",
        { year: yearLabel },
        { replace: true }
      );
      return;
    }

    this.showLoadingView();
    let exams;
    try {
      const prefetchedExams =
        this.consumeInitialRoutePrefetch("past-paper-exams");
      exams = await (prefetchedExams ||
        this.ensurePastPaperExamsLoaded(yearLabel, topicLabel));
    } catch (error) {
      console.error("Past paper exams load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(
        error?.message || "Could not load past paper exams."
      );
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl)
      return;

    document.getElementById("past-paper-exams-title").textContent = topicLabel;
    document.getElementById("past-paper-exams-kicker").textContent =
      `${yearLabel} / ${PAST_PAPER_GROUP}`;
    document.getElementById("past-paper-exams-subtitle").textContent = "";
    document.getElementById("past-paper-exams-count").textContent =
      `${exams.length} exam${exams.length === 1 ? "" : "s"}`;
    this.dom.pastPaperExamsGrid.innerHTML = "";

    exams.forEach((exam, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "quizlist-card";
      card.innerHTML = `
        <div class="quizlist-card-row">
          <span class="quizlist-card-index">${index + 1}</span>
          <div class="quizlist-card-main">
            <div class="quizlist-card-topline">
              <span class="quizlist-card-num">${this.escapeHtml(yearLabel)}</span>
            </div>
            <div class="quizlist-card-title">${this.escapeHtml(exam.title)}</div>
            <div class="quizlist-card-meta">
              <span class="quizlist-card-question-count">${exam.unitCount} question${exam.unitCount === 1 ? "" : "s"}</span>
              <span class="quizlist-card-attempts">${exam.totalMarks} marks</span>
            </div>
          </div>
          <div class="quizlist-card-trailing">
            <div class="quizlist-card-metric">
              <div class="quizlist-card-metric-label">Best</div>
              <div class="quizlist-card-metric-value">${exam.bestPercentage ? `${exam.bestPercentage}%` : "--"}</div>
            </div>
            <span class="quizlist-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
            </span>
          </div>
        </div>
      `;
      card.onclick = () =>
        void this.openPastPaperSettings(exam, yearLabel, topicLabel);
      this.dom.pastPaperExamsGrid.appendChild(card);
    });

    this.showOnly("past-paper-exams-view");
  },

  renderPastPaperUnitMarkup(unit, unitIndex) {
    const markingLabel = this.getPastPaperState().negativeMarking
      ? "NEGATIVE MARKING"
      : "STANDARD MARKING";
    const imageHtml = unit.imageUrl
      ? `
        <div class="question-image-wrap">
          <img class="question-image" src="${this.escapeHtml(unit.imageUrl)}" alt="Stem image ${unitIndex + 1}">
        </div>
      `
      : "";
    const branchRows = unit.branches
      .map((branch) => {
        const branchId = this.escapeHtml(branch.branchId);
        const branchOrder = Number(branch.order || 0);
        const branchLetter = ["a", "b", "c", "d", "e"][branchOrder - 1] || "";
        return `
          <div class="past-paper-branch" data-branch-id="${branchId}">
            <div class="past-paper-branch-copy">
              <span class="past-paper-branch-number">${branchLetter}</span>
              <p class="past-paper-branch-prompt">${this.escapeHtml(branch.prompt)}</p>
            </div>
            <div class="tf-options past-paper-branch-options" role="radiogroup" aria-label="Statement ${branchOrder || ""} answer">
              <label class="quiz-choice tf-btn opt-true" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${branchId}" value="true" data-branch-input="${branchId}">
                <span class="past-paper-option-text">True</span>
              </label>
              <label class="quiz-choice tf-btn opt-false" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${branchId}" value="false" data-branch-input="${branchId}">
                <span class="past-paper-option-text">False</span>
              </label>
              <label class="quiz-choice tf-btn opt-not-sure" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${branchId}" value="not_sure" data-branch-input="${branchId}">
                <span class="past-paper-option-text">Not sure</span>
              </label>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <article class="question-card question-card-tf past-paper-unit-card">
        <div class="question-meta">
          <span class="q-number">QUESTION ${unitIndex + 1}</span>
          <span class="q-type-badge">${unit.branches.length} ${unit.branches.length === 1 ? "MARK" : "MARKS"} · ${markingLabel}</span>
        </div>
        <p class="question-stem">${this.escapeHtml(unit.stem)}</p>
        ${imageHtml}
        <div class="past-paper-branches">${branchRows}</div>
      </article>
    `;
  },

  getPastPaperDraftStorageKey(setId = this.getPastPaperState().currentSetId) {
    return `${this.getStorageNamespace()}:past-paper-draft:${normalizeText(setId)}`;
  },

  isPastPaperDraftForCurrentSettings(draft) {
    if (!draft) return false;
    const pastPapers = this.getPastPaperState();
    const context = draft.context || {};
    return (
      this.normalizeQuizDurationMinutes(
        draft.durationMinutes ?? context.durationMinutes
      ) === this.normalizeQuizDurationMinutes(pastPapers.durationMinutes) &&
      !!(draft.negativeMarking ?? context.negativeMarking) ===
        !!pastPapers.negativeMarking
    );
  },

  async loadPastPaperSessionPage(
    setId = this.getPastPaperState().currentSetId
  ) {
    const normalizedSetId = normalizeText(setId);
    if (!normalizedSetId) return null;
    const pastPapers = this.getPastPaperState();
    this.rememberAssessmentSettings("past_paper", normalizedSetId, {
      durationMinutes: pastPapers.durationMinutes,
      negativeMarking: pastPapers.negativeMarking,
    });
    const progressKey = this.buildAssessmentProgressKey({
      mode: "exam",
      durationMinutes: pastPapers.durationMinutes,
      negativeMarking: pastPapers.negativeMarking,
    });
    const cachedProgress = this.getCachedAssessmentProgress(
      "past_paper",
      normalizedSetId,
      progressKey
    );
    const { data, error } = await this.withTimeout(
      this.getSupabase().rpc("app_past_paper_session", {
        p_set_id: normalizedSetId,
        p_progress_key: cachedProgress.hit ? null : progressKey,
      }),
      12000,
      "Loading past paper exam"
    );
    if (error) throw error;
    if (
      !data ||
      Array.isArray(data) ||
      typeof data !== "object" ||
      Number(data.schemaVersion) !== 1 ||
      !Array.isArray(data.units)
    ) {
      throw new Error("Past paper session returned an invalid response.");
    }

    const paperRow = data.paper;
    if (!paperRow || typeof paperRow !== "object") return null;
    const exam = {
      setId: paperRow.setId || paperRow.set_id || normalizedSetId,
      title: normalizeText(paperRow.title) || "Past Paper",
      yearLabel: normalizeText(paperRow.yearLabel || paperRow.year_label),
      topicLabel: normalizeText(paperRow.topicLabel || paperRow.topic_label),
      paperGroupLabel: normalizeText(
        paperRow.paperGroupLabel || paperRow.paper_group_label
      ),
    };
    const units = this.normalizePastPaperUnitRows(data.units);

    let accountDraft = cachedProgress.value;
    if (!cachedProgress.hit) {
      accountDraft = this.normalizeAccountAssessmentProgress(data.progress);
      this.cacheAssessmentProgress(
        "past_paper",
        normalizedSetId,
        progressKey,
        accountDraft
      );
    }
    const storageKey = this.getPastPaperDraftStorageKey(normalizedSetId);
    const localDraft = this.readStoredJson(storageKey);
    const matchingLocal = this.isPastPaperDraftForCurrentSettings(localDraft)
      ? localDraft
      : null;
    const matchingAccount = this.isPastPaperDraftForCurrentSettings(
      accountDraft
    )
      ? accountDraft
      : null;
    const draft = this.chooseNewestAssessmentDraft(
      matchingLocal,
      matchingAccount
    );
    if (draft === matchingAccount && draft) {
      this.writeStoredJson(storageKey, draft);
    }

    return { exam, units, draft };
  },

  serializePastPaperDraft() {
    const pastPapers = this.getPastPaperState();
    const answers = {};
    this.dom.pastPaperForm
      ?.querySelectorAll("input[data-branch-input]:checked")
      .forEach((input) => {
        answers[input.dataset.branchInput] = input.value;
      });

    return {
      context: {
        year: pastPapers.currentYear,
        topic: pastPapers.currentTopic,
        title: pastPapers.activeExam?.title || "Past Paper",
        mode: "exam",
        durationMinutes: pastPapers.durationMinutes,
        negativeMarking: pastPapers.negativeMarking,
      },
      answers,
      durationMinutes: pastPapers.durationMinutes,
      negativeMarking: pastPapers.negativeMarking,
      timerExpiresAt:
        pastPapers.durationMinutes && this.pastPaperCountdownDeadline
          ? new Date(this.pastPaperCountdownDeadline).toISOString()
          : null,
      savedAt: new Date().toISOString(),
    };
  },

  persistCurrentPastPaperDraft() {
    const setId = normalizeText(this.getPastPaperState().currentSetId);
    if (!setId || !this.dom.pastPaperForm) return;
    const draft = this.serializePastPaperDraft();
    this.writeStoredJson(this.getPastPaperDraftStorageKey(setId), draft);
    void this.saveAccountAssessmentProgress("past_paper", setId, draft);
  },

  restorePastPaperDraftIntoForm(draft) {
    if (!draft?.answers || !this.dom.pastPaperForm) return false;
    let restoredCount = 0;

    Object.entries(draft.answers).forEach(([branchId, value]) => {
      const input = Array.from(
        this.dom.pastPaperForm.querySelectorAll("input[data-branch-input]")
      ).find(
        (candidate) =>
          candidate.dataset.branchInput === branchId &&
          candidate.value === String(value)
      );
      if (!input) return;
      input.checked = true;
      input.closest("[data-quiz-choice]")?.classList.add("selected");
      restoredCount += 1;
    });

    return restoredCount > 0;
  },

  clearPastPaperDraft(setId = this.getPastPaperState().currentSetId) {
    const normalizedSetId = normalizeText(setId);
    if (!normalizedSetId) return Promise.resolve();
    this.removeStoredJson(this.getPastPaperDraftStorageKey(normalizedSetId));
    return this.clearAccountAssessmentProgress("past_paper", normalizedSetId, {
      mode: "exam",
      durationMinutes: this.getPastPaperState().durationMinutes,
      negativeMarking: this.getPastPaperState().negativeMarking,
    });
  },

  stopPastPaperCountdown() {
    if (this.pastPaperCountdownInterval) {
      window.clearInterval(this.pastPaperCountdownInterval);
      this.pastPaperCountdownInterval = null;
    }
    this.pastPaperCountdownDeadline = 0;
  },

  updatePastPaperTimerUI() {
    const pastPapers = this.getPastPaperState();
    const durationMinutes = this.normalizeQuizDurationMinutes(
      pastPapers.durationMinutes
    );
    if (!durationMinutes) return;

    const remainingSeconds =
      Number.isFinite(pastPapers.timeRemainingSeconds) &&
      pastPapers.timeRemainingSeconds !== null
        ? pastPapers.timeRemainingSeconds
        : durationMinutes * 60;
    const progressCopy = document.getElementById("past-paper-progress-copy");
    if (progressCopy) {
      progressCopy.textContent = this.formatQuizTimer(remainingSeconds);
    }
  },

  startPastPaperCountdown(savedDraft = null) {
    this.stopPastPaperCountdown();
    const pastPapers = this.getPastPaperState();
    const durationMinutes = this.normalizeQuizDurationMinutes(
      pastPapers.durationMinutes
    );
    if (!durationMinutes) return;

    pastPapers.durationMinutes = durationMinutes;
    const savedDeadline = Date.parse(savedDraft?.timerExpiresAt || "");
    this.pastPaperCountdownDeadline = Number.isFinite(savedDeadline)
      ? savedDeadline
      : Date.now() + durationMinutes * 60 * 1000;
    pastPapers.timeRemainingSeconds = Math.max(
      0,
      Math.ceil((this.pastPaperCountdownDeadline - Date.now()) / 1000)
    );
    this.updatePastPaperTimerUI();

    if (pastPapers.timeRemainingSeconds <= 0) {
      window.setTimeout(() => {
        this.showToast("Time is up. Past paper submitted automatically.");
        void this.handlePastPaperSubmission({ force: true, timedOut: true });
      }, 0);
      return;
    }

    this.pastPaperCountdownInterval = window.setInterval(async () => {
      if (window.location.pathname !== "/past-papers/session/") {
        this.stopPastPaperCountdown();
        return;
      }

      const nextRemaining = Math.max(
        0,
        Math.ceil((this.pastPaperCountdownDeadline - Date.now()) / 1000)
      );
      pastPapers.timeRemainingSeconds = nextRemaining;
      this.updatePastPaperTimerUI();
      if (nextRemaining > 0) return;

      this.stopPastPaperCountdown();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      this.showToast("Time is up. Past paper submitted automatically.");
      await this.handlePastPaperSubmission({ force: true, timedOut: true });
    }, 250);
  },

  async renderPastPaperSession() {
    const routeUrl = `${window.location.pathname}${window.location.search}`;
    const pastPapers = this.getPastPaperState();
    const setId = normalizeText(pastPapers.currentSetId);
    if (!setId) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    this.showLoadingView();
    let session;
    try {
      const prefetchedSession =
        this.consumeInitialRoutePrefetch("past-paper-session");
      session = await (prefetchedSession ||
        this.loadPastPaperSessionPage(setId));
    } catch (error) {
      console.error("Past paper exam load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(
        error?.message || "Could not load this past paper."
      );
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl)
      return;

    if (!session) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    const { exam, units, draft: savedDraft } = session;
    pastPapers.currentYear = exam.yearLabel || pastPapers.currentYear;
    pastPapers.currentTopic = exam.topicLabel || pastPapers.currentTopic;
    pastPapers.activeExam = exam;
    pastPapers.activeUnits = units;
    pastPapers.unitsBySetId[setId] = units;

    const totalMarks = units.reduce(
      (sum, unit) => sum + unit.branches.length,
      0
    );
    const timerText = pastPapers.durationMinutes
      ? `${pastPapers.durationMinutes} min`
      : "No time";
    this.showOnly("past-paper-session-view");
    const sessionView = document.getElementById("past-paper-session-view");
    if (sessionView) {
      sessionView.dataset.negativeMarking = pastPapers.negativeMarking
        ? "true"
        : "false";
    }
    document.getElementById("past-paper-mode-badge").textContent =
      `PAST PAPER · ${timerText.toUpperCase()}`;
    document.getElementById("past-paper-page-kicker").textContent =
      `${exam.yearLabel || pastPapers.currentYear} / ${exam.topicLabel || pastPapers.currentTopic} / ${exam.title}`;
    document.getElementById("past-paper-page-title").textContent = "";
    document.getElementById("past-paper-page-meta").textContent = "";
    document.getElementById("past-paper-total-count").textContent =
      String(totalMarks);
    document.getElementById("past-paper-unit-count").textContent = String(
      units.length
    );
    document.getElementById("past-paper-answered-count").textContent = "0";
    document.getElementById("past-paper-progress-count").textContent =
      `0 / ${totalMarks}`;
    document.getElementById("past-paper-progress-fill").style.width = "0%";
    document.getElementById("past-paper-progress-copy").textContent =
      `0/${totalMarks} answered`;
    this.dom.pastPaperSubmitBtn.disabled = totalMarks === 0;
    this.dom.pastPaperForm.innerHTML = units
      .map((unit, index) => this.renderPastPaperUnitMarkup(unit, index))
      .join("");
    this.dom.pastPaperForm.onsubmit = (event) => {
      event.preventDefault();
    };

    this.dom.pastPaperForm.onchange = (event) => {
      const input = event.target.closest?.('input[type="radio"]');
      if (!input) return;
      this.dom.pastPaperForm
        .querySelectorAll(`input[name="${input.name}"]`)
        .forEach((radio) => {
          radio.closest("[data-quiz-choice]")?.classList.remove("selected");
        });
      input.closest("[data-quiz-choice]")?.classList.add("selected");
      this.updatePastPaperProgressUI();
      this.persistCurrentPastPaperDraft();
    };

    this.dom.pastPaperSubmitBtn.onclick = () => {
      void this.handlePastPaperSubmission();
    };

    if (this.restorePastPaperDraftIntoForm(savedDraft)) {
      this.showToast("Restored your saved exam progress.");
    }
    this.updatePastPaperProgressUI();
    this.startPastPaperCountdown(savedDraft);
    this.writeStoredJson(
      this.getPastPaperDraftStorageKey(setId),
      this.serializePastPaperDraft()
    );
  },

  getPastPaperAnswerMap() {
    const answers = {};
    this.dom.pastPaperForm
      ?.querySelectorAll("input[data-branch-input]:checked")
      .forEach((input) => {
        if (input.value === "not_sure") return;
        answers[input.dataset.branchInput] = input.value;
      });
    return answers;
  },

  getPastPaperSelectedCount() {
    return (
      this.dom.pastPaperForm?.querySelectorAll(
        "input[data-branch-input]:checked"
      ).length || 0
    );
  },

  updatePastPaperProgressUI() {
    const total = this.getPastPaperState().activeUnits.reduce(
      (sum, unit) => sum + unit.branches.length,
      0
    );
    const answered = this.getPastPaperSelectedCount();
    const percent = total ? Math.round((answered / total) * 100) : 0;

    document.getElementById("past-paper-answered-count").textContent =
      String(answered);
    document.getElementById("past-paper-progress-count").textContent =
      `${answered} / ${total}`;
    document.getElementById("past-paper-progress-fill").style.width =
      `${percent}%`;
    if (this.getPastPaperState().durationMinutes) {
      this.updatePastPaperTimerUI();
    } else {
      document.getElementById("past-paper-progress-copy").textContent =
        `${answered}/${total} answered`;
    }
    if (this.dom.pastPaperSubmitBtn) {
      this.dom.pastPaperSubmitBtn.disabled = total === 0;
    }
  },

  async handlePastPaperSubmission({ force = false, timedOut = false } = {}) {
    const pastPapers = this.getPastPaperState();
    const setId = normalizeText(pastPapers.currentSetId);
    if (!setId || this.pastPaperSubmissionInFlight) return;
    const total = pastPapers.activeUnits.reduce(
      (sum, unit) => sum + unit.branches.length,
      0
    );
    const answered = this.getPastPaperSelectedCount();
    const unanswered = Math.max(0, total - answered);
    if (unanswered > 0 && !force) {
      const confirmed = await confirmDialog({
        title: "Submit incomplete exam",
        message: `${unanswered} unanswered branch${unanswered === 1 ? "" : "es"} remaining. Submit anyway?`,
        submitLabel: "Submit anyway",
        cancelLabel: "Keep answering",
      });
      if (!confirmed) return;
    }

    this.pastPaperSubmissionInFlight = true;
    this.stopPastPaperCountdown();
    if (this.dom.pastPaperSubmitBtn)
      this.dom.pastPaperSubmitBtn.disabled = true;

    try {
      const { data, error } = await this.withTimeout(
        submitPastPaperAttempt(
          this.getSupabase(),
          setId,
          this.getPastPaperAnswerMap(),
          {
            durationMinutes: pastPapers.durationMinutes,
            negativeMarking: pastPapers.negativeMarking,
            timedOut,
          }
        ),
        12000,
        "Submitting past paper"
      );
      if (error) throw error;

      const attemptId = data?.attemptId || data?.attempt_id;
      await this.clearPastPaperDraft(setId);
      this.getPastPaperState().reviewsByAttemptId = {};
      this.invalidatePastPaperDerivedCaches?.();
      this.invalidateHomeDashboardData?.();
      await this.navigate("past-paper-review", {
        attemptId,
        duration: pastPapers.durationMinutes || "",
        negativeMarking: pastPapers.negativeMarking,
        timedOut,
      });
    } catch (error) {
      console.error("Past paper submission failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showToast(error?.message || "Could not submit past paper.");
      this.updatePastPaperProgressUI();
    } finally {
      this.pastPaperSubmissionInFlight = false;
    }
  },

  async loadPastPaperAttemptReview(attemptId) {
    const normalizedAttemptId = normalizeText(attemptId);
    if (!normalizedAttemptId) return null;
    const pastPapers = this.getPastPaperState();
    let review = pastPapers.reviewsByAttemptId[normalizedAttemptId] || null;
    if (!review) {
      const { data, error } = await this.withTimeout(
        fetchPastPaperAttemptReview(this.getSupabase(), normalizedAttemptId),
        12000,
        "Loading past paper review"
      );
      if (error) throw error;
      review = data || {};
      pastPapers.reviewsByAttemptId[normalizedAttemptId] = review;
    }

    return review;
  },

  async renderPastPaperReview() {
    const pastPapers = this.getPastPaperState();
    const attemptId = normalizeText(pastPapers.currentAttemptId);
    if (!attemptId) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    this.showLoadingView();
    let review;
    try {
      const prefetchedReview =
        this.consumeInitialRoutePrefetch("past-paper-review");
      review = await (prefetchedReview ||
        this.loadPastPaperAttemptReview(attemptId));
    } catch (error) {
      console.error("Past paper review load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(
        error?.message || "Could not load past paper review."
      );
      return;
    }

    const attempt = review.attempt || {};
    const units = Array.isArray(review.units) ? review.units : [];
    const setId = normalizeText(attempt.setId || attempt.set_id || "");
    if (setId) {
      pastPapers.currentSetId = setId;
      pastPapers.currentYear =
        normalizeText(attempt.yearLabel || attempt.year_label) ||
        pastPapers.currentYear;
      pastPapers.currentTopic =
        normalizeText(attempt.topicLabel || attempt.topic_label) ||
        pastPapers.currentTopic;
      pastPapers.activeExam = {
        setId,
        title:
          normalizeText(
            attempt.title || attempt.quizTitle || attempt.quiz_title
          ) || "Past Paper",
        yearLabel: pastPapers.currentYear,
        topicLabel: pastPapers.currentTopic,
      };
    }
    this.showOnly("past-paper-review-view");
    document.getElementById("past-paper-review-title").textContent =
      "Past Paper Result";
    document.getElementById("past-paper-review-kicker").textContent =
      "Attempt result";
    const storedScore = Number(attempt.score || 0);
    const totalMarks = Number(attempt.totalMarks || 0);
    const correct = Number(attempt.correct || 0);
    const wrong = Number(attempt.wrong || 0);
    const unanswered = Number(attempt.unanswered || 0);
    const hasPersistedSettings =
      typeof attempt.negativeMarking === "boolean" ||
      typeof attempt.negative_marking === "boolean";
    const negativeMarking = hasPersistedSettings
      ? attempt.negativeMarking === true || attempt.negative_marking === true
      : pastPapers.negativeMarking;
    const durationMinutes = hasPersistedSettings
      ? Number(attempt.durationMinutes || attempt.duration_minutes || 0)
      : Number(pastPapers.durationMinutes || 0);
    pastPapers.negativeMarking = negativeMarking;
    pastPapers.durationMinutes = durationMinutes || null;
    const score =
      !hasPersistedSettings && negativeMarking ? correct - wrong : storedScore;
    document.getElementById("past-paper-review-score").textContent =
      `${score}/${totalMarks}`;
    const percentage =
      !hasPersistedSettings && negativeMarking
        ? Math.round((Math.max(score, 0) / Math.max(totalMarks, 1)) * 100)
        : Number(attempt.percentage || 0);
    const percentNode = document.getElementById("past-paper-review-percent");
    percentNode.textContent = `${percentage}%`;
    percentNode.className = `results-score-pct ${this.getResultsPercentageTone?.(percentage) || "poor"}`;
    document.getElementById("past-paper-review-correct").textContent =
      String(correct);
    document.getElementById("past-paper-review-wrong").textContent =
      String(wrong);
    document.getElementById("past-paper-review-unanswered").textContent =
      String(unanswered);
    this.updatePastPaperReviewSegments(correct, wrong, unanswered, totalMarks);
    document.getElementById("past-paper-review-count").textContent =
      `${units.length} ${units.length === 1 ? "question" : "questions"}`;
    this.dom.pastPaperReviewList.innerHTML = units
      .map((unit, unitIndex) => this.renderPastPaperReviewUnit(unit, unitIndex))
      .join("");
    this.bindPastPaperReviewActions();
  },

  updatePastPaperReviewSegments(correct, wrong, unanswered, totalMarks) {
    const total = Number(totalMarks || 0);
    const setWidth = (id, value) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.style.width = total
        ? `${Math.max(0, (Number(value || 0) / total) * 100)}%`
        : "0%";
    };
    setWidth("past-paper-review-correct-segment", correct);
    setWidth("past-paper-review-wrong-segment", wrong);
    setWidth("past-paper-review-unanswered-segment", unanswered);
  },

  bindPastPaperReviewActions() {
    const retryButton = document.getElementById("btn-retry-past-paper");
    const backButton = document.getElementById("btn-past-paper-back-list");
    const pastPapers = this.getPastPaperState();
    if (retryButton) {
      retryButton.onclick = () => {
        const setId = normalizeText(pastPapers.currentSetId);
        if (!setId) {
          this.navigate("past-paper-topics", {
            year: pastPapers.currentYear || this.state.currentLevel,
          });
          return;
        }
        this.navigate("past-paper-session", {
          setId,
          year: pastPapers.currentYear || this.state.currentLevel,
          topic: pastPapers.currentTopic || this.state.currentArea,
          duration: pastPapers.durationMinutes || "",
          negativeMarking: pastPapers.negativeMarking,
        });
      };
    }
    if (backButton) {
      backButton.onclick = () => {
        const year = pastPapers.currentYear || this.state.currentLevel;
        const topic = pastPapers.currentTopic || this.state.currentArea;
        if (year && topic) {
          this.navigate("past-paper-exams", { year, topic });
          return;
        }
        this.navigate("past-paper-topics", { year });
      };
    }
  },

  renderPastPaperReviewUnit(unit, unitIndex) {
    const branches = Array.isArray(unit.branches) ? unit.branches : [];
    const correct = branches.filter((branch) => branch.isCorrect).length;
    return `
      <section class="past-paper-review-question ${correct === branches.length ? "is-correct" : "is-mixed"}" aria-label="Question ${unitIndex + 1}">
        <div class="past-paper-review-question-head">
          <span class="review-q-num">QUESTION ${unitIndex + 1}</span>
          <span class="q-type-badge">${branches.length} ${branches.length === 1 ? "MARK" : "MARKS"}</span>
        </div>
        <p class="past-paper-review-parent">${this.escapeHtml(unit.stem || "")}</p>
        <div class="past-paper-review-scoreline">
          <span class="verdict-badge ${correct === branches.length ? "correct" : "wrong"}">${correct}/${branches.length} CORRECT</span>
        </div>
        <div class="past-paper-review-branches">
          ${branches
            .map((branch) => this.renderPastPaperReviewBranch(branch))
            .join("")}
        </div>
      </section>
    `;
  },

  renderPastPaperReviewBranch(branch) {
    const branchOrder = Number(branch.order || 0);
    const branchLetter = ["a", "b", "c", "d", "e"][branchOrder - 1] || "";
    const isUnanswered =
      branch.userAnswer !== true && branch.userAnswer !== false;
    const cardClass = branch.isCorrect
      ? "is-correct"
      : isUnanswered
        ? "is-unsure"
        : "is-wrong";
    const verdictClass = branch.isCorrect
      ? "correct"
      : isUnanswered
        ? "unsure"
        : "wrong";
    const verdictText = branch.isCorrect
      ? "Correct (+1)"
      : isUnanswered
        ? "Unanswered (0)"
        : this.getPastPaperState().negativeMarking
          ? "Incorrect (-1)"
          : "Incorrect (0)";
    const explanation = branch.explanation
      ? `
        <div class="explanation past-paper-review-explanation result-explanation" data-open="false" data-hide-label="HIDE EXPLANATION">
          <button class="result-explanation-toggle" type="button" aria-expanded="false">
            <span class="result-explanation-toggle-text">VIEW EXPLANATION</span>
            <span class="result-explanation-chevron" aria-hidden="true"></span>
          </button>
          <div class="result-explanation-panel" aria-hidden="true">
            <div class="result-explanation-inner">
              <p class="explanation-text">${this.escapeHtml(branch.explanation)}</p>
            </div>
          </div>
        </div>
      `
      : "";
    const answerGrid = branch.isCorrect
      ? `
        <div class="answer-grid single">
          <div class="answer-chip your">
            <span class="chip-label">YOUR ANSWER</span>
            <span class="chip-val">${this.escapeHtml(boolToAnswer(branch.userAnswer))}</span>
          </div>
        </div>
      `
      : `
        <div class="answer-grid">
          <div class="answer-chip ${isUnanswered ? "yours-unsure" : "yours-wrong"}">
            <span class="chip-label">YOUR ANSWER</span>
            <span class="chip-val">${this.escapeHtml(boolToAnswer(branch.userAnswer))}</span>
          </div>
          <div class="answer-chip correct-ans">
            <span class="chip-label">CORRECT</span>
            <span class="chip-val">${this.escapeHtml(boolToAnswer(branch.correctAnswer))}</span>
          </div>
        </div>
      `;

    return `
      <article class="past-paper-review-branch ${cardClass}">
        <div class="past-paper-review-branch-head">
          <span class="past-paper-branch-number">${branchLetter}</span>
          <p class="past-paper-review-branch-prompt">${this.escapeHtml(branch.prompt || "")}</p>
        </div>
        <div class="past-paper-review-branch-body">
          <span class="verdict-badge ${verdictClass}">${verdictText}</span>
          ${answerGrid}
          ${explanation}
        </div>
      </article>
    `;
  },
};
