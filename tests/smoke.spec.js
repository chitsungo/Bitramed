import { test, expect } from "@playwright/test";

const learnerCatalogRows = [
  {
    level_id: "level-1",
    level: "Year 1",
    display_order: 1,
    course_id: "course-anatomy",
    area: "Anatomy",
  },
  {
    level_id: "level-1",
    level: "Year 1",
    display_order: 1,
    course_id: "course-physiology",
    area: "Physiology",
  },
  {
    level_id: "level-2",
    level: "Year 2",
    display_order: 2,
    course_id: "course-biochemistry",
    area: "Biochemistry",
  },
  {
    level_id: "level-3",
    level: "Year 3",
    display_order: 3,
    course_id: "course-past-papers",
    area: "Past Papers",
  },
];

const learnerSubtopicsByCourse = {
  "Year 1|||Anatomy": [
    {
      course_id: "course-anatomy",
      subtopic_id: "sub-intro-anatomy",
      subtopic_name: "Introduction to Anatomy",
    },
    {
      course_id: "course-anatomy",
      subtopic_id: "sub-upper-limb",
      subtopic_name: "Upper Limb",
    },
  ],
  "Year 1|||Physiology": [
    {
      course_id: "course-physiology",
      subtopic_id: "sub-homeostasis",
      subtopic_name: "Homeostasis",
    },
  ],
  "Year 2|||Biochemistry": [
    {
      course_id: "course-biochemistry",
      subtopic_id: "sub-metabolism",
      subtopic_name: "Metabolism",
    },
  ],
  "Year 3|||Past Papers": [
    {
      course_id: "course-past-papers",
      subtopic_id: "sub-past-haematology",
      subtopic_name: "Haematology",
    },
  ],
};

const learnerQuizCatalogRows = [
  {
    quiz_id: "quiz-sba-1",
    level: "Year 1",
    area: "Anatomy",
    sub: "Introduction to Anatomy",
    quiz_title: "Introduction Assessment 1",
    question_type: "sba",
    question_count: 25,
  },
  {
    quiz_id: "quiz-tf-1",
    level: "Year 1",
    area: "Anatomy",
    sub: "Introduction to Anatomy",
    quiz_title: "Introduction Assessment 1",
    question_type: "tf",
    question_count: 25,
  },
  {
    quiz_id: "quiz-tf-2",
    level: "Year 1",
    area: "Anatomy",
    sub: "Introduction to Anatomy",
    quiz_title: "Introduction Assessment 2",
    question_type: "tf",
    question_count: 25,
  },
  {
    quiz_id: "quiz-sba-2",
    level: "Year 1",
    area: "Anatomy",
    sub: "Upper Limb",
    quiz_title: "Upper Limb Assessment 1",
    question_type: "sba",
    question_count: 20,
  },
  {
    quiz_id: "quiz-tf-3",
    level: "Year 1",
    area: "Physiology",
    sub: "Homeostasis",
    quiz_title: "Homeostasis Assessment 1",
    question_type: "tf",
    question_count: 15,
  },
  {
    quiz_id: "quiz-sba-3",
    level: "Year 2",
    area: "Biochemistry",
    sub: "Metabolism",
    quiz_title: "Metabolism Assessment 1",
    question_type: "sba",
    question_count: 18,
  },
  {
    quiz_id: "quiz-past-tf-1",
    level: "Year 3",
    area: "Past Papers",
    sub: "Haematology",
    quiz_title: "NUST MBM 3001 Haematology I",
    question_type: "tf",
    question_count: 3,
  },
];

const learnerAttemptRows = [
  {
    id: 1,
    user_id: "user-1",
    quiz_id: "quiz-sba-1",
    level: "Year 1",
    area: "Anatomy",
    sub: "Introduction to Anatomy",
    quiz_title: "Introduction Assessment 1",
    question_type: "sba",
    mode: "study",
    score: 18,
    total_questions: 25,
    correct_count: 18,
    wrong_count: 5,
    unanswered_count: 2,
    percentage: 72,
    completed_at: "2026-03-29T08:00:00Z",
    question_count: 25,
  },
  {
    id: 2,
    user_id: "user-1",
    quiz_id: "quiz-tf-2",
    level: "Year 1",
    area: "Anatomy",
    sub: "Introduction to Anatomy",
    quiz_title: "Introduction Assessment 2",
    question_type: "tf",
    mode: "exam",
    score: 20,
    total_questions: 25,
    correct_count: 20,
    wrong_count: 4,
    unanswered_count: 1,
    percentage: 80,
    completed_at: "2026-03-30T08:00:00Z",
    question_count: 25,
  },
];

const learnerAttemptSummaryByQuizId = {
  "quiz-sba-1": {
    totalAttempts: 1,
    study: {
      attempts: 1,
      best: { percentage: 72, mode: "study", score: 18, totalQuestions: 25 },
      latest: { percentage: 72, mode: "study", score: 18, totalQuestions: 25 },
    },
    exam: { attempts: 0 },
  },
  "quiz-tf-1": null,
  "quiz-tf-2": {
    totalAttempts: 1,
    study: { attempts: 0 },
    exam: {
      attempts: 1,
      best: { percentage: 80, mode: "exam", score: 20, totalQuestions: 25 },
      latest: { percentage: 80, mode: "exam", score: 20, totalQuestions: 25 },
    },
  },
};

const learnerQuestionsByQuizId = {
  "quiz-tf-1": [
    {
      id: "q-tf-1",
      question_text: "The anatomical position places the body upright.",
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_e: null,
      correct_answer: "TRUE",
      explanation: "This is the standard reference position.",
      image_url: "",
    },
    {
      id: "q-tf-2",
      question_text: "The heart is part of the axial skeleton.",
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_e: null,
      correct_answer: "FALSE",
      explanation: "The heart is an organ, not a skeletal structure.",
      image_url: "",
    },
  ],
  "quiz-tf-2": [
    {
      id: "q-tf-3",
      question_text: "The skin is the largest organ of the body.",
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_e: null,
      correct_answer: "TRUE",
      explanation: "The skin is the body's largest organ system.",
      image_url: "",
    },
  ],
  "quiz-sba-1": [
    {
      id: "q-sba-1",
      question_text:
        "Which plane divides the body into left and right portions?",
      option_a: "Coronal",
      option_b: "Sagittal",
      option_c: "Transverse",
      option_d: "Oblique",
      option_e: "Frontal",
      correct_answer: "B",
      explanation:
        "The sagittal plane divides the body into left and right portions.",
      image_url: "",
    },
  ],
  "quiz-past-tf-1": [
    {
      id: "q-past-tf-1",
      question_text:
        "Whole body imaging and bone marrow examination are important in staging lympho-proliferative diseases.",
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_e: null,
      correct_answer: "TRUE",
      explanation:
        "Accurate staging needs anatomical mapping and marrow assessment to detect occult infiltration.",
      image_url: "",
    },
    {
      id: "q-past-tf-2",
      question_text:
        "Bone marrow biopsy is never used to assess marrow involvement during lymphoma staging.",
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_e: null,
      correct_answer: "FALSE",
      explanation:
        "Bone marrow biopsy remains part of staging when marrow infiltration needs confirmation.",
      image_url: "",
    },
    {
      id: "q-past-tf-3",
      question_text:
        "Disease confined to one side of the diaphragm can still be upstaged by marrow infiltration.",
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_e: null,
      correct_answer: "TRUE",
      explanation:
        "Marrow disease changes stage even when nodal disease appears limited anatomically.",
      image_url: "",
    },
  ],
};

