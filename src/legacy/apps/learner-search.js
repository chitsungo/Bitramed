export const learnerSearch = {
  normalizeSearchText(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  escapeSearchHtml(value) {
    if (typeof this.escapeHtml === "function") {
      return this.escapeHtml(value);
    }

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  getSearchTypeMeta(type) {
    if (typeof this.getTypeMeta === "function") {
      return this.getTypeMeta(type);
    }

    return type === "tf"
      ? { label: "True / False", short: "T/F", className: "tf-border" }
      : { label: "Single Best Answer", short: "SBA", className: "sba-border" };
  },

  compareSearchValues(a, b) {
    if (typeof this.compareDisplayOrder === "function") {
      return this.compareDisplayOrder(a, b);
    }

    return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  },

  compareSearchItems(a, b) {
    return this.compareSearchValues(a.level, b.level)
      || this.compareSearchValues(a.area, b.area)
      || this.compareSearchValues(a.sub, b.sub)
      || this.compareSearchValues(a.title, b.title);
  },

  getSearchCatalogItems() {
    return Object.values(this.state?.quizDetailsById || {})
      .filter((item) => item && item.quizId)
      .slice()
      .sort((a, b) => this.compareSearchItems(a, b));
  },

  getSearchItemScore(item, normalizedQuery, tokens) {
    const title = this.normalizeSearchText(item.title);
    const sub = this.normalizeSearchText(item.sub);
    const area = this.normalizeSearchText(item.area);
    const level = this.normalizeSearchText(item.level);
    const haystack = [title, sub, area, level].filter(Boolean).join(" ");

    if (!normalizedQuery) return 0;
    if (!haystack.includes(normalizedQuery) && !tokens.every((token) => haystack.includes(token))) {
      return 0;
    }

    let score = 0;

    if (title === normalizedQuery) score += 220;
    else if (title.startsWith(normalizedQuery)) score += 150;
    else if (title.includes(normalizedQuery)) score += 105;

    if (sub === normalizedQuery) score += 110;
    else if (sub.startsWith(normalizedQuery)) score += 75;
    else if (sub.includes(normalizedQuery)) score += 52;

    if (area === normalizedQuery) score += 90;
    else if (area.startsWith(normalizedQuery)) score += 60;
    else if (area.includes(normalizedQuery)) score += 42;

    if (level === normalizedQuery) score += 70;
    else if (level.startsWith(normalizedQuery)) score += 45;
    else if (level.includes(normalizedQuery)) score += 28;

    tokens.forEach((token) => {
      if (title.includes(token)) score += 22;
      if (sub.includes(token)) score += 13;
      if (area.includes(token)) score += 10;
      if (level.includes(token)) score += 8;
    });

    return score;
  },

  getSearchResultsForQuery(rawQuery) {
    const displayQuery = String(rawQuery ?? "").trim();
    const normalizedQuery = this.normalizeSearchText(displayQuery);
    const tokens = normalizedQuery ? normalizedQuery.split(" ") : [];
    const items = this.getSearchCatalogItems();

    if (!normalizedQuery) {
      return {
        displayQuery,
        browseMode: true,
        totalItems: items.length,
        totalMatches: items.length,
        results: items.slice(0, 12)
      };
    }

    const results = items
      .map((item) => ({
        item,
        score: this.getSearchItemScore(item, normalizedQuery, tokens)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || this.compareSearchItems(a.item, b.item))
      .map((entry) => entry.item);

    return {
      displayQuery,
      browseMode: false,
      totalItems: items.length,
      totalMatches: results.length,
      results: results.slice(0, 18)
    };
  },

  buildSearchResultMarkup(item, index) {
    const escape = this.escapeSearchHtml.bind(this);
    const typeMeta = this.getSearchTypeMeta(item.type);
    const context = [item.level, item.area, item.sub].filter(Boolean).join(" - ");
    const questionCount = Number(item.count || 0);
    const questionLabel = questionCount
      ? `${questionCount} question${questionCount === 1 ? "" : "s"}`
      : "Question count pending";

    return `
      <button
        class="search-result-card ${escape(typeMeta.className || "sba-border")}"
        type="button"
        data-search-index="${index}"
        aria-label="Open ${escape(item.title || "assessment")}"
      >
        <div class="search-result-head">
          <h3 class="search-result-title">${escape(item.title || "Assessment")}</h3>
          <span class="search-result-type">${escape(typeMeta.short || typeMeta.label || "Quiz")}</span>
        </div>
        <p class="search-result-meta">${escape(context || "Course context unavailable")}</p>
        <div class="search-result-footer">
          <span class="search-result-detail">${escape(questionLabel)}</span>
          <span class="search-result-detail">${escape(typeMeta.label || "Assessment")}</span>
        </div>
      </button>
    `;
  },

  bindSearchResultCards() {
    if (!this.dom?.searchResults) return;

    this.dom.searchResults.querySelectorAll("[data-search-index]").forEach((card) => {
      const index = Number.parseInt(card.dataset.searchIndex || "-1", 10);
      if (!Number.isFinite(index) || index < 0) return;

      card.addEventListener("click", () => {
        this.openSearchResultByIndex(index);
      });

      card.addEventListener("mouseenter", () => {
        this.state.search.activeIndex = index;
        this.updateSearchSelection();
      });

      card.addEventListener("focus", () => {
        this.state.search.activeIndex = index;
        this.updateSearchSelection();
      });
    });
  },

  async renderSearchResults() {
    if (!this.dom?.searchResults) return;

    try {
      await this.ensureSearchIndexLoaded();
    } catch (error) {
      console.error("Search render failed:", error);

      if (typeof this.handleAccessRestriction === "function" && await this.handleAccessRestriction(error)) {
        return;
      }

      this.state.search.results = [];
      this.state.search.activeIndex = -1;
      this.dom.searchResults.classList.add("has-results");
      this.dom.searchResults.innerHTML = `
        <div class="search-results-empty">${this.escapeSearchHtml(error?.message || "Could not load search right now.")}</div>
      `;
      return;
    }

    const { displayQuery, browseMode, totalItems, totalMatches, results } = this.getSearchResultsForQuery(
      this.dom.searchInput?.value || ""
    );

    this.state.search.results = results;
    this.state.search.activeIndex = results.length ? 0 : -1;
    this.dom.searchResults.classList.add("has-results");

    if (!totalItems) {
      this.dom.searchResults.innerHTML = `
        <div class="search-results-empty">No assessments are available in search yet.</div>
      `;
      return;
    }

    if (!results.length) {
      this.dom.searchResults.innerHTML = `
        <div class="search-results-summary">No matches</div>
        <div class="search-results-empty">No assessments matched "${this.escapeSearchHtml(displayQuery)}".</div>
      `;
      return;
    }

    const summary = browseMode
      ? `Showing ${results.length} of ${totalItems} assessments. Start typing to narrow the list.`
      : `${totalMatches} assessment${totalMatches === 1 ? "" : "s"} matched "${displayQuery}".`;

    this.dom.searchResults.innerHTML = `
      <div class="search-results-summary">${this.escapeSearchHtml(summary)}</div>
      <div class="search-results-list">
        ${results.map((item, index) => this.buildSearchResultMarkup(item, index)).join("")}
      </div>
    `;

    this.bindSearchResultCards();
    this.updateSearchSelection();
  }
};
