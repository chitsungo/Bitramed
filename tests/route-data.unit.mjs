import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.window = {
  clearTimeout,
  localStorage: {
    getItem() {
      return null;
    },
    removeItem() {},
    setItem() {},
  },
  location: { pathname: "/modules/", search: "?level=Year%201" },
  matchMedia() {
    return { addEventListener() {}, matches: false };
  },
  setTimeout,
};

globalThis.document = {
  body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {} },
  documentElement: {
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
  },
};

const [{ learnerCore }, { learnerFeatures }, { pastPaperApp }] =
  await Promise.all([
    import("../public/src/apps/learner-core.js"),
    import("../public/src/apps/learner-features.js"),
    import("../public/src/features/past-papers/past-paper-app.js"),
  ]);

function createRouteApp(responses, calls) {
  return {
    ...learnerCore,
    ...learnerFeatures,
    ...pastPaperApp,
    compareDisplayOrder: learnerCore.compareDisplayOrder,
    getSupabase() {
      return {
        rpc(name, params = {}) {
          calls.push({ name, params });
          return Promise.resolve({ data: responses[name], error: null });
        },
      };
    },
    normalizeSearchText(value) {
      return String(value || "")
        .trim()
        .toLowerCase();
    },
    scheduleAppDataCacheWrite() {},
    state: JSON.parse(JSON.stringify(learnerCore.state)),
    withTimeout(promise) {
      return promise;
    },
  };
}

test("direct nested startup uses only the shell bootstrap", async () => {
  let shellCalls = 0;
  let homeCalls = 0;
  let legacyCalls = 0;
  const app = {
    ...learnerCore,
    loadAccessStatus: async () => {
      legacyCalls += 1;
    },
    loadAreaCatalog: async () => {
      legacyCalls += 1;
    },
    loadHomeBootstrap: async () => {
      homeCalls += 1;
      return true;
    },
    loadPastPaperYears: async () => {
      legacyCalls += 1;
    },
    loadShellBootstrap: async () => {
      shellCalls += 1;
      app.state.accessStatus = { hasAccess: true };
      return true;
    },
    loadThemePreference: async () => {
      legacyCalls += 1;
    },
    showLoadingView() {},
    state: JSON.parse(JSON.stringify(learnerCore.state)),
  };

  assert.equal(
    await app.loadDatabase({ routeOnComplete: false, showLoading: false }),
    true
  );
  assert.equal(shellCalls, 1);
  assert.equal(homeCalls, 0);
  assert.equal(legacyCalls, 0);
});

test("each browse view requests one scoped payload and reuses it", async () => {
  const calls = [];
  const responses = {
    app_year_overview: {
      schemaVersion: 1,
      level: "Year 1",
      normal: {
        levelId: "level-1",
        courseCount: 1,
        doneCount: 1,
        totalCount: 3,
        percent: 33,
      },
      pastPaper: null,
    },
    app_browse_courses: {
      schemaVersion: 1,
      level: "Year 1",
      courses: [
        {
          courseId: "course-1",
          name: "Anatomy",
          moduleCount: 2,
          doneCount: 1,
          totalCount: 3,
          percent: 33,
        },
      ],
    },
    app_browse_subtopics: {
      schemaVersion: 1,
      level: "Year 1",
      area: "Anatomy",
      courseId: "course-1",
      subtopics: [
        {
          subtopicId: "sub-1",
          name: "Introduction",
          doneCount: 1,
          totalCount: 2,
          percent: 50,
        },
      ],
    },
    app_browse_types: {
      schemaVersion: 1,
      level: "Year 1",
      area: "Anatomy",
      sub: "Introduction",
      totalQuestions: 30,
      totalQuizCount: 2,
      completedQuizCount: 1,
      percent: 50,
      types: [
        {
          type: "sba",
          quizCount: 1,
          questionCount: 20,
          completedCount: 1,
          percent: 100,
        },
        {
          type: "tf",
          quizCount: 1,
          questionCount: 10,
          completedCount: 0,
          percent: 0,
        },
      ],
    },
    app_browse_quizzes: {
      schemaVersion: 1,
      level: "Year 1",
      area: "Anatomy",
      sub: "Introduction",
      type: "sba",
      topicIndex: 1,
      summary: {
        assessmentCount: 1,
        completedCount: 1,
        averageBestPercentage: 80,
      },
      quizzes: [
        {
          quizId: "quiz-1",
          title: "Assessment 1",
          questionCount: 20,
          totalAttempts: 2,
          bestPercentage: 80,
        },
      ],
    },
  };
  const app = createRouteApp(responses, calls);

  const [firstCourses, secondCourses] = await Promise.all([
    app.loadBrowseCourses("Year 1"),
    app.loadBrowseCourses("Year 1"),
  ]);
  assert.equal(firstCourses, secondCourses);
  assert.equal(firstCourses.courses[0].summary.totalCount, 3);

  await app.loadYearOverview("Year 1");
  await app.loadBrowseSubtopics("Year 1", "Anatomy");
  await app.loadBrowseTypes("Year 1", "Anatomy", "Introduction");
  const quizPage = await app.loadBrowseQuizzes(
    "Year 1",
    "Anatomy",
    "Introduction",
    "sba"
  );

  assert.equal(quizPage.quizzes[0].totalAttempts, 2);
  assert.deepEqual(calls, [
    { name: "app_browse_courses", params: { p_level: "Year 1" } },
    { name: "app_year_overview", params: { p_level: "Year 1" } },
    {
      name: "app_browse_subtopics",
      params: { p_level: "Year 1", p_area: "Anatomy" },
    },
    {
      name: "app_browse_types",
      params: {
        p_level: "Year 1",
        p_area: "Anatomy",
        p_sub: "Introduction",
      },
    },
    {
      name: "app_browse_quizzes",
      params: {
        p_level: "Year 1",
        p_area: "Anatomy",
        p_sub: "Introduction",
        p_type: "sba",
      },
    },
  ]);
  assert.equal(
    calls.some(({ name }) =>
      [
        "app_level_course_catalog",
        "app_user_attempts_enriched",
        "app_past_paper_attempts_enriched",
        "app_quiz_catalog_rows",
      ].includes(name)
    ),
    false
  );

  await app.loadBrowseCourses("Year 1");
  await app.loadBrowseSubtopics("Year 1", "Anatomy");
  await app.loadBrowseTypes("Year 1", "Anatomy", "Introduction");
  await app.loadBrowseQuizzes("Year 1", "Anatomy", "Introduction", "sba");
  assert.equal(calls.length, 5);
});