const learnerAccountSummary = {
  attemptsCount: 2,
  quizzesDoneCount: 2,
  averagePercentage: 76,
  bestAttempt: { percentage: 80, mode: "exam", score: 20, totalQuestions: 25 },
  modeStats: {
    study: { attemptsCount: 1, averagePercentage: 72 },
    exam: { attemptsCount: 1, averagePercentage: 80 },
  },
  courseStats: [
    {
      area: "Anatomy",
      averagePercentage: 76,
      quizzesDone: 2,
      attempts: 2,
      bestAttempt: {
        percentage: 80,
        mode: "exam",
        score: 20,
        totalQuestions: 25,
      },
    },
  ],
  recentAttempts: [
    {
      quizId: "quiz-tf-2",
      quizTitle: "Introduction Assessment 2",
      area: "Anatomy",
      sub: "Introduction to Anatomy",
      mode: "exam",
      percentage: 80,
      score: 20,
      totalQuestions: 25,
      completedAt: "2026-03-30T08:00:00Z",
    },
    {
      quizId: "quiz-sba-1",
      quizTitle: "Introduction Assessment 1",
      area: "Anatomy",
      sub: "Introduction to Anatomy",
      mode: "study",
      percentage: 72,
      score: 18,
      totalQuestions: 25,
      completedAt: "2026-03-29T08:00:00Z",
    },
  ],
};

const learnerResultSnapshot = {
  score: 2,
  total: 2,
  correct: 2,
  wrong: 0,
  unanswered: 0,
  percent: 100,
  mode: "study",
  attemptCount: 1,
  context: {
    level: "Year 1",
    area: "Anatomy",
    sub: "Introduction to Anatomy",
    type: "tf",
    title: "Introduction Assessment 1",
    mode: "study",
  },
  results: [
    {
      index: 0,
      statusClass: "correct",
      statusText: "Correct (+1)",
      question: "The anatomical position places the body upright.",
      imageHtml: "",
      userAnswer: "TRUE",
      correctAnswer: "TRUE",
      explanation: "This is the standard reference position.",
    },
    {
      index: 1,
      statusClass: "correct",
      statusText: "Correct (+1)",
      question: "The heart is part of the axial skeleton.",
      imageHtml: "",
      userAnswer: "FALSE",
      correctAnswer: "FALSE",
      explanation: "The heart is an organ, not a skeletal structure.",
    },
  ],
};

