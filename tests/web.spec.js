import { expect, test } from "@playwright/test";

async function installSupabase(
  page,
  { signedIn = true, access = true, admin = false } = {}
) {
  await page.addInitScript(
    ({ signedIn, access, admin }) => {
      const user = signedIn
        ? {
            id: "user-1",
            email: "learner@example.com",
            user_metadata: { display_name: "Amina" },
          }
        : null;
      const rows = {
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
        courses: [
          {
            courseId: "course-1",
            name: "Anatomy",
            moduleCount: 1,
            totalCount: 1,
            doneCount: 0,
            percent: 0,
          },
        ],
        subtopics: [
          {
            subtopicId: "sub-1",
            name: "Introduction",
            totalCount: 1,
            doneCount: 0,
            percent: 0,
          },
        ],
        quizzes: [
          {
            quizId: "quiz-1",
            title: "Anatomy essentials",
            questionCount: 2,
            totalAttempts: 0,
            bestPercentage: null,
          },
        ],
        questions: [
          {
            id: "q1",
            question_text: "The anatomical position is upright.",
            correct_answer: "TRUE",
            explanation: "This is the standard reference position.",
            image_url: "",
          },
          {
            id: "q2",
            question_text: "The heart is a bone.",
            correct_answer: "FALSE",
            explanation: "The heart is an organ.",
            image_url: "",
          },
        ],
        paper: {
          set_id: "paper-1",
          title: "Anatomy Past Paper",
          year_label: "Year 1",
          topic_label: "Anatomy",
          unit_count: 1,
          total_marks: 2,
          best_percentage: 0,
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
      };
      const ok = (data = null) => Promise.resolve({ data, error: null });
      const builder = () => {
        const value = { data: null, error: null };
        const chain = {
          insert() {
            return ok(null);
          },
          upsert() {
            return ok(null);
          },
          delete() {
            return chain;
          },
          select() {
            return chain;
          },
          eq() {
            return chain;
          },
          order() {
            return chain;
          },
          limit() {
            return chain;
          },
          single() {
            return ok(null);
          },
          maybeSingle() {
            return ok(null);
          },
          then(resolve, reject) {
            return Promise.resolve(value).then(resolve, reject);
          },
        };
        return chain;
      };
      const rpcData = (name, params) => {
        if (name === "app_shell_bootstrap")
          return {
            access: {
              status: access ? "active" : "no_access",
              hasAccess: access,
              blockReason: "",
              accessExpiresAt: null,
            },
            themePreference: "light",
          };
        if (name === "app_home_bootstrap")
          return {
            access: { status: "active", hasAccess: true },
            themePreference: "light",
            dashboard: {
              activeYears: 1,
              completedCount: 1,
              averageScore: 75,
              levels: rows.levels,
              pastPaperYears: [
                {
                  year_label: "Year 1",
                  exam_count: 1,
                  total_marks: 2,
                  best_percentage: 0,
                },
              ],
            },
          };
        if (name === "app_year_overview")
          return {
            normal: { courseCount: 1, percent: 50 },
            pastPaper: { examCount: 1, bestPercentage: 0 },
          };
        if (name === "app_browse_courses") return { courses: rows.courses };
        if (name === "app_browse_subtopics")
          return { subtopics: rows.subtopics };
        if (name === "app_browse_types")
          return {
            totalQuestions: 2,
            totalQuizCount: 1,
            percent: 0,
            types: [{ type: "tf", quizCount: 1, questionCount: 2, percent: 0 }],
          };
        if (name === "app_browse_quizzes")
          return {
            summary: {
              assessmentCount: 1,
              completedCount: 0,
              averageBestPercentage: 0,
            },
            quizzes: rows.quizzes,
          };
        if (name === "app_quiz_search")
          return {
            results: [
              {
                quizId: "quiz-1",
                title: "Anatomy essentials",
                level: "Year 1",
                area: "Anatomy",
                sub: "Introduction",
              },
            ],
          };
        if (name === "app_quiz_session")
          return {
            descriptor: {
              quiz_id: "quiz-1",
              quiz_title: "Anatomy essentials",
              question_type: "tf",
            },
            questions: rows.questions,
            progress: null,
          };
        if (name === "app_account_page")
          return {
            attemptsCount: 2,
            quizzesDoneCount: 1,
            averagePercentage: 75,
            bestAttempt: { percentage: 100, mode: "study" },
            courseStats: [{ area: "Anatomy", averagePercentage: 75 }],
            recentAttempts: [
              {
                id: "1",
                quizTitle: "Anatomy essentials",
                area: "Anatomy",
                mode: "study",
                percentage: 100,
              },
            ],
          };
        if (name === "app_past_paper_years")
          return [
            {
              year_label: "Year 1",
              exam_count: 1,
              total_marks: 2,
              best_percentage: 0,
            },
          ];
        if (name === "app_past_paper_topics")
          return [
            {
              topic_label: "Anatomy",
              exam_count: 1,
              total_marks: 2,
              best_percentage: 0,
            },
          ];
        if (name === "app_past_paper_exams") return [rows.paper];
        if (name === "app_past_paper_session")
          return { paper: rows.paper, units: rows.units, progress: null };
        if (name === "app_submit_past_paper_attempt") return { attemptId: "1" };
        if (name === "app_past_paper_attempt_review")
          return {
            attempt: {
              title: "Anatomy Past Paper",
              score: 2,
              totalMarks: 2,
              correct: 2,
              percentage: 100,
            },
            units: [
              {
                stem: "Assess both statements.",
                branches: [
                  {
                    prompt: "The anatomical position is upright.",
                    userAnswer: true,
                    correctAnswer: true,
                    isCorrect: true,
                  },
                ],
              },
            ],
          };
        if (name === "is_current_user_admin") return admin;
        if (name === "admin_overview_stats")
          return [
            {
              total_users: 1,
              active_users: 1,
              total_attempts: 2,
              total_quizzes_done: 1,
              average_percentage: 75,
            },
          ];
        if (name === "admin_user_summaries")
          return [
            {
              user_id: "user-1",
              display_name: "Amina",
              email: "learner@example.com",
              total_attempts: 2,
              quizzes_done: 1,
              average_percentage: 75,
              best_percentage: 100,
              strongest_area: "Anatomy",
              weakest_area: "",
              latest_activity: "2026-08-30T10:00:00Z",
            },
          ];
        if (name === "admin_course_summaries")
          return [
            {
              area: "Anatomy",
              total_attempts: 2,
              unique_users: 1,
              average_percentage: 75,
              best_user_average: 75,
            },
          ];
        if (
          name === "admin_recent_attempts" ||
          name === "admin_past_paper_attempts"
        )
          return [];
        if (name === "admin_list_user_access")
          return [
            {
              user_id: "user-1",
              email: "learner@example.com",
              display_name: "Amina",
              access_starts_at: null,
              access_expires_at: "2026-12-01T00:00:00Z",
              blocked_at: null,
              block_reason: null,
              notes: null,
              status: "active",
              granted_by: null,
              updated_at: null,
            },
          ];
        if (name === "app_reset_account_history") return true;
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
            updateUser: () => ok(),
            verifyOtp: () => ok(),
            onAuthStateChange: () => ({
              data: { subscription: { unsubscribe() {} } },
            }),
          },
          rpc: (name, params = {}) => ok(rpcData(name, params)),
          from: () => builder(),
        }),
      };
    },
    { signedIn, access, admin }
  );
}

