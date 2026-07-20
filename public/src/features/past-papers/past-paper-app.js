import {
  fetchPastPaperAttemptReview,
  fetchPastPaperExams,
  fetchPastPaperTopics,
  fetchPastPaperUnits,
  fetchPastPaperYears,
  submitPastPaperAttempt,
} from "../../services/past-paper-service.js";

const PAST_PAPER_GROUP = "Past Papers";
const PAST_PAPER_DISPLAY_LABEL = "Exams";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function boolToAnswer(value) {
  return value === true ? "True" : value === false ? "False" : "Unanswered";
}

export const pastPaperApp = {
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
        paperGroupLabel: normalizeText(row.paper_group_label) || PAST_PAPER_GROUP,
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
        paperGroupLabel: normalizeText(row.paper_group_label) || PAST_PAPER_GROUP,
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
        paperGroupLabel: normalizeText(row.paper_group_label) || PAST_PAPER_GROUP,
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
      .map((row) => ({
        unitId: row.unit_id,
        stem: normalizeText(row.stem),
        imageUrl: normalizeText(row.image_url),
        displayOrder: Number(row.display_order || 0),
        branches: Array.isArray(row.branches) ? row.branches : [],
      }))
      .filter((row) => row.unitId && row.stem && row.branches.length === 5)
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
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
    if (!force && pastPapers.topicsByYear[key]) return pastPapers.topicsByYear[key];

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
    if (!force && pastPapers.examsByTopic[key]) return pastPapers.examsByTopic[key];

    const { data, error } = await this.withTimeout(
      fetchPastPaperExams(this.getSupabase(), yearLabel, topicLabel, PAST_PAPER_GROUP),
      12000,
      "Loading past paper exams"
    );
    if (error) throw error;

    const exams = this.normalizePastPaperExamRows(data || []);
    pastPapers.examsByTopic[key] = exams;
    this.scheduleAppDataCacheWrite?.();
    return exams;
  },

  async ensurePastPaperUnitsLoaded(setId, force = false) {
    const pastPapers = this.getPastPaperState();
    if (!force && pastPapers.unitsBySetId[setId]) return pastPapers.unitsBySetId[setId];

    const { data, error } = await this.withTimeout(
      fetchPastPaperUnits(this.getSupabase(), setId),
      12000,
      "Loading past paper exam"
    );
    if (error) throw error;

    const units = this.normalizePastPaperUnitRows(data || []);
    pastPapers.unitsBySetId[setId] = units;
    this.scheduleAppDataCacheWrite?.();
    return units;
  },

  findPastPaperExam(setId) {
    const pastPapers = this.getPastPaperState();
    return Object.values(pastPapers.examsByTopic)
      .flat()
      .find((exam) => exam.setId === setId) || pastPapers.activeExam || null;
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
      progressLabel: progressPercent ? `${progressPercent}% best` : "",
      metricValue,
      metricLabel,
    });
  },

  async renderYearHub() {
    const yearLabel = normalizeText(this.state.currentLevel);
    if (!yearLabel) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    await this.loadPastPaperYears();
    const normalAvailable = !!this.state.levelIdByName[yearLabel];
    const pastPaperSummary = this.getPastPaperYearSummary(yearLabel);
    if (!normalAvailable && !pastPaperSummary) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    document.getElementById("year-page-title").textContent = yearLabel;
    document.getElementById("year-page-kicker").textContent = "Year";
    document.getElementById("year-page-subtitle").textContent =
      "Choose the normal study path or full past paper exams.";

    const options = [];
    if (normalAvailable) {
      options.push({
        badge: "N",
        title: "Normal Study",
        metaLabel: `${(this.state.areasByLevel[yearLabel] || []).length} course${(this.state.areasByLevel[yearLabel] || []).length === 1 ? "" : "s"}`,
        metricValue: "",
        metricLabel: "",
        statusLabel: "Courses",
        statusClass: "status-active",
        onClick: () => this.navigate("modules", { level: yearLabel }),
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
        statusClass: pastPaperSummary.attemptCount ? "status-active" : "status-fresh",
        progressPercent: pastPaperSummary.bestPercentage,
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
    const yearLabel = normalizeText(this.state.pastPapers?.currentYear || this.state.currentLevel);
    if (!yearLabel) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    this.showLoadingView();
    let topics;
    try {
      await this.loadPastPaperYears();
      topics = await this.ensurePastPaperTopicsLoaded(yearLabel);
    } catch (error) {
      console.error("Past paper topics load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(error?.message || "Could not load past paper topics.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) return;

    document.getElementById("past-paper-topics-title").textContent =
      PAST_PAPER_DISPLAY_LABEL;
    document.getElementById("past-paper-topics-kicker").textContent = yearLabel;
    document.getElementById("past-paper-topics-subtitle").textContent =
      "Select a topic to see available full exams.";
    document.getElementById("past-paper-topics-count").textContent =
      `${topics.length} topic${topics.length === 1 ? "" : "s"}`;
    this.dom.pastPaperTopicsGrid.innerHTML = "";

    topics.forEach((topic, index) => {
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
        progressPercent: topic.bestPercentage,
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
    const yearLabel = normalizeText(pastPapers.currentYear || this.state.currentLevel);
    const topicLabel = normalizeText(pastPapers.currentTopic || this.state.currentArea);
    if (!yearLabel || !topicLabel) {
      await this.navigate("past-paper-topics", { year: yearLabel }, { replace: true });
      return;
    }

    this.showLoadingView();
    let exams;
    try {
      exams = await this.ensurePastPaperExamsLoaded(yearLabel, topicLabel);
    } catch (error) {
      console.error("Past paper exams load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(error?.message || "Could not load past paper exams.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) return;

    document.getElementById("past-paper-exams-title").textContent = topicLabel;
    document.getElementById("past-paper-exams-kicker").textContent =
      `${yearLabel} / ${PAST_PAPER_DISPLAY_LABEL}`;
    document.getElementById("past-paper-exams-subtitle").textContent =
      "Choose an exam paper to start.";
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
              <span class="quizlist-card-question-count">${exam.unitCount} stem${exam.unitCount === 1 ? "" : "s"}</span>
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
        this.navigate("past-paper-session", {
          setId: exam.setId,
          year: yearLabel,
          topic: topicLabel,
        });
      this.dom.pastPaperExamsGrid.appendChild(card);
    });

    this.showOnly("past-paper-exams-view");
  },

  renderPastPaperUnitMarkup(unit, unitIndex) {
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
        return `
          <div class="past-paper-branch" data-branch-id="${branchId}">
            <p class="past-paper-branch-prompt">${this.escapeHtml(branch.prompt)}</p>
            <div class="tf-options past-paper-branch-options">
              <label class="quiz-choice tf-btn opt-true" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${branchId}" value="true" data-branch-input="${branchId}">
                <span class="tf-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.2 3.2L17.5 8"></path></svg>
                </span>
                <span class="tf-label">True</span>
              </label>
              <label class="quiz-choice tf-btn opt-false" data-quiz-choice>
                <input class="quiz-choice-input" type="radio" name="pp-${branchId}" value="false" data-branch-input="${branchId}">
                <span class="tf-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M8 8l8 8"></path><path d="M16 8l-8 8"></path></svg>
                </span>
                <span class="tf-label">False</span>
              </label>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <article class="question-card question-card-tf past-paper-unit-card">
        <div class="question-meta">
          <span class="q-number">STEM ${unitIndex + 1}</span>
          <span class="q-type-badge">5 MARKS</span>
        </div>
        <p class="question-stem">${this.escapeHtml(unit.stem)}</p>
        ${imageHtml}
        <div class="past-paper-branches">${branchRows}</div>
      </article>
    `;
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
    let units;
    try {
      units = await this.ensurePastPaperUnitsLoaded(setId);
    } catch (error) {
      console.error("Past paper exam load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(error?.message || "Could not load this past paper.");
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== routeUrl) return;

    const exam = this.findPastPaperExam(setId) || {
      title: "Past Paper",
      yearLabel: pastPapers.currentYear,
      topicLabel: pastPapers.currentTopic,
      totalMarks: units.reduce((sum, unit) => sum + unit.branches.length, 0),
    };
    pastPapers.activeExam = exam;
    pastPapers.activeUnits = units;

    const totalMarks = units.reduce((sum, unit) => sum + unit.branches.length, 0);
    this.showOnly("past-paper-session-view");
    document.getElementById("past-paper-mode-badge").textContent = "PAST PAPER";
    document.getElementById("past-paper-page-kicker").textContent =
      `${exam.yearLabel || pastPapers.currentYear} / ${exam.topicLabel || pastPapers.currentTopic}`;
    document.getElementById("past-paper-page-title").textContent = exam.title;
    document.getElementById("past-paper-page-meta").textContent =
      `${units.length} stems / ${totalMarks} marks`;
    document.getElementById("past-paper-total-count").textContent = String(totalMarks);
    document.getElementById("past-paper-unit-count").textContent = String(units.length);
    document.getElementById("past-paper-answered-count").textContent = "0";
    document.getElementById("past-paper-progress-count").textContent = `0 / ${totalMarks}`;
    document.getElementById("past-paper-progress-fill").style.width = "0%";
    document.getElementById("past-paper-progress-copy").textContent =
      `0/${totalMarks} answered`;
    this.dom.pastPaperSubmitBtn.disabled = true;
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
    };

    this.dom.pastPaperSubmitBtn.onclick = () => {
      void this.handlePastPaperSubmission();
    };
  },

  getPastPaperAnswerMap() {
    const answers = {};
    this.dom.pastPaperForm
      ?.querySelectorAll('input[data-branch-input]:checked')
      .forEach((input) => {
        answers[input.dataset.branchInput] = input.value;
      });
    return answers;
  },

  updatePastPaperProgressUI() {
    const total = this.getPastPaperState().activeUnits.reduce(
      (sum, unit) => sum + unit.branches.length,
      0
    );
    const answered = Object.keys(this.getPastPaperAnswerMap()).length;
    const percent = total ? Math.round((answered / total) * 100) : 0;

    document.getElementById("past-paper-answered-count").textContent = String(answered);
    document.getElementById("past-paper-progress-count").textContent =
      `${answered} / ${total}`;
    document.getElementById("past-paper-progress-fill").style.width = `${percent}%`;
    document.getElementById("past-paper-progress-copy").textContent =
      `${answered}/${total} answered`;
    if (this.dom.pastPaperSubmitBtn) {
      this.dom.pastPaperSubmitBtn.disabled = answered === 0;
    }
  },

  async handlePastPaperSubmission() {
    const pastPapers = this.getPastPaperState();
    const setId = normalizeText(pastPapers.currentSetId);
    if (!setId || this.pastPaperSubmissionInFlight) return;

    this.pastPaperSubmissionInFlight = true;
    if (this.dom.pastPaperSubmitBtn) this.dom.pastPaperSubmitBtn.disabled = true;

    try {
      const { data, error } = await this.withTimeout(
        submitPastPaperAttempt(this.getSupabase(), setId, this.getPastPaperAnswerMap()),
        12000,
        "Submitting past paper"
      );
      if (error) throw error;

      const attemptId = data?.attemptId || data?.attempt_id;
      this.getPastPaperState().reviewsByAttemptId = {};
      await this.loadPastPaperYears(true);
      await this.navigate("past-paper-review", { attemptId });
    } catch (error) {
      console.error("Past paper submission failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showToast(error?.message || "Could not submit past paper.");
      this.updatePastPaperProgressUI();
    } finally {
      this.pastPaperSubmissionInFlight = false;
    }
  },

  async renderPastPaperReview() {
    const attemptId = normalizeText(this.getPastPaperState().currentAttemptId);
    if (!attemptId) {
      await this.navigate("home", {}, { replace: true });
      return;
    }

    this.showLoadingView();
    let review;
    try {
      const { data, error } = await this.withTimeout(
        fetchPastPaperAttemptReview(this.getSupabase(), attemptId),
        12000,
        "Loading past paper review"
      );
      if (error) throw error;
      review = data || {};
    } catch (error) {
      console.error("Past paper review load failed:", error);
      if (await this.handleAccessRestriction(error)) return;
      this.showFatalLoadError(error?.message || "Could not load past paper review.");
      return;
    }

    const attempt = review.attempt || {};
    const units = Array.isArray(review.units) ? review.units : [];
    this.showOnly("past-paper-review-view");
    document.getElementById("past-paper-review-title").textContent = "Past Paper Result";
    document.getElementById("past-paper-review-kicker").textContent = "Attempt result";
    document.getElementById("past-paper-review-score").textContent =
      `${Number(attempt.score || 0)}/${Number(attempt.totalMarks || 0)}`;
    document.getElementById("past-paper-review-percent").textContent =
      `${Number(attempt.percentage || 0)}%`;
    document.getElementById("past-paper-review-correct").textContent =
      String(Number(attempt.correct || 0));
    document.getElementById("past-paper-review-wrong").textContent =
      String(Number(attempt.wrong || 0));
    document.getElementById("past-paper-review-unanswered").textContent =
      String(Number(attempt.unanswered || 0));
    document.getElementById("past-paper-review-count").textContent =
      `${units.length} stem${units.length === 1 ? "" : "s"}`;
    this.dom.pastPaperReviewList.innerHTML = units
      .map((unit, unitIndex) => this.renderPastPaperReviewUnit(unit, unitIndex))
      .join("");
  },

  renderPastPaperReviewUnit(unit, unitIndex) {
    const branches = Array.isArray(unit.branches) ? unit.branches : [];
    const correct = branches.filter((branch) => branch.isCorrect).length;
    return `
      <article class="result-card review-card past-paper-review-unit">
        <div class="review-card-inner">
          <div class="review-top">
            <span class="review-q-num">STEM ${unitIndex + 1}</span>
            <span class="verdict-badge ${correct === branches.length ? "correct" : "wrong"}">${correct}/${branches.length}</span>
          </div>
          <p class="review-stem">${this.escapeHtml(unit.stem || "")}</p>
          <div class="past-paper-review-branches">
            ${branches
              .map(
                (branch) => `
                <div class="past-paper-review-branch ${branch.isCorrect ? "is-correct" : "is-wrong"}">
                  <div class="past-paper-review-branch-head">
                    <span>Branch ${Number(branch.order || 0)}</span>
                    <strong>${branch.isCorrect ? "Correct" : "Missed"}</strong>
                  </div>
                  <p>${this.escapeHtml(branch.prompt || "")}</p>
                  <div class="answer-grid">
                    <div class="answer-chip ${branch.isCorrect ? "your" : "yours-wrong"}">
                      <span class="chip-label">Your answer</span>
                      <span class="chip-val">${this.escapeHtml(boolToAnswer(branch.userAnswer))}</span>
                    </div>
                    <div class="answer-chip correct-ans">
                      <span class="chip-label">Correct</span>
                      <span class="chip-val">${this.escapeHtml(boolToAnswer(branch.correctAnswer))}</span>
                    </div>
                  </div>
                  ${
                    branch.explanation
                      ? `<div class="explanation"><div class="explanation-label">Explanation</div><p class="explanation-text">${this.escapeHtml(branch.explanation)}</p></div>`
                      : ""
                  }
                </div>
              `
              )
              .join("")}
          </div>
        </div>
      </article>
    `;
  },
};
