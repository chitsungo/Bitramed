import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(
    "https://frlujqujvpqwvtavofdq.supabase.co/storage/**",
    (route) => route.fulfill({ status: 204, body: "" })
  );
  page.on("pageerror", (error) =>
    console.error(`[browser error] ${error.message}`)
  );
});

async function installSupabase(
  page,
  {
    signedIn = true,
    accessStatus = "active",
    admin = false,
    legacyContracts = false,
  } = {}
) {
  await page.addInitScript(
    ({ signedIn, accessStatus, admin, legacyContracts }) => {
      const user = signedIn
        ? {
            id: "user-1",
            email: "learner@example.com",
            email_confirmed_at: "2026-08-01T00:00:00Z",
            user_metadata: { display_name: "Amina" },
          }
        : null;
      const hasAccess = accessStatus === "active" || accessStatus === "owner";
      const access = {
        status: accessStatus,
        hasAccess,
        accessStartsAt: "2026-08-01T00:00:00Z",
        accessExpiresAt:
          accessStatus === "owner" ? null : "2026-12-01T00:00:00Z",
        blockReason: accessStatus === "blocked" ? "Manual review" : "",
      };
      const preferences = {
        theme: "system",
        textSize: "normal",
        reducedMotion: false,
        defaultMode: "study",
        defaultDurationMinutes: null,
        defaultNegativeMarking: false,
      };
      const attempts = [
        {
          kind: "quiz",
          attemptId: "41",
          quizId: "quiz-1",
          setId: null,
          level: "Year 1",
          area: "Anatomy",
          sub: "Introduction",
          title: "Anatomy essentials",
          mode: "study",
          score: 2,
          total: 2,
          correct: 2,
          wrong: 0,
          unanswered: 0,
          percentage: 100,
          completedAt: "2026-08-30T10:00:00Z",
        },
      ];
      const ok = (data = null) => Promise.resolve({ data, error: null });
      const inserted = {
        select: () => ({ single: () => ok({ id: "61" }) }),
        then(resolve, reject) {
          return ok(null).then(resolve, reject);
        },
      };
      const builder = () => {
        const chain = {
          upsert: () => ok(null),
          insert: () => inserted,
          delete: () => chain,
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          single: () => ok(null),
          maybeSingle: () => ok(null),
          then(resolve, reject) {
            return Promise.resolve({ data: null, error: null }).then(
              resolve,
              reject
            );
          },
        };
        return chain;
      };
      window.__rpcCalls = [];
      const rpcData = (name, params) => {
        window.__rpcCalls.push({ name, params });
        if (name === "app_shell_bootstrap_v2") {
          return { schemaVersion: 2, access, preferences };
        }
        if (name === "app_shell_bootstrap") {
          return {
            schemaVersion: 1,
            access,
            themePreference: "light",
          };
        }
        if (name === "app_home_bootstrap_v2") {
          return {
            schemaVersion: 2,
            access,
            preferences,
            dashboard: {
              attemptCount: 2,
              activeYears: 1,
              completedCount: 2,
              averageScore: 88,
              levels: [
                {
                  levelId: "level-1",
                  name: "Year 1",
                  displayOrder: 1,
                  courseCount: 1,
                  doneCount: 1,
                  totalCount: 2,
                  percent: 50,
                },
              ],
              pastPaperYears: [
                {
                  year: "Year 1",
                  examCount: 1,
                  totalMarks: 2,
                  bestPercentage: 100,
                },
              ],
            },
            bestAttempt: { percentage: 100 },
            drafts: [],
            recentAttempts: attempts,
          };
        }
        if (name === "app_home_bootstrap") {
          return {
            schemaVersion: 1,
            access,
            themePreference: "light",
            dashboard: {
              activeYears: 1,
              completedCount: 2,
              averageScore: 88,
              levels: [
                {
                  levelId: "level-1",
                  name: "Year 1",
                  displayOrder: 1,
                  courseCount: 1,
                  doneCount: 1,
                  totalCount: 2,
                  percent: 50,
                },
              ],
              pastPaperYears: [
                {
                  year_label: "Year 1",
                  exam_count: 1,
                  total_marks: 2,
                  best_percentage: 100,
                },
              ],
            },
          };
        }
        if (name === "app_year_overview") {
          return {
            normal: { courseCount: 1, percent: 50 },
            pastPaper: { examCount: 1, bestPercentage: 100 },
          };
        }
        if (name === "app_browse_courses") {
          return {
            courses: [
              {
                courseId: "course-1",
                name: "Anatomy",
                moduleCount: 1,
                totalCount: 1,
                percent: 0,
              },
            ],
          };
        }
        if (name === "app_browse_subtopics") {
          return {
            subtopics: [
              {
                subtopicId: "sub-1",
                name: "Introduction",
                totalCount: 1,
                percent: 0,
              },
            ],
          };
        }
        if (name === "app_browse_types") {
          return {
            totalQuestions: 2,
            totalQuizCount: 1,
            percent: 0,
            types: [{ type: "tf", quizCount: 1, questionCount: 2, percent: 0 }],
          };
        }
        if (name === "app_browse_quizzes") {
          return {
            summary: {
              assessmentCount: 1,
              completedCount: 0,
              averageBestPercentage: 0,
            },
            quizzes: [
              {
                quizId: "quiz-1",
                title: "Anatomy essentials",
                questionCount: 2,
                totalAttempts: 1,
                bestPercentage: 100,
              },
            ],
          };
        }
        if (name === "app_learning_search") {
          return {
            schemaVersion: 2,
            query: String(params.p_query || ""),
            results: [
              {
                kind: "quiz",
                id: "quiz-1",
                title: "Anatomy essentials",
                level: "Year 1",
                area: "Anatomy",
                sub: "Introduction",
                type: "tf",
                itemCount: 2,
              },
              {
                kind: "past_paper",
                id: "paper-1",
                title: "Anatomy Past Paper",
                level: "Year 1",
                area: "Anatomy",
                sub: "Past Paper",
                type: "past_paper",
                itemCount: 2,
              },
            ],
          };
        }
        if (name === "app_quiz_search") {
          return {
            schemaVersion: 1,
            results: [
              {
                quizId: "quiz-1",
                title: "Anatomy essentials",
                level: "Year 1",
                area: "Anatomy",
                sub: "Introduction",
                type: "tf",
                count: 2,
              },
            ],
          };
        }
        if (name === "app_quiz_session_v2") {
          return {
            schemaVersion: 2,
            descriptor: {
              quiz_id: "quiz-1",
              quiz_title: "Anatomy essentials",
              question_type: "tf",
              level: "Year 1",
              area: "Anatomy",
              sub: "Introduction",
            },
            questions: [
              {
                id: "q1",
                position: 1,
                questionText: "The anatomical position is upright.",
              },
              {
                id: "q2",
                position: 2,
                questionText: "The heart is a bone.",
              },
            ],
            progress: null,
          };
        }
        if (name === "app_quiz_session") {
          return {
            schemaVersion: 1,
            descriptor: {
              quiz_id: "quiz-1",
              quiz_title: "Anatomy essentials",
              question_type: "tf",
              level: "Year 1",
              area: "Anatomy",
              sub: "Introduction",
            },
            questions: [
              {
                id: "q1",
                question_text: "The anatomical position is upright.",
                correct_answer: "TRUE",
                explanation: "This is the standard reference position.",
              },
              {
                id: "q2",
                question_text: "The heart is a bone.",
                correct_answer: "FALSE",
                explanation: "The heart is an organ.",
              },
            ],
            progress: null,
          };
        }
        if (name === "app_check_quiz_answer") {
          const expected = params.p_question_id === "q1" ? "TRUE" : "FALSE";
          return {
            questionId: params.p_question_id,
            isCorrect: params.p_answer === expected,
            correctAnswer: expected,
            explanation:
              params.p_question_id === "q1"
                ? "This is the standard reference position."
                : "The heart is an organ.",
          };
        }
        if (name === "app_submit_quiz_attempt") {
          return {
            attemptId: "41",
            quizId: "quiz-1",
            submissionId: params.p_submission_id,
            mode: params.p_mode,
            score: 2,
            totalQuestions: 2,
            correct: 2,
            wrong: 0,
            unanswered: 0,
            percentage: 100,
            durationMinutes: null,
            negativeMarking: false,
            timedOut: false,
          };
        }
        if (name === "app_attempt_history") {
          return {
            schemaVersion: 2,
            summary: {
              attempts: 1,
              averagePercentage: 100,
              bestPercentage: 100,
            },
            items: attempts,
            nextCursor: null,
          };
        }
        if (name === "app_quiz_attempt_review") {
          return {
            schemaVersion: 2,
            detailAvailable: true,
            attempt: {
              ...attempts[0],
              totalQuestions: attempts[0].total,
              durationMinutes: null,
              negativeMarking: false,
              timedOut: false,
            },
            items: [
              {
                questionId: "q1",
                position: 1,
                questionText: "The anatomical position is upright.",
                userAnswer: "TRUE",
                correctAnswer: "TRUE",
                explanation: "This is the standard reference position.",
                isCorrect: true,
                points: 1,
              },
              {
                questionId: "q2",
                position: 2,
                questionText: "The heart is a bone.",
                userAnswer: "FALSE",
                correctAnswer: "FALSE",
                explanation: "The heart is an organ.",
                isCorrect: true,
                points: 1,
              },
            ],
          };
        }
        if (name === "app_account_page") {
          return {
            attemptsCount: 2,
            quizzesDoneCount: 2,
            averagePercentage: 88,
            bestAttempt: { percentage: 100, mode: "study" },
            sectionStats: {
              normal: { attemptsCount: 1, averagePercentage: 100 },
              exam: { attemptsCount: 1, averagePercentage: 75 },
            },
            courseStats: [{ area: "Year 1 - Anatomy", averagePercentage: 88 }],
            recentAttempts: attempts,
          };
        }
        if (name === "app_past_paper_years") {
          return [
            {
              year_label: "Year 1",
              exam_count: 1,
              total_marks: 2,
              best_percentage: 100,
            },
          ];
        }
        if (name === "app_past_paper_topics") {
          return [
            {
              topic_label: "Anatomy",
              exam_count: 1,
              total_marks: 2,
              best_percentage: 100,
            },
          ];
        }
        if (name === "app_past_paper_exams") {
          return [
            {
              set_id: "paper-1",
              title: "Anatomy Past Paper",
              unit_count: 1,
              total_marks: 2,
              best_percentage: 100,
            },
          ];
        }
        if (name === "app_past_paper_session") {
          return {
            paper: {
              set_id: "paper-1",
              title: "Anatomy Past Paper",
              year_label: "Year 1",
              topic_label: "Anatomy",
            },
            units: [
              {
                unit_id: "unit-1",
                stem: "Assess both statements.",
                branches: [
                  {
                    branchId: "b1",
                    order: 1,
                    prompt: "The anatomical position is upright.",
                  },
                  { branchId: "b2", order: 2, prompt: "The heart is a bone." },
                ],
              },
            ],
            progress: null,
          };
        }
        if (name === "app_submit_past_paper_attempt_v2") {
          return {
            attemptId: "52",
            setId: "paper-1",
            submissionId: params.p_submission_id,
            mode: "exam",
            score: 2,
            totalQuestions: 2,
            correct: 2,
            wrong: 0,
            unanswered: 0,
            percentage: 100,
            durationMinutes: params.p_duration_minutes,
            negativeMarking: params.p_negative_marking,
            timedOut: false,
          };
        }
        if (name === "app_submit_past_paper_attempt") {
          return {
            attemptId: "52",
            setId: "paper-1",
            score: 2,
            totalMarks: 2,
            correct: 2,
            wrong: 0,
            unanswered: 0,
            percentage: 100,
            durationMinutes: params.p_duration_minutes,
            negativeMarking: params.p_negative_marking,
            timedOut: false,
          };
        }
        if (name === "app_past_paper_attempt_review_v2") {
          return {
            schemaVersion: 2,
            detailAvailable: true,
            attempt: {
              ...attempts[0],
              kind: "past_paper",
              attemptId: "52",
              quizId: null,
              setId: "paper-1",
              title: "Anatomy Past Paper",
              mode: "exam",
              totalQuestions: attempts[0].total,
              durationMinutes: null,
              negativeMarking: false,
              timedOut: false,
            },
            units: [
              {
                unitId: "unit-1",
                stem: "Assess both statements.",
                branches: [
                  {
                    branchId: "b1",
                    order: 1,
                    prompt: "The anatomical position is upright.",
                    userAnswer: true,
                    correctAnswer: true,
                    isCorrect: true,
                    points: 1,
                    explanation: "This is the standard reference position.",
                  },
                ],
              },
            ],
          };
        }
        if (name === "app_past_paper_attempt_review") {
          return {
            attempt: {
              attemptId: "52",
              setId: "paper-1",
              title: "Anatomy Past Paper",
              yearLabel: "Year 1",
              topicLabel: "Anatomy",
              score: 2,
              totalMarks: 2,
              correct: 2,
              wrong: 0,
              unanswered: 0,
              percentage: 100,
              durationMinutes: null,
              negativeMarking: false,
              timedOut: false,
              completedAt: "2026-08-30T10:00:00Z",
            },
            units: [],
          };
        }
        if (
          name === "app_clear_assessment_drafts" ||
          name === "app_reset_account_history"
        ) {
          return { drafts: 1 };
        }
        if (name === "is_current_user_admin") return admin;
        if (name === "admin_overview_stats") {
          return [
            {
              total_users: 1,
              active_users: 1,
              total_attempts: 2,
              total_quizzes_done: 1,
              average_percentage: 88,
            },
          ];
        }
        if (name === "admin_user_summaries") {
          return [
            {
              user_id: "user-1",
              display_name: "Amina",
              email: "learner@example.com",
              total_attempts: 2,
              quizzes_done: 1,
              average_percentage: 88,
              best_percentage: 100,
              strongest_area: "Anatomy",
              weakest_area: "",
              latest_activity: "2026-08-30T10:00:00Z",
            },
          ];
        }
        if (name === "admin_course_summaries") return [];
        if (
          name === "admin_recent_attempts" ||
          name === "admin_past_paper_attempts"
        )
          return [];
        if (name === "admin_list_user_access") return [];
        return [];
      };
      window.supabase = {
        createClient: () => ({
          auth: {
            getSession: () => ok({ session: user ? { user } : null }),
            getUser: () => ok({ user }),
            signOut: () => ok(),
            signInWithPassword: () => ok({ user }),
            signInWithOAuth: () => ok(),
            signUp: () => ok({ session: null, user: null }),
            resetPasswordForEmail: () => ok(),
            updateUser: () => ok({ user }),
            verifyOtp: () => ok(),
            onAuthStateChange: () => ({
              data: { subscription: { unsubscribe() {} } },
            }),
          },
          rpc: (name, params = {}) => {
            if (
              legacyContracts &&
              [
                "app_shell_bootstrap_v2",
                "app_home_bootstrap_v2",
                "app_learning_search",
                "app_quiz_session_v2",
                "app_check_quiz_answer",
                "app_submit_quiz_attempt",
                "app_attempt_history",
                "app_quiz_attempt_review",
                "app_submit_past_paper_attempt_v2",
                "app_past_paper_attempt_review_v2",
                "app_clear_assessment_drafts",
              ].includes(name)
            ) {
              return Promise.resolve({
                data: null,
                error: {
                  code: "PGRST202",
                  message: `Could not find the function public.${name} in the schema cache`,
                },
              });
            }
            if (
              localStorage.getItem("test:assessment-offline") === "1" &&
              ["app_quiz_session_v2", "app_past_paper_session"].includes(name)
            ) {
              return Promise.resolve({
                data: null,
                error: { code: "NETWORK", message: "Network offline" },
              });
            }
            return ok(rpcData(name, params));
          },
          from: () => builder(),
        }),
      };
    },
    { signedIn, accessStatus, admin, legacyContracts }
  );
}