test("account and search return bounded models without loading histories", async () => {
  const calls = [];
  const app = createRouteApp(
    {
      app_account_page: {
        schemaVersion: 1,
        attemptsCount: 1,
        quizzesDoneCount: 1,
        averagePercentage: 72,
        bestAttempt: {
          assessmentKind: "quiz",
          score: 18,
          totalQuestions: 25,
          percentage: 72,
        },
        sectionStats: {
          normal: {
            attemptsCount: 1,
            assessmentsDoneCount: 1,
            averagePercentage: 72,
          },
          exam: {
            attemptsCount: 0,
            assessmentsDoneCount: 0,
            averagePercentage: 0,
          },
          combined: {
            attemptsCount: 1,
            assessmentsDoneCount: 1,
            averagePercentage: 72,
          },
        },
        courseStats: [],
        recentAttempts: [],
      },
      app_quiz_search: {
        schemaVersion: 1,
        browseMode: false,
        totalItems: 100,
        totalMatches: 1,
        results: [
          {
            quizId: "quiz-1",
            level: "Year 1",
            area: "Anatomy",
            sub: "Introduction",
            type: "sba",
            title: "Introduction Assessment",
            count: 20,
          },
        ],
      },
    },
    calls
  );

  const account = await app.loadAccountPage();
  const search = await app.loadQuizSearchPage("introduction");
  assert.equal(account.sectionStats.normal.attemptsCount, 1);
  assert.equal(search.results.length, 1);
  assert.deepEqual(calls, [
    { name: "app_account_page", params: { p_limit: 10 } },
    {
      name: "app_quiz_search",
      params: { p_query: "introduction", p_limit: 18 },
    },
  ]);
});

test("invalid route inputs make no database call and scoped keys cannot collide", async () => {
  const calls = [];
  const app = createRouteApp({}, calls);
  assert.notEqual(
    app.getScopedRouteDataKey("a|||b", "c"),
    app.getScopedRouteDataKey("a", "b|||c")
  );
  await assert.rejects(() => app.loadBrowseCourses("   "));
  await assert.rejects(() =>
    app.loadBrowseQuizzes("Year 1", "Anatomy", "Introduction", "other")
  );
  assert.deepEqual(calls, []);
});

test("an invalidated in-flight response cannot repopulate route caches", async () => {
  let resolveRpc;
  const calls = [];
  const app = createRouteApp({}, calls);
  app.getSupabase = () => ({
    rpc(name, params) {
      calls.push({ name, params });
      return new Promise((resolve) => {
        resolveRpc = resolve;
      });
    },
  });

  const pending = app.loadBrowseCourses("Year 1");
  app.routeDataGeneration += 1;
  app.state.routeData.coursesByLevel = {};
  resolveRpc({
    data: {
      schemaVersion: 1,
      level: "Year 1",
      courses: [{ courseId: "old", name: "Stale course" }],
    },
    error: null,
  });
  const page = await pending;
  assert.equal(page.courses[0].name, "Stale course");
  assert.deepEqual(app.state.routeData.coursesByLevel, {});
  assert.deepEqual(app.state.areasByLevel, {});
});