async function stubSupabase(
  page,
  {
    signedIn = false,
    isAdmin = false,
    theme = "light",
    hasAccess = false,
    recoverySession = false,
  } = {}
) {
  const adminOverview = [
    {
      total_users: 12,
      active_users: 8,
      total_attempts: 48,
      total_quizzes_done: 21,
      average_percentage: 72,
    },
  ];
  const adminUsers = [
    {
      user_id: "user-1",
      display_name: "Amina Ncube",
      email: "amina@example.com",
      total_attempts: 14,
      quizzes_done: 6,
      average_percentage: 81,
      best_percentage: 96,
      strongest_area: "Anatomy",
      weakest_area: "Biochemistry",
      latest_activity: "2026-03-30T08:00:00Z",
    },
    {
      user_id: "user-2",
      display_name: "Tariro Dube",
      email: "tariro@example.com",
      total_attempts: 11,
      quizzes_done: 5,
      average_percentage: 49,
      best_percentage: 70,
      strongest_area: "Physiology",
      weakest_area: "Pharmacology",
      latest_activity: "2026-03-29T06:00:00Z",
    },
    {
      user_id: "user-5",
      display_name: "Admin Pilot",
      email: "adminpilot@example.com",
      total_attempts: 20,
      quizzes_done: 8,
      average_percentage: 99,
      best_percentage: 100,
      strongest_area: "Pathology",
      weakest_area: "None",
      latest_activity: "2026-03-31T08:00:00Z",
      is_admin: true,
    },
    {
      user_id: "user-6",
      display_name: "Owner Root",
      email: "owner@example.com",
      total_attempts: 17,
      quizzes_done: 7,
      average_percentage: 97,
      best_percentage: 100,
      strongest_area: "Medicine",
      weakest_area: "None",
      latest_activity: "2026-03-31T06:00:00Z",
      is_owner: true,
    },
    {
      user_id: "user-7",
      display_name: "Silent Active",
      email: "silent@example.com",
      total_attempts: 0,
      quizzes_done: 0,
      average_percentage: 0,
      best_percentage: 0,
      strongest_area: "",
      weakest_area: "",
      latest_activity: "",
    },
  ];
  const adminCourses = [
    {
      area: "Anatomy",
      total_attempts: 18,
      unique_users: 6,
      average_percentage: 84,
      best_user_average: 96,
    },
    {
      area: "Pharmacology",
      total_attempts: 12,
      unique_users: 5,
      average_percentage: 54,
      best_user_average: 79,
    },
  ];
  const adminRecent = [
    {
      user_id: "user-1",
      quiz_title: "Upper Limb Review",
      display_name: "Amina Ncube",
      email: "amina@example.com",
      area: "Anatomy",
      mode: "study",
      percentage: 88,
      score: 22,
      total_questions: 25,
      completed_at: "2026-03-30T08:00:00Z",
    },
    {
      user_id: "user-2",
      quiz_title: "Physiology Drill",
      display_name: "Tariro Dube",
      email: "tariro@example.com",
      area: "Physiology",
      mode: "exam",
      percentage: 49,
      score: 12,
      total_questions: 25,
      completed_at: "2026-03-29T08:00:00Z",
    },
    {
      user_id: "user-5",
      quiz_title: "Admin Sandbox",
      display_name: "Admin Pilot",
      email: "adminpilot@example.com",
      area: "Pathology",
      mode: "study",
      percentage: 100,
      score: 25,
      total_questions: 25,
      completed_at: "2026-03-31T08:00:00Z",
      is_admin: true,
    },
  ];
  const adminAccess = [
    {
      user_id: "user-1",
      email: "amina@example.com",
      display_name: "Amina Ncube",
      status: "active",
      access_expires_at: "2026-04-28T08:00:00Z",
      blocked_at: null,
      block_reason: null,
      notes: "Paid",
    },
    {
      user_id: "user-2",
      email: "tariro@example.com",
      display_name: "Tariro Dube",
      status: "expired",
      access_expires_at: "2026-03-01T08:00:00Z",
      blocked_at: null,
      block_reason: null,
      notes: "Renewal due",
    },
    {
      user_id: "user-3",
      email: "new@example.com",
      display_name: "New Learner",
      status: "no_access",
      access_expires_at: null,
      blocked_at: null,
      block_reason: null,
      notes: null,
    },
    {
      user_id: "user-4",
      email: "blocked@example.com",
      display_name: "Blocked Learner",
      status: "blocked",
      access_expires_at: "2026-04-10T08:00:00Z",
      blocked_at: "2026-03-20T08:00:00Z",
      block_reason: "Manual hold",
      notes: "Review account",
    },
    {
      user_id: "user-5",
      email: "adminpilot@example.com",
      display_name: "Admin Pilot",
      status: "active",
      access_expires_at: "2026-04-29T08:00:00Z",
      blocked_at: null,
      block_reason: null,
      notes: "Internal admin",
      is_admin: true,
    },
    {
      user_id: "user-6",
      email: "owner@example.com",
      display_name: "Owner Root",
      status: "active",
      access_expires_at: "2026-05-03T08:00:00Z",
      blocked_at: null,
      block_reason: null,
      notes: "Owner account",
      is_owner: true,
    },
    {
      user_id: "user-7",
      email: "silent@example.com",
      display_name: "Silent Active",
      status: "active",
      access_expires_at: "2026-04-25T08:00:00Z",
      blocked_at: null,
      block_reason: null,
      notes: "Newly activated",
    },
  ];

  await page.route(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
        const clone = (value) => JSON.parse(JSON.stringify(value));
        const learnerCatalogRows = ${JSON.stringify(learnerCatalogRows)};
        const learnerSubtopicsByCourse = ${JSON.stringify(learnerSubtopicsByCourse)};
        const learnerQuizCatalogRows = ${JSON.stringify(learnerQuizCatalogRows)};
        const learnerAttemptRows = ${JSON.stringify(learnerAttemptRows)};
        const learnerAttemptSummaryByQuizId = ${JSON.stringify(learnerAttemptSummaryByQuizId)};
        const learnerQuestionsByQuizId = ${JSON.stringify(learnerQuestionsByQuizId)};
        const learnerAccountSummary = ${JSON.stringify(learnerAccountSummary)};

        const initialAuthState = {
          currentUser: ${JSON.stringify(
            signedIn || recoverySession
              ? {
                  id: isAdmin ? "admin-session-user" : "user-1",
                  email: isAdmin
                    ? "owner.session@example.com"
                    : "learner@example.com",
                  user_metadata: {
                    display_name: isAdmin ? "Owner" : "Learner",
                  },
                }
              : null
          )},
          recoverySession: ${recoverySession ? "true" : "false"}
        };
        const readStoredAuthState = () => {
          try {
            return JSON.parse(window.localStorage.getItem("__supabaseAuthState") || "null");
          } catch (error) {
            return null;
          }
        };
        const writeStoredAuthState = (state) => {
          window.__supabaseAuthState = state;
          try {
            window.localStorage.setItem("__supabaseAuthState", JSON.stringify(state));
          } catch (error) {
            return;
          }
        };
        const ensureStoredAuthState = () => {
          const existing = readStoredAuthState();
          if (existing && typeof existing === "object" && "recoverySession" in existing) {
            writeStoredAuthState(existing);
            return existing;
          }
          const seeded = clone(initialAuthState);
          writeStoredAuthState(seeded);
          return seeded;
        };
        const readTestState = () => {
          try {
            return JSON.parse(window.localStorage.getItem("__supabaseTestState") || '{"calls":[]}');
          } catch (error) {
            return { calls: [] };
          }
        };
        const writeTestState = (state) => {
          window.__supabaseTestState = state;
          try {
            window.localStorage.setItem("__supabaseTestState", JSON.stringify(state));
          } catch (error) {
            return;
          }
        };
        const ensureTestState = () => {
          const state = readTestState();
          if (!Array.isArray(state.calls)) {
            state.calls = [];
          }
          writeTestState(state);
          return state;
        };
        const recordCall = (call) => {
          const state = ensureTestState();
          state.calls.push(call);
          writeTestState(state);
        };

        window.supabase = {
          createClient() {
            const emptyResponse = Promise.resolve({ data: null, error: null });
            const persistedAuthState = ensureStoredAuthState();
            const authState = {
              currentUser: persistedAuthState.currentUser ? clone(persistedAuthState.currentUser) : null,
              listeners: [],
              recoverySession: !!persistedAuthState.recoverySession
            };
            const persistAuthState = () => {
              writeStoredAuthState({
                currentUser: authState.currentUser ? clone(authState.currentUser) : null,
                recoverySession: authState.recoverySession
              });
            };
            const emitAuthEvent = (event, session) => {
              authState.listeners.forEach((listener) => listener(event, session));
            };
            persistAuthState();
            const queryBuilder = (table) => ({
              table,
              _insertRows: null,
              select() { return this; },
              eq() { return this; },
              in() { return this; },
              maybeSingle() {
                if (this.table === "user_preferences") {
                  return Promise.resolve({ data: { theme: ${JSON.stringify(theme)} }, error: null });
                }
                return emptyResponse;
              },
              single() {
                if (this.table === "quiz_attempts" && this._insertRows) {
                  const row = Array.isArray(this._insertRows) ? this._insertRows[0] : this._insertRows;
                  return Promise.resolve({
                    data: {
                      id: 999,
                      user_id: row.user_id,
                      quiz_id: row.quiz_id,
                      mode: row.mode,
                      score: row.score,
                      total_questions: row.total_questions,
                      correct_count: row.correct_count,
                      wrong_count: row.wrong_count,
                      unanswered_count: row.unanswered_count,
                      percentage: row.percentage,
                      completed_at: "2026-04-01T08:00:00Z"
                    },
                    error: null
                  });
                }
                return emptyResponse;
              },
              upsert() { return emptyResponse; },
              insert(rows) {
                this._insertRows = rows;
                return this;
              },
              delete() { return this; }
            });

            return {
              auth: {
                getUser: () => Promise.resolve({ data: { user: authState.currentUser ? clone(authState.currentUser) : null }, error: null }),
                getSession: () => Promise.resolve({
                  data: {
                    session: authState.currentUser
                      ? { user: clone(authState.currentUser) }
                      : null
                  },
                  error: null
                }),
                onAuthStateChange: (callback) => {
                  authState.listeners.push(callback);
                  if (authState.recoverySession && authState.currentUser) {
                    setTimeout(() => {
                      callback("PASSWORD_RECOVERY", {
                        user: clone(authState.currentUser)
                      });
                    }, 0);
                  }
                  return {
                    data: {
                      subscription: {
                        unsubscribe() {
                          authState.listeners = authState.listeners.filter((entry) => entry !== callback);
                        }
                      }
                    }
                  };
                },
                resetPasswordForEmail: (email, options = {}) => {
                  recordCall({
                    name: "resetPasswordForEmail",
                    email,
                    redirectTo: options.redirectTo || ""
                  });
                  return Promise.resolve({ data: {}, error: null });
                },
                updateUser: ({ password }) => {
                  recordCall({
                    name: "updateUser",
                    passwordLength: String(password || "").length
                  });
                  return Promise.resolve({
                    data: { user: authState.currentUser ? clone(authState.currentUser) : null },
                    error: null
                  });
                },
                signInWithPassword: ({ email }) => {
                  recordCall({ name: "signInWithPassword", email: email || "" });
                  return Promise.resolve({ data: { user: authState.currentUser ? clone(authState.currentUser) : null }, error: null });
                },
                signInWithOAuth: () => Promise.resolve({ error: null }),
                signUp: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
                signOut: () => {
                  recordCall({ name: "signOut" });
                  authState.currentUser = null;
                  authState.recoverySession = false;
                  persistAuthState();
                  emitAuthEvent("SIGNED_OUT", null);
                  return Promise.resolve({ error: null });
                }
              },
              from(table) {
                return queryBuilder(table);
              },
              rpc(name, params = {}) {
                if (name === "app_my_access_status") {
                  return Promise.resolve({
                    data: {
                      status: ${hasAccess ? '"active"' : '"no_access"'},
                      hasAccess: ${hasAccess ? "true" : "false"},
                      blockReason: "",
                      accessExpiresAt: ${hasAccess ? '"2026-05-01T08:00:00Z"' : "null"}
                    },
                    error: null
                  });
                }
                if (name === "is_current_user_admin") {
                  return Promise.resolve({ data: ${isAdmin ? "true" : "false"}, error: null });
                }
                if (name === "admin_overview_stats") {
                  return Promise.resolve({ data: ${JSON.stringify(adminOverview)}, error: null });
                }
                if (name === "admin_user_summaries") {
                  return Promise.resolve({ data: ${JSON.stringify(adminUsers)}, error: null });
                }
                if (name === "admin_course_summaries") {
                  return Promise.resolve({ data: ${JSON.stringify(adminCourses)}, error: null });
                }
                if (name === "admin_recent_attempts") {
                  return Promise.resolve({ data: ${JSON.stringify(adminRecent)}, error: null });
                }
                if (name === "admin_list_user_access") {
                  return Promise.resolve({ data: ${JSON.stringify(adminAccess)}, error: null });
                }
                if (name === "app_level_course_catalog") {
                  return Promise.resolve({ data: clone(learnerCatalogRows), error: null });
                }
                if (name === "app_user_attempts_enriched") {
                  return Promise.resolve({ data: clone(learnerAttemptRows), error: null });
                }
                if (name === "app_course_subtopics_progress") {
                  const key = [params.p_level || "", params.p_area || ""].join("|||");
                  return Promise.resolve({ data: clone(learnerSubtopicsByCourse[key] || []), error: null });
                }
                if (name === "app_subtopic_quiz_list") {
                  const rows = learnerQuizCatalogRows.filter((row) =>
                    row.level === (params.p_level || "")
                    && row.area === (params.p_area || "")
                    && row.sub === (params.p_sub || "")
                  ).map((row) => ({
                    quiz_id: row.quiz_id,
                    quiz_title: row.quiz_title,
                    question_type: row.question_type,
                    question_count: row.question_count
                  }));
                  return Promise.resolve({ data: clone(rows), error: null });
                }
                if (name === "app_quiz_catalog_rows") {
                  const ids = Array.isArray(params.p_quiz_ids) ? params.p_quiz_ids : null;
                  const rows = ids
                    ? learnerQuizCatalogRows.filter((row) => ids.includes(row.quiz_id))
                    : learnerQuizCatalogRows;
                  return Promise.resolve({ data: clone(rows), error: null });
                }
                if (name === "app_quiz_questions") {
                  return Promise.resolve({ data: clone(learnerQuestionsByQuizId[params.p_quiz_id] || []), error: null });
                }
                if (name === "app_quiz_attempt_summary") {
                  return Promise.resolve({ data: clone(learnerAttemptSummaryByQuizId[params.p_quiz_id] || null), error: null });
                }
                if (name === "app_account_summary") {
                  return Promise.resolve({ data: clone(learnerAccountSummary), error: null });
                }
                return Promise.resolve({ data: [], error: null });
              }
            };
          }
        };
      `,
      });
    }
  );
}

async function seedLearnerResultSnapshot(page) {
  await page.addInitScript((snapshot) => {
    const key =
      "quiz-app:user-1:result:Year 1|||Anatomy|||Introduction to Anatomy|||tf|||Introduction Assessment 1|||study";
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }, learnerResultSnapshot);
}

async function seedPastPapersDraft(page, draft) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: "quiz-app:user-1:draft:Year 3|||Past Papers|||Haematology|||tf|||NUST MBM 3001 Haematology I|||study",
      value: draft,
    }
  );
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(metrics.doc).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function expectTopbarFitsViewport(page) {
  const metrics = await page.evaluate(() => {
    const topbar = document.querySelector(".app-shell > .topbar");
    const rect = topbar?.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      width: Math.round(rect?.width || 0),
      right: Math.round(rect?.right || 0),
    };
  });

  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function expectGridColumns(page, selector, expectedColumns) {
  const columnCount = await page
    .locator(selector)
    .evaluate(
      (node) =>
        getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean)
          .length
    );
  expect(columnCount).toBe(expectedColumns);
}

async function expectFirstCardFillsTrack(page, gridSelector, itemSelector) {
  const metrics = await page.evaluate(
    ({ gridSelector, itemSelector }) => {
      const grid = document.querySelector(gridSelector);
      const item = document.querySelector(itemSelector);
      const gridWidth = grid?.getBoundingClientRect().width || 0;
      const itemWidth = item?.getBoundingClientRect().width || 0;
      return { gridWidth, itemWidth };
    },
    { gridSelector, itemSelector }
  );

  expect(metrics.itemWidth).toBeGreaterThan(metrics.gridWidth * 0.9);
}

async function expectTrailingStaysInline(
  page,
  cardSelector,
  leadingSelector,
  trailingSelector
) {
  const metrics = await page.evaluate(
    ({ cardSelector, leadingSelector, trailingSelector }) => {
      const card = document.querySelector(cardSelector);
      const leading = card?.querySelector(leadingSelector);
      const trailing = card?.querySelector(trailingSelector);
      if (!card || !leading || !trailing) return null;

      const cardRect = card.getBoundingClientRect();
      const leadingRect = leading.getBoundingClientRect();
      const trailingRect = trailing.getBoundingClientRect();

      return {
        leadingBottom: Math.round(leadingRect.bottom - cardRect.top),
        trailingTop: Math.round(trailingRect.top - cardRect.top),
      };
    },
    { cardSelector, leadingSelector, trailingSelector }
  );

  expect(metrics).not.toBeNull();
  expect(metrics.trailingTop).toBeLessThanOrEqual(metrics.leadingBottom + 8);
}

async function readSupabaseCallLog(page) {
  return page.evaluate(() => {
    try {
      return (
        JSON.parse(
          window.localStorage.getItem("__supabaseTestState") || '{"calls":[]}'
        ).calls || []
      );
    } catch (error) {
      return [];
    }
  });
}

async function expectCanonicalFavicon(page) {
  const favicon = await page.evaluate(() => {
    const icon = document.querySelector('link[rel="icon"]');
    const shortcut = document.querySelector('link[rel="shortcut icon"]');
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    return {
      iconHref: icon?.getAttribute("href") || "",
      shortcutHref: shortcut?.getAttribute("href") || "",
      appleHref: apple?.getAttribute("href") || "",
      iconCount: document.querySelectorAll('link[rel="icon"]').length,
    };
  });

  expect(favicon.iconHref).toBe(
    "https://frlujqujvpqwvtavofdq.supabase.co/storage/v1/object/public/Site%20Images/favicon.png"
  );
  expect(favicon.shortcutHref).toBe(favicon.iconHref);
  expect(favicon.appleHref).toBe(favicon.iconHref);
  expect(favicon.iconCount).toBe(1);
}

test("auth shell loads", async ({ page }) => {
  await stubSupabase(page);
  await page.goto("/");
  await expectCanonicalFavicon(page);
  await expect(page.locator("#open-login-btn")).toBeVisible();
  await expect(page.locator("#open-signup-btn")).toBeVisible();
  await expect(page.locator("#hero-signup-btn")).toBeVisible();
  await expect(page.locator("#authModal")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/dark-mode/);
  await expect(page.locator("#landing-background-image")).toHaveAttribute(
    "src",
    "https://frlujqujvpqwvtavofdq.supabase.co/storage/v1/object/public/Site%20Images/background.png"
  );

  await page.click("#open-login-btn");
  await expect(page.locator("#authModal")).toBeVisible();
  await expect(page.locator("#signin-form")).toBeVisible();
  await expect(page.locator("#google-signin-btn")).toBeVisible();
});

test("root recovery links reroute to the update password page", async ({
  page,
}) => {
  await stubSupabase(page);
  await page.goto(
    "/?next=%2Fdashboard%2F#access_token=recovery-token&refresh_token=refresh-token&type=recovery"
  );

  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/update-password/");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("next"))
    .toBe("/dashboard/");
  await expect.poll(() => new URL(page.url()).hash).toContain("type=recovery");
});

test("forgot password request stays inline on the auth page", async ({
  page,
}) => {
  await stubSupabase(page);
  await page.goto("/?next=%2Faccount%2F");
  await page.click("#open-signup-btn");
  await page.fill("#signup-display-name", "Keith Learner");
  await page.fill("#signin-email", "doctor@example.com");
  await page.fill("#signin-password", "newpassword");
  await page.click("#signin-submit-btn");
  await expect(page.locator("#auth-feedback")).toContainText(
    "Account created."
  );
  await page.click("#toggleModeBtn");
  await page.click("#forgotPasswordLink");

  await expect(page.locator("#modalTitle")).toContainText("Reset");
  await expect(page.locator("#modalSubtitle")).toContainText(
    "send you a reset link"
  );
  await expect(page.locator("#submitBtnText")).toHaveText("Send Reset Link");
  await expect(page.locator("#passwordInputGroup")).toBeHidden();
  await expect(page.locator("#google-signin-btn")).toBeHidden();

  await page.fill("#signin-email", "doctor@example.com");
  await page.click("#signin-submit-btn");
  await expect(page.locator("#auth-feedback")).toContainText(
    "If an account exists for that email"
  );
  await expect(
    page.locator('a[href="mailto:bitramed91@gmail.com"]')
  ).toHaveCount(2);

  const calls = await readSupabaseCallLog(page);
  const resetCall = calls.find((call) => call.name === "resetPasswordForEmail");
  expect(resetCall?.email).toBe("doctor@example.com");
  expect(
    new URL(resetCall?.redirectTo || "https://bitramed.com").pathname
  ).toBe("/update-password/");
  expect(
    new URL(resetCall?.redirectTo || "https://bitramed.com").searchParams.get(
      "next"
    )
  ).toBe("/account/");

  await page.click("#toggleModeBtn");
  await expect(page.locator("#modalTitle")).toContainText("Welcome");
  await expect(page.locator("#passwordInputGroup")).toBeVisible();
});

test("password reset page shows an expired-link state without recovery session", async ({
  page,
}) => {
  await stubSupabase(page);
  await page.goto("/update-password/");
  await expectCanonicalFavicon(page);

  await expect(page.locator("#resetInvalidState")).toBeVisible();
  await expect(
    page.locator('#resetInvalidState a[href="mailto:bitramed91@gmail.com"]')
  ).toBeVisible();
});

test("password reset page validates and returns to login after success", async ({
  page,
}) => {
  await stubSupabase(page, { recoverySession: true });
  await page.goto("/update-password/?next=%2Fdashboard%2F");

  await expect(page.locator("#passwordResetForm")).toBeVisible();

  await page.fill("#reset-password", "123");
  await page.fill("#reset-password-confirm", "123");
  await page.click("#passwordResetSubmit");
  await expect(page.locator("#password-reset-feedback")).toContainText(
    "at least 6 characters"
  );

  await page.fill("#reset-password", "newpassword");
  await page.fill("#reset-password-confirm", "different");
  await page.click("#passwordResetSubmit");
  await expect(page.locator("#password-reset-feedback")).toContainText(
    "Passwords do not match."
  );

  await page.fill("#reset-password", "newpassword");
  await page.fill("#reset-password-confirm", "newpassword");
  await page.click("#passwordResetSubmit");

  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("#authModal")).toBeVisible();
  await expect(page.locator("#auth-feedback")).toContainText(
    "Password updated. Sign in with your new password."
  );

  const calls = await readSupabaseCallLog(page);
  expect(
    calls.some(
      (call) => call.name === "updateUser" && call.passwordLength === 11
    )
  ).toBe(true);
  expect(calls.some((call) => call.name === "signOut")).toBe(true);
});

test("learner dashboard shell loads", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, theme: "dark" });
  await page.goto("/dashboard/");
  await expectCanonicalFavicon(page);
  await expect(page.locator("#access-view")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/dark-mode/);
  await expect(
    page.locator(
      [
        "#btn-back-modules",
        "#btn-home-modules",
        "#btn-back-subtopics-view",
        "#btn-home-subtopics",
        "#btn-back-types",
        "#btn-home-types",
        "#btn-back-subtopics",
        "#btn-home-quizzes",
        "#btn-back-modes",
        "#btn-home-setup",
        "#btn-quit-quiz",
        "#btn-back-results",
        "#btn-back-account",
        "#btn-back-settings",
      ].join(", ")
    )
  ).toHaveCount(0);
  const bodyBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor
  );
  expect(bodyBackground).not.toBe("rgb(0, 0, 0)");
  const topbarMetrics = await page.evaluate(() => {
    const topbar = document.querySelector(".app-shell > .topbar");
    const brand = document.getElementById("brand-home-btn");
    return {
      topbarWidth: Math.round(topbar?.getBoundingClientRect().width || 0),
      viewportWidth: window.innerWidth,
      brandBorderWidth: brand ? getComputedStyle(brand).borderTopWidth : "",
    };
  });
  expect(
    Math.abs(topbarMetrics.topbarWidth - topbarMetrics.viewportWidth)
  ).toBeLessThanOrEqual(2);
  expect(topbarMetrics.brandBorderWidth).toBe("0px");
  await page.click("#menu-toggle-btn");
  await expect(page.locator("#topbar-menu")).toHaveClass(/is-open/);
  await expect(page.locator("#menu-backdrop")).toHaveClass(/is-visible/);
  const menuHost = await page.evaluate(() => {
    const menu = document.getElementById("topbar-menu");
    return {
      insideTopbar: !!menu?.closest(".topbar"),
      parentId: menu?.parentElement?.id || "",
    };
  });
  expect(menuHost.insideTopbar).toBe(false);
  expect(menuHost.parentId).toBe("");
});

test("learner menu routes and tools work", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, hasAccess: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/");
  await expect(page.locator("#dashboard-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.click("#menu-toggle-btn");
  await page.click("#menu-account-btn");
  await expect(page.locator("#account-view")).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/account/);

  await page.click("#menu-toggle-btn");
  await page.click("#menu-settings-btn");
  await expect(page.locator("#settings-view")).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/settings/);

  await page.click("#menu-toggle-btn");
  await page.click("#search-toggle-btn");
  await expect(page.locator("#search-overlay")).toHaveClass(/is-open/);
  await page.click("#search-close-btn");

  await page.click("#menu-toggle-btn");
  await page.click("#menu-home-btn");
  await expect(page.locator("#dashboard-view")).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/dashboard/);
  await expectNoHorizontalOverflow(page);
});

test("learner menu opens from the top after page scroll and resets its own scroll", async ({
  page,
}) => {
  await stubSupabase(page, { signedIn: true, hasAccess: true, theme: "dark" });
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto(
    "/quizzes/?level=Year%201&area=Anatomy&sub=Introduction%20to%20Anatomy&type=tf"
  );
  await expect(page.locator("#quiz-list-view")).toBeVisible();

  await page.evaluate(() => {
    document.body.style.minHeight = "3000px";
    window.scrollTo(0, document.body.scrollHeight);
  });

  await page.click("#menu-toggle-btn");
  await expect(page.locator("#topbar-menu")).toHaveClass(/is-open/);
  const openedMetrics = await page.evaluate(() => {
    const menu = document.getElementById("topbar-menu");
    const body = menu?.querySelector(".menu-sheet-body");
    return {
      top: Math.round(menu?.getBoundingClientRect().top || 0),
      bodyScrollTop: Math.round(body?.scrollTop || 0),
    };
  });

  expect(openedMetrics.top).toBeLessThanOrEqual(1);
  expect(openedMetrics.bodyScrollTop).toBe(0);

  await page.evaluate(() => {
    const body = document.querySelector("#topbar-menu .menu-sheet-body");
    if (body) body.scrollTop = 420;
  });

  await page.click("#menu-backdrop");
  await page.click("#menu-toggle-btn");

  const reopenedScrollTop = await page.evaluate(() => {
    const body = document.querySelector("#topbar-menu .menu-sheet-body");
    return Math.round(body?.scrollTop || 0);
  });

  expect(reopenedScrollTop).toBe(0);
});

test("learner mobile browse routes keep full-width cards and stable stats", async ({
  page,
}) => {
  await stubSupabase(page, { signedIn: true, hasAccess: true, theme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/dashboard/");
  await expect(page.locator("#dashboard-view")).toBeVisible();
  await expectTopbarFitsViewport(page);
  await expectNoHorizontalOverflow(page);
  await expectGridColumns(page, "#dashboard-view .dashboard-summary-strip", 3);
  await expectFirstCardFillsTrack(
    page,
    "#area-grid",
    "#area-grid .browse-card-button"
  );
  await expectTrailingStaysInline(
    page,
    "#area-grid .browse-card",
    ".browse-card-content",
    ".browse-card-chevron"
  );

  await page.goto("/modules/?level=Year%201");
  await expect(page.locator("#modules-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectFirstCardFillsTrack(
    page,
    "#module-grid",
    "#module-grid .browse-card-button"
  );
  await expectTrailingStaysInline(
    page,
    "#module-grid .browse-card",
    ".browse-card-content",
    ".browse-card-chevron"
  );

  await page.goto("/subtopics/?level=Year%201&area=Anatomy");
  await expect(page.locator("#subtopics-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectFirstCardFillsTrack(
    page,
    "#subtopics-grid",
    "#subtopics-grid .browse-card-button"
  );
  await expectTrailingStaysInline(
    page,
    "#subtopics-grid .browse-card",
    ".browse-card-content",
    ".browse-card-chevron"
  );
});

test("learner mobile flow routes render without collapsing layout", async ({
  page,
}) => {
  await stubSupabase(page, { signedIn: true, hasAccess: true, theme: "dark" });
  await seedLearnerResultSnapshot(page);
  await page.setViewportSize({ width: 430, height: 932 });

  await page.goto(
    "/types/?level=Year%201&area=Anatomy&sub=Introduction%20to%20Anatomy"
  );
  await expect(page.locator("#types-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectTopbarFitsViewport(page);
  await expectGridColumns(page, "#types-view .selection-stats", 3);
  await expectTrailingStaysInline(
    page,
    "#types-grid .selection-card",
    ".selection-card-meta",
    ".selection-card-arrow"
  );

  await page.goto(
    "/quizzes/?level=Year%201&area=Anatomy&sub=Introduction%20to%20Anatomy&type=tf"
  );
  await expect(page.locator("#quiz-list-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectGridColumns(page, "#quiz-list-view .quizlist-stat-bar", 3);
  await expectTrailingStaysInline(
    page,
    "#quiz-list .quizlist-card",
    ".quizlist-card-main",
    ".quizlist-card-trailing"
  );

  await page.goto("/setup/?quizId=quiz-tf-1");
  await expect(page.locator("#setup-view")).toBeVisible();
  await expect(page.locator("#setup-performance-card")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectGridColumns(page, "#setup-view .setup-stat-bar", 3);
  await expectTrailingStaysInline(
    page,
    "#setup-view .setup-mode-actions .setup-mode-card",
    ".setup-mode-copy",
    ".setup-mode-trailing"
  );

  await page.goto("/quiz/?quizId=quiz-tf-1&mode=study");
  await expect(page.locator("#quiz-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectGridColumns(page, "#quiz-view .quiz-session-stats", 3);
  await expect(
    page.locator("#quiz-view .quiz-session-mode-badge")
  ).toContainText("TRUE / FALSE");
  await expect(page.locator("#quiz-view .tf-options").first()).toBeVisible();
  const quizShell = await page.evaluate(() => ({
    submitPosition:
      getComputedStyle(document.querySelector("#quiz-view .quiz-submit-bar"))
        .position || "",
  }));
  expect(quizShell.submitPosition).toBe("fixed");

  await page.goto("/quiz/?quizId=quiz-tf-1&mode=exam&duration=5");
  await expect(page.locator("#quiz-view")).toBeVisible();
  await expect(page.locator("#quiz-progress-copy")).toContainText(":");
  await expect(page.locator("#btn-submit")).toBeEnabled();

  await page.goto("/results/?quizId=quiz-tf-1&mode=study");
  await expect(page.locator("#results-view")).toBeVisible();
  await expect(page.locator("#results-view .results-score-hero")).toBeVisible();
  await expect(
    page.locator("#results-view .review-card").first()
  ).toBeVisible();
  await expectTrailingStaysInline(
    page,
    "#results-view .results-score-top",
    ".results-score-main",
    ".results-score-pct-block"
  );
  await expectGridColumns(page, "#results-view .results-meta-row", 2);
  await expect(page.locator("#btn-retry-results")).toContainText("Retry Quiz");
  await expect(page.locator("#btn-results-back-list")).toContainText(
    "Back to Quiz List"
  );
  await expect(page.locator("#toggle-review-wrong-btn")).toContainText(
    "0 missed"
  );
  await expect(page.locator("#toggle-review-wrong-btn")).toContainText(
    "Review Missed Only"
  );
  await expectNoHorizontalOverflow(page);

  await page.goto("/account/");
  await expect(page.locator("#account-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectTrailingStaysInline(
    page,
    "#account-recent-list .account-recent-card",
    ".account-recent-head > div",
    ".account-recent-score"
  );

  await page.goto("/settings/");
  await expect(page.locator("#settings-view")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectGridColumns(page, "#settings-view .settings-summary-strip", 3);
  await expectTrailingStaysInline(
    page,
    "#settings-view .settings-row-theme",
    ".settings-row-label",
    ".settings-theme-toggle"
  );
  await expectTrailingStaysInline(
    page,
    "#settings-view .settings-section:nth-of-type(2) .settings-row:nth-of-type(2)",
    ".settings-row-label",
    "#settings-status-chip"
  );
  await expectTrailingStaysInline(
    page,
    "#settings-view .settings-section:nth-of-type(3) .settings-row:nth-of-type(1)",
    ".settings-row-label",
    "#settings-signout-btn"
  );
});

test("past papers quizzes keep Supabase order while other quizzes still shuffle", async ({
  page,
}) => {
  await stubSupabase(page, { signedIn: true, hasAccess: true });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });

  await page.goto("/quiz/?quizId=quiz-tf-1&mode=study");
  await expect(page.locator("#quiz-view")).toBeVisible();
  await expect(page.locator("#quiz-view .question-stem")).toHaveText([
    "The heart is part of the axial skeleton.",
    "The anatomical position places the body upright.",
  ]);

  await page.goto("/quiz/?quizId=quiz-past-tf-1&mode=study");
  await expect(page.locator("#quiz-view")).toBeVisible();
  await expect(page.locator("#quiz-view .question-stem")).toHaveText([
    "Whole body imaging and bone marrow examination are important in staging lympho-proliferative diseases.",
    "Bone marrow biopsy is never used to assess marrow involvement during lymphoma staging.",
    "Disease confined to one side of the diaphragm can still be upstaged by marrow infiltration.",
  ]);

  await page.goto("/quiz/?quizId=quiz-past-tf-1&mode=exam&duration=5");
  await expect(page.locator("#quiz-view")).toBeVisible();
  await expect(page.locator("#quiz-progress-copy")).toContainText(":");
  await expect(page.locator("#quiz-view .question-stem")).toHaveText([
    "Whole body imaging and bone marrow examination are important in staging lympho-proliferative diseases.",
    "Bone marrow biopsy is never used to assess marrow involvement during lymphoma staging.",
    "Disease confined to one side of the diaphragm can still be upstaged by marrow infiltration.",
  ]);
});

test("past papers draft restore remaps old shuffled answers onto source order", async ({
  page,
}) => {
  await stubSupabase(page, { signedIn: true, hasAccess: true });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await seedPastPapersDraft(page, {
    context: {
      level: "Year 3",
      area: "Past Papers",
      sub: "Haematology",
      type: "tf",
      title: "NUST MBM 3001 Haematology I",
      mode: "study",
      durationMinutes: null,
    },
    answers: {
      q0: "FALSE",
      q1: "TRUE",
      q2: "FALSE",
    },
    questionOrder: ["id:q-past-tf-3", "id:q-past-tf-1", "id:q-past-tf-2"],
    savedAt: "2026-04-01T08:00:00.000Z",
  });

  await page.goto("/quiz/?quizId=quiz-past-tf-1&mode=study");
  await expect(page.locator("#quiz-view")).toBeVisible();
  await expect(page.locator("#quiz-view .question-stem")).toHaveText([
    "Whole body imaging and bone marrow examination are important in staging lympho-proliferative diseases.",
    "Bone marrow biopsy is never used to assess marrow involvement during lymphoma staging.",
    "Disease confined to one side of the diaphragm can still be upstaged by marrow infiltration.",
  ]);

  const checkedValues = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll("#quiz-view .question-card"),
      (_, index) =>
        document.querySelector(`#quiz-view input[name="q${index}"]:checked`)
          ?.value || null
    )
  );
  expect(checkedValues).toEqual(["TRUE", "FALSE", "FALSE"]);
});