test("landing authentication controls open", async ({ page }) => {
  await installSupabase(page, { signedIn: false });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "High-Yield Medical Revision." })
  ).toBeVisible();
  await page.locator("#open-login-btn").click();
  await expect(
    page.getByRole("dialog", { name: "Welcome back, doctor." })
  ).toBeVisible();
});

for (const [status, heading] of [
  ["no_access", "Activation required"],
  ["expired", "Access expired"],
  ["blocked", "Account blocked"],
]) {
  test(`learner ${status} access state is enforced`, async ({ page }) => {
    await installSupabase(page, { accessStatus: status });
    await page.goto("/home/");
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });
}

test("learner shell navigates and unified search returns both content types", async ({
  page,
}) => {
  await installSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home/");
  await expect(page.locator("#home-view")).toBeVisible();
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await expect(page.locator("#learn-view")).toBeVisible();
  await page.locator("#search-toggle-btn").click();
  await page.locator("#global-search").fill("anatomy");
  await expect(
    page.getByText("Anatomy essentials", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Anatomy Past Paper", { exact: true })
  ).toBeVisible();
});

test("learner app remains usable before the v2 database rollout", async ({
  page,
}) => {
  await installSupabase(page, { legacyContracts: true });
  await page.goto("/home/");
  await expect(page.locator("#home-view")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Amina" })
  ).toBeVisible();
  await page.locator("#search-toggle-btn").click();
  await page.locator("#global-search").fill("anatomy");
  await expect(
    page.getByText("Anatomy essentials", { exact: true })
  ).toBeVisible();

  await page.goto("/quiz/?quizId=quiz-1&mode=study&negative=0");
  await page.getByRole("button", { name: "T True", exact: true }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "F False", exact: true }).click();
  await page.getByRole("button", { name: /Submit/ }).click();
  await expect(page.locator("#history-review-view")).toBeVisible();
});