test("quiz session returns context, natural ordinal, questions, and draft in one call", async () => {
  const calls = [];
  const app = createRouteApp(
    {
      app_quiz_session: {
        schemaVersion: 1,
        descriptor: {
          quiz_id: "quiz-10",
          level: "Year 1",
          area: "Anatomy",
          sub: "Introduction",
          question_type: "sba",
          quiz_title: "Assessment 10",
          question_count: 1,
        },
        siblings: [
          { quizId: "quiz-10", title: "Assessment 10" },
          { quizId: "quiz-2", title: "Assessment 2" },
          { quizId: "quiz-1", title: "Assessment 1" },
        ],
        questions: [
          {
            question_text: "Question",
            option_a: "A",
            option_b: "B",
            correct_answer: "A",
          },
        ],
        progress: null,
      },
    },
    calls
  );

  const session = await app.loadQuizSessionPage("quiz-10");
  assert.equal(session.descriptor.quizIndex, 3);
  assert.equal(session.questions.length, 1);
  assert.deepEqual(calls, [
    {
      name: "app_quiz_session",
      params: {
        p_quiz_id: "quiz-10",
        p_progress_key: "study|no-time|standard",
      },
    },
  ]);
});

test("direct quiz prefetch is consumed without a duplicate database call", async () => {
  const calls = [];
  const app = createRouteApp(
    {
      app_quiz_session: {
        schemaVersion: 1,
        descriptor: {
          quiz_id: "quiz-1",
          level: "Year 1",
          area: "Anatomy",
          sub: "Introduction",
          question_type: "sba",
          quiz_title: "Assessment 1",
          question_count: 1,
        },
        siblings: [{ quizId: "quiz-1", title: "Assessment 1" }],
        questions: [
          {
            question_text: "Question",
            option_a: "A",
            option_b: "B",
            correct_answer: "A",
          },
        ],
        progress: null,
      },
    },
    calls
  );
  const originalPathname = window.location.pathname;
  const originalSearch = window.location.search;
  window.location.pathname = "/quiz/";
  window.location.search = "?quizId=quiz-1&mode=study";

  try {
    const prefetched = app.prefetchInitialRouteData();
    const page = await prefetched;
    const consumed = app.consumeInitialRoutePrefetch("quiz");

    assert.strictEqual(await consumed, page);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "app_quiz_session");
  } finally {
    window.location.pathname = originalPathname;
    window.location.search = originalSearch;
  }
});

test("rapid draft changes coalesce into one latest database write", async () => {
  const writes = [];
  const app = createRouteApp({}, []);
  app.state.currentUser = { id: "user-1" };
  app.getSupabase = () => ({
    from(table) {
      assert.equal(table, "user_assessment_progress");
      return {
        upsert(payload) {
          writes.push(payload);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  });

  const first = app.saveAccountAssessmentProgress("quiz", "quiz-1", {
    context: { mode: "study" },
    answers: { q0: "A" },
    savedAt: "2026-08-11T10:00:00Z",
  });
  const second = app.saveAccountAssessmentProgress("quiz", "quiz-1", {
    context: { mode: "study" },
    answers: { q0: "B" },
    savedAt: "2026-08-11T10:00:01Z",
  });
  await Promise.all([first, second]);

  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].progress_data.answers, { q0: "B" });
});

test("route SQL keeps route contracts bounded and user-scoped", async () => {
  const sql = await readFile(
    new URL("../database/learner-route-data.sql", import.meta.url),
    "utf8"
  );
  for (const signature of [
    "app_shell_bootstrap()",
    "app_year_overview(p_level text)",
    "app_browse_courses(p_level text)",
    "public.app_browse_subtopics(",
    "public.app_browse_types(",
    "public.app_browse_quizzes(",
    "public.app_quiz_context(p_quiz_id uuid)",
    "public.app_quiz_session(",
    "public.app_past_paper_session(",
    "public.app_account_page(p_limit integer default 10)",
    "public.app_quiz_search(",
  ]) {
    assert.match(sql, new RegExp(signature.replace(/[()]/g, "\\$&")));
  }
  assert.match(sql, /where qa\.user_id = v_user_id/g);
  assert.match(sql, /perform public\.app_require_active_access\(\)/g);
  assert.doesNotMatch(sql, /p_user_id/i);
});

test("past paper review stays anchored to the submitted question set", async () => {
  const sql = await readFile(
    new URL("../database/admin-assessment-analytics.sql", import.meta.url),
    "utf8"
  );
  const reviewSql = sql.slice(
    sql.indexOf(
      "create or replace function public.app_past_paper_attempt_review"
    ),
    sql.indexOf(
      "create or replace function public.app_past_paper_attempts_enriched"
    )
  );

  assert.match(
    reviewSql,
    /join public\.past_paper_attempt_answers paa on paa\.attempt_id = a\.id/
  );
  assert.doesNotMatch(
    reviewSql,
    /join public\.past_paper_units pu on pu\.set_id = a\.set_id/
  );
  assert.match(reviewSql, /filter \(where u\.unit_id is not null\)/);
  assert.match(
    sql,
    /if v_total = 0 then\s+raise exception 'Past paper has no active questions\.';/
  );
});