test("landing authentication controls open", async ({ page }) => {
  await installSupabase(page, { signedIn: false });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "High-Yield Medical Revision." })
  ).toBeVisible();
  await page.locator("#open-login-btn").click();
  await expect(page.locator("#signin-form")).toBeVisible();
});

test("learner access is enforced", async ({ page }) => {
  await installSupabase(page, { access: false });
  await page.goto("/home/");
  await expect(
    page.getByRole("heading", { name: "Activation required" })
  ).toBeVisible();
});

test("learner can browse and search", async ({ page }) => {
  await installSupabase(page);
  await page.goto("/home/");
  await expect(page.locator("#home-view")).toBeVisible();
  await page
    .getByRole("link", { name: /Year 1/ })
    .first()
    .click();
  await expect(page.locator("#year-view")).toBeVisible();
  await page.locator("#search-toggle-btn").click();
  await expect(
    page.getByText("Anatomy essentials", { exact: true })
  ).toBeVisible();
});

test("quiz answers are scored and reviewed", async ({ page }) => {
  await installSupabase(page);
  await page.goto("/quiz/?quizId=quiz-1&mode=study&negative=0");
  await page.getByRole("button", { name: /TRUE/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /FALSE/ }).click();
  await page.getByRole("button", { name: /Submit/ }).click();
  await expect(page.locator("#results-view")).toBeVisible();
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
});

test("past paper settings flow through submission", async ({ page }) => {
  await installSupabase(page);
  await page.goto("/past-papers/exams/?year=Year%201&topic=Anatomy");
  await page.locator(".browse-card-button").click();
  await page.locator('[data-value="5"]').click();
  await page.locator(".dialog-switch-input").check();
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.locator("#past-paper-session-view")).toBeVisible();
  await page.getByRole("button", { name: "True", exact: true }).first().click();
  await page.getByRole("button", { name: "False", exact: true }).nth(1).click();
  await page.getByRole("button", { name: /Submit paper/ }).click();
  await expect(page.locator("#past-paper-review-view")).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
});

test("admin remains available at its established path", async ({ page }) => {
  await installSupabase(page, { admin: true });
  await page.goto("/JAK2V617F/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(
    page.getByText("Active learners", { exact: true })
  ).toBeVisible();
});

test("learner home has no mobile horizontal overflow", async ({ page }) => {
  await installSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home/");
  const widths = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
    window.innerWidth,
  ]);
  expect(widths[0]).toBeLessThanOrEqual(widths[2] + 1);
  expect(widths[1]).toBeLessThanOrEqual(widths[2] + 1);
});