test("study mode checks answers immediately and submits to durable review", async ({
  page,
}) => {
  await installSupabase(page);
  await page.goto("/quiz/?quizId=quiz-1&mode=study&negative=0");
  await page.getByRole("button", { name: "T True", exact: true }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "F False", exact: true }).click();
  await page.getByRole("button", { name: /Submit/ }).click();
  await expect(page.locator("#history-review-view")).toBeVisible();
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
});

test("exam mode defers answer checking until submission", async ({ page }) => {
  await installSupabase(page);
  await page.goto("/quiz/?quizId=quiz-1&mode=exam&negative=1");
  await page.getByRole("button", { name: "T True", exact: true }).click();
  const checks = await page.evaluate(
    () =>
      window.__rpcCalls.filter((call) => call.name === "app_check_quiz_answer")
        .length
  );
  expect(checks).toBe(0);
});

test("quiz reload resumes from the local answer-key-free payload", async ({
  page,
}) => {
  await installSupabase(page);
  await page.goto("/quiz/?quizId=quiz-1&mode=exam&negative=0");
  const answer = page.getByRole("button", { name: "T True", exact: true });
  await answer.click();
  await expect(
    page.getByRole("button", { name: "True", exact: true })
  ).toHaveClass(/bg-accent/);
  await page.waitForTimeout(700);
  await page.evaluate(() =>
    localStorage.setItem("test:assessment-offline", "1")
  );
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "The anatomical position is upright.",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "True", exact: true })
  ).toHaveClass(/bg-accent/);
  const cachedPayload = await page.evaluate(async () => {
    const request = indexedDB.open("bitramed-learner", 1);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("assessment-drafts", "readonly");
    const store = transaction.objectStore("assessment-drafts");
    const draftRequest = store.get("user-1:quiz:quiz-1:current");
    return new Promise((resolve, reject) => {
      draftRequest.onsuccess = () =>
        resolve(draftRequest.result?.sessionPayload);
      draftRequest.onerror = () => reject(draftRequest.error);
    });
  });
  expect(JSON.stringify(cachedPayload)).not.toMatch(
    /correct_answer|correctAnswer|explanation/i
  );
});