test("learner mobile access gate fits the viewport", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, hasAccess: false, theme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/");
  await expect(page.locator("#access-view")).toBeVisible();
  await expectTopbarFitsViewport(page);
  await expectNoHorizontalOverflow(page);
  await expectTrailingStaysInline(
    page,
    "#access-view .access-identity-pill",
    ".access-identity-main",
    ".access-identity-status"
  );
});

test("admin shell loads", async ({ page }) => {
  await stubSupabase(page, { signedIn: true });
  await page.goto("/JAK2V617F/");
  await expectCanonicalFavicon(page);
  await expect(page.locator("#admin-denied-view")).toBeVisible();
});

test("admin overview promotes the silent cohort card", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, isAdmin: true });
  await page.goto("/JAK2V617F/");
  await expect(page.locator("#admin-menu-main")).toBeVisible();
  await expect(page.locator(".admin-route-nav .admin-route-link")).toHaveText([
    "Overview",
  ]);
  await expect(page.locator("#admin-overview-active-count")).toHaveText("1");

  const workspaceCardTitles = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        ".admin-overview-workspace-grid > .admin-choice-card"
      )
    )
      .map((card) => ({
        title:
          card.querySelector(".admin-choice-title")?.textContent?.trim() || "",
        top: Math.round(card.getBoundingClientRect().top),
        left: Math.round(card.getBoundingClientRect().left),
      }))
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .map((card) => card.title)
  );

  expect(workspaceCardTitles).toEqual([
    "Performance Stats",
    "Active but Silent",
    "Access Control",
  ]);
});