test("past paper settings flow into idempotent submission and review", async ({
  page,
}) => {
  await installSupabase(page);
  await page.goto("/past-papers/exams/?year=Year%201&topic=Anatomy");
  await page.locator(".browse-card-button").click();
  await page.locator('[data-value="5"]').click();
  await page.locator(".dialog-switch-input").check();
  await page.getByRole("button", { name: "Start assessment" }).click();
  await page.getByRole("button", { name: "True", exact: true }).first().click();
  await page.getByRole("button", { name: "False", exact: true }).nth(1).click();
  await page.getByRole("button", { name: /Submit paper/ }).click();
  await expect(page.locator("#history-review-view")).toBeVisible();
});

test("history, account status, and settings are complete", async ({ page }) => {
  await installSupabase(page);
  await page.goto("/history/");
  await expect(page.locator("#history-view")).toBeVisible();
  await expect(
    page.getByText("Anatomy essentials", { exact: true })
  ).toBeVisible();
  await page.goto("/account/");
  await expect(page.getByText("Access status", { exact: true })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await page.goto("/settings/");
  await expect(
    page.getByText("Assessment defaults", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Data and storage", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Bitramed app", { exact: true })).toBeVisible();
});

test("admin remains available at its established path", async ({ page }) => {
  await installSupabase(page, { admin: true });
  await page.goto("/JAK2V617F/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(
    page.getByText("Active learners", { exact: true })
  ).toBeVisible();
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`learner home has no overflow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await installSupabase(page);
    await page.setViewportSize(viewport);
    await page.goto("/home/");
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
    expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
    await page.screenshot({
      path: `test-results/visual/learner-home-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
  });
}