test("admin stats workspace renders executive sections", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, isAdmin: true });
  await page.goto("/JAK2V617F/stats/");
  await expect(page.locator("#admin-stats-shell")).toBeVisible();
  await expect(page.locator("#admin-story-card")).toBeVisible();
  await expect(page.locator("#admin-stats-users")).toHaveText("2");
  await expect(page.locator("#admin-stats-completed")).toHaveText("6");
  await expect(page.locator("#admin-stats-average")).toHaveText("81%");
  await expect(page.locator("#admin-recent-section-count")).toHaveText(
    "1 recent attempts"
  );
  await expect(page.locator("#admin-user-list")).toContainText("Amina Ncube");
  await expect(page.locator("#admin-user-list")).not.toContainText(
    "Tariro Dube"
  );
  await expect(page.locator("#admin-user-list")).not.toContainText(
    "Admin Pilot"
  );
  await expect(page.locator("#admin-user-list")).not.toContainText(
    "Owner Root"
  );
  await expect(page.locator("#admin-recent-list")).toContainText("Amina Ncube");
  await expect(page.locator("#admin-recent-list")).not.toContainText(
    "Tariro Dube"
  );
  await expect(page.locator("#admin-recent-list")).not.toContainText(
    "Admin Pilot"
  );
  await expect(
    page.locator("#admin-overview-grid .admin-metric-card")
  ).toHaveCount(4);
  await expect(
    page.locator("#admin-user-highlights .admin-signal-card")
  ).toHaveCount(3);
  await expect(
    page.locator("#admin-course-grid .admin-course-card")
  ).toHaveCount(1);
  const statsListSemantics = await page.evaluate(() =>
    [
      "admin-course-grid",
      "admin-recent-list",
      "admin-ranked-users",
      "admin-user-list",
    ].map((id) => {
      const host = document.getElementById(id);
      const list = host?.querySelector(":scope > .admin-data-list");
      const firstRow = list?.querySelector(".admin-list-row");
      return {
        id,
        listTag: list?.tagName || "",
        rowTag: firstRow?.tagName || "",
      };
    })
  );
  statsListSemantics.forEach((entry) => {
    expect(entry.listTag).toBe("UL");
    expect(entry.rowTag).toBe("LI");
  });
  const adminLayout = await page.evaluate(() => {
    const overviewGrid = document.getElementById("admin-overview-grid");
    const detailGrid = document.querySelector(".admin-stats-detail-grid");
    const topbar = document.querySelector(".app-shell > .topbar");
    const mainWrap = document.querySelector(".main-wrap");
    return {
      overviewColumns: overviewGrid
        ? getComputedStyle(overviewGrid).gridTemplateColumns
        : "",
      detailColumns: detailGrid
        ? getComputedStyle(detailGrid).gridTemplateColumns
        : "",
      topbarWidth: Math.round(topbar?.getBoundingClientRect().width || 0),
      viewportWidth: window.innerWidth,
      mainWrapWidth: Math.round(mainWrap?.getBoundingClientRect().width || 0),
    };
  });
  expect(adminLayout.overviewColumns.split(" ").filter(Boolean)).toHaveLength(
    4
  );
  expect(adminLayout.detailColumns.split(" ").filter(Boolean)).toHaveLength(1);
  expect(
    Math.abs(adminLayout.topbarWidth - adminLayout.viewportWidth)
  ).toBeLessThanOrEqual(2);
  expect(adminLayout.mainWrapWidth).toBeGreaterThanOrEqual(900);
});

test("admin access workspace renders category menu", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, isAdmin: true });
  await page.goto("/JAK2V617F/access-control/");
  await expect(page.locator("#admin-access-shell")).toBeVisible();
  await expect(
    page.locator("#admin-access-menu [data-access-category]")
  ).toHaveCount(4);
});

test("admin mobile layouts stay inside the viewport", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, isAdmin: true, theme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/JAK2V617F/stats/");
  await expect(page.locator("#admin-stats-shell")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page.locator("#admin-story-card")).toBeVisible();
  await expectGridColumns(page, "#admin-stats-shell .stats-kpi-strip", 1);
  await expectGridColumns(page, "#admin-overview-grid", 1);
  await expectGridColumns(page, "#admin-user-highlights", 1);

  await page.goto("/JAK2V617F/access-control/?status=active");
  await expect(page.locator("#admin-access-shell")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectGridColumns(
    page,
    "#admin-access-shell .admin-access-summary-strip",
    2
  );
  await expectGridColumns(
    page,
    "#admin-access-list .admin-access-row:first-child .admin-access-time-row",
    2
  );
  await expectGridColumns(
    page,
    "#admin-access-list .admin-access-row:first-child .admin-access-actions",
    2
  );
  await expectTrailingStaysInline(
    page,
    "#admin-access-list .admin-access-row:first-child .admin-access-identity",
    ".admin-access-identity-body",
    ".admin-access-status"
  );
  const accessLayout = await page.evaluate(() => {
    const row = document.querySelector(".admin-access-row");
    const actions = row?.querySelector(".admin-access-actions");
    const timeRow = row?.querySelector(".admin-access-time-row");
    const firstButton = row?.querySelector(".admin-access-btn");
    const rowRect = row?.getBoundingClientRect();
    const buttonRect = firstButton?.getBoundingClientRect();
    return {
      actionColumns: actions
        ? getComputedStyle(actions)
            .gridTemplateColumns.split(" ")
            .filter(Boolean).length
        : 0,
      timeColumns: timeRow
        ? getComputedStyle(timeRow)
            .gridTemplateColumns.split(" ")
            .filter(Boolean).length
        : 0,
      rowRight: Math.round(rowRect?.right || 0),
      buttonRight: Math.round(buttonRect?.right || 0),
      viewportWidth: window.innerWidth,
    };
  });
  expect(accessLayout.actionColumns).toBe(2);
  expect(accessLayout.timeColumns).toBe(2);
  expect(accessLayout.rowRight).toBeLessThanOrEqual(
    accessLayout.viewportWidth + 1
  );
  expect(accessLayout.buttonRight).toBeLessThanOrEqual(
    accessLayout.viewportWidth + 1
  );
});

test("legacy admin route no longer exposes admin shell", async ({ page }) => {
  await stubSupabase(page, { signedIn: true, isAdmin: true });
  await page.goto("/admin/");
  await expect.poll(() => new URL(page.url()).pathname).not.toBe("/admin/");
  await expect(page.locator("#admin-dashboard-view")).toHaveCount(0);
  await expect(page.locator("#dashboard-view, #open-login-btn")).toHaveCount(1);
});
