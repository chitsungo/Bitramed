import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import type {
  AnswerFeedback,
  AssessmentSubmission,
  AttemptKind,
  AttemptReview,
  AttemptReviewItem,
  HistoryFilters,
  HistoryPage,
  HomeBootstrap,
  LearnerPreferences,
  LearningSearchResult,
  QuizSession,
} from "@/types/learner";
import {
  normalizeAccess,
  normalizePreferences,
} from "@/lib/learner-normalizers";
export {
  defaultPreferences,
  normalizeAccess,
  normalizePreferences,
} from "@/lib/learner-normalizers";

export type UnknownRow = Record<string, unknown>;
const rowSchema = z.record(z.string(), z.unknown());
const nullableTextSchema = z.string().nullable();
const accessDtoSchema = z.object({
  status: z.enum([
    "active",
    "owner",
    "expired",
    "blocked",
    "no_access",
    "signed_out",
  ]),
  hasAccess: z.boolean(),
  accessStartsAt: nullableTextSchema.optional(),
  accessExpiresAt: nullableTextSchema.optional(),
  blockReason: nullableTextSchema.optional(),
});
const preferencesDtoSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  textSize: z.enum(["normal", "large"]),
  reducedMotion: z.boolean(),
  defaultMode: z.enum(["study", "exam"]),
  defaultDurationMinutes: z.number().int().nullable(),
  defaultNegativeMarking: z.boolean(),
});
const attemptDtoSchema = z.object({
  kind: z.enum(["quiz", "past_paper"]),
  attemptId: z.string(),
  quizId: nullableTextSchema,
  setId: nullableTextSchema,
  level: z.string(),
  area: z.string(),
  sub: z.string(),
  title: z.string(),
  mode: z.enum(["study", "exam"]),
  score: z.number(),
  total: z.number().int(),
  correct: z.number().int(),
  wrong: z.number().int(),
  unanswered: z.number().int(),
  percentage: z.number(),
  completedAt: z.string(),
});
const shellDtoSchema = z.object({
  schemaVersion: z.literal(2),
  access: accessDtoSchema,
  preferences: preferencesDtoSchema,
});
const homeDtoSchema = shellDtoSchema.extend({
  dashboard: z.object({
    attemptCount: z.number().int(),
    activeYears: z.number().int(),
    completedCount: z.number().int(),
    averageScore: z.number(),
    levels: z.array(
      z.object({
        levelId: z.string(),
        name: z.string(),
        displayOrder: z.number().int(),
        courseCount: z.number().int(),
        doneCount: z.number().int(),
        totalCount: z.number().int(),
        percent: z.number(),
      })
    ),
    pastPaperYears: z.array(
      z.object({
        year: z.string(),
        examCount: z.number().int(),
        totalMarks: z.number().int(),
        bestPercentage: z.number(),
      })
    ),
  }),
  drafts: z.array(
    z.object({
      kind: z.enum(["quiz", "past_paper"]),
      assessmentId: z.string(),
      progressKey: z.string(),
      mode: z.enum(["study", "exam"]),
      durationMinutes: z.number().int().nullable(),
      negativeMarking: z.boolean(),
      context: rowSchema,
      answeredCount: z.number().int(),
      currentIndex: z.number().int(),
      timerExpiresAt: nullableTextSchema,
      updatedAt: z.string(),
    })
  ),
  recentAttempts: z.array(attemptDtoSchema),
  bestAttempt: rowSchema.nullable().optional(),
});
const quizSessionDtoSchema = z.object({
  schemaVersion: z.literal(2),
  descriptor: z.object({
    quiz_id: z.string(),
    quiz_title: z.string(),
    question_type: z.enum(["tf", "sba"]),
    level: z.string(),
    area: z.string(),
    sub: z.string(),
  }),
  questions: z.array(
    z.object({
      id: z.string(),
      position: z.number().int(),
      questionText: z.string(),
      optionA: nullableTextSchema.optional(),
      optionB: nullableTextSchema.optional(),
      optionC: nullableTextSchema.optional(),
      optionD: nullableTextSchema.optional(),
      optionE: nullableTextSchema.optional(),
      imageUrl: nullableTextSchema.optional(),
    })
  ),
  progress: rowSchema.nullable(),
});
const feedbackDtoSchema = z.object({
  questionId: z.string(),
  isCorrect: z.boolean(),
  correctAnswer: z.string(),
  explanation: z.string(),
});
const submissionDtoSchema = z.object({
  attemptId: z.union([z.string(), z.number()]).transform(String),
  submissionId: z.string(),
  mode: z.enum(["study", "exam"]),
  score: z.number(),
  totalQuestions: z.number().int(),
  correct: z.number().int(),
  wrong: z.number().int(),
  unanswered: z.number().int(),
  percentage: z.number(),
  durationMinutes: z.number().int().nullable(),
  negativeMarking: z.boolean(),
  timedOut: z.boolean(),
});
const historyDtoSchema = z.object({
  schemaVersion: z.literal(2),
  summary: z.object({
    attempts: z.number().int(),
    averagePercentage: z.number(),
    bestPercentage: z.number(),
  }),
  items: z.array(attemptDtoSchema),
  nextCursor: z.object({ completedAt: z.string(), key: z.string() }).nullable(),
});
const searchDtoSchema = z.object({
  schemaVersion: z.literal(2),
  query: z.string(),
  results: z.array(
    z.object({
      kind: z.enum(["quiz", "past_paper"]),
      id: z.string(),
      level: z.string(),
      area: z.string(),
      sub: z.string(),
      title: z.string(),
      type: z.string(),
      itemCount: z.number().int(),
    })
  ),
});
const reviewAttemptDtoSchema = z.object({
  attemptId: z.union([z.string(), z.number()]).transform(String),
  quizId: nullableTextSchema.optional(),
  setId: nullableTextSchema.optional(),
  title: z.string(),
  level: z.string(),
  area: z.string(),
  sub: z.string(),
  mode: z.enum(["study", "exam"]),
  score: z.number(),
  totalQuestions: z.number().int(),
  correct: z.number().int(),
  wrong: z.number().int(),
  unanswered: z.number().int(),
  percentage: z.number(),
  durationMinutes: z.number().int().nullable(),
  negativeMarking: z.boolean(),
  timedOut: z.boolean(),
  completedAt: z.string(),
});
const quizReviewDtoSchema = z.object({
  schemaVersion: z.literal(2),
  detailAvailable: z.boolean(),
  attempt: reviewAttemptDtoSchema,
  items: z.array(
    z.object({
      questionId: z.string(),
      position: z.number().int(),
      questionText: z.string(),
      imageUrl: nullableTextSchema.optional(),
      userAnswer: nullableTextSchema,
      correctAnswer: z.string(),
      explanation: z.string(),
      isCorrect: z.boolean(),
      points: z.number(),
    })
  ),
});
const pastPaperReviewDtoSchema = z.object({
  schemaVersion: z.literal(2),
  detailAvailable: z.boolean(),
  attempt: reviewAttemptDtoSchema,
  units: z.array(
    z.object({
      unitId: z.string(),
      stem: z.string(),
      imageUrl: nullableTextSchema.optional(),
      branches: z.array(
        z.object({
          branchId: z.string(),
          order: z.number().int(),
          prompt: z.string(),
          imageUrl: nullableTextSchema.optional(),
          userAnswer: z.boolean().nullable(),
          correctAnswer: z.boolean(),
          explanation: z.string().nullable(),
          isCorrect: z.boolean(),
          points: z.number(),
        })
      ),
    })
  ),
});

export function asRecord(value: unknown): UnknownRow {
  const parsed = rowSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function asRows(value: unknown): UnknownRow[] {
  return (Array.isArray(value) ? value : []).map(asRecord);
}

export function text(row: UnknownRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

export function number(row: UnknownRow, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) {
      const value = Number(row[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return 0;
}

export class LearnerApiError extends Error {
  constructor(
    message: string,
    readonly code = "UNEXPECTED",
    readonly category:
      | "authentication"
      | "access"
      | "validation"
      | "connectivity"
      | "missing"
      | "unexpected" = "unexpected"
  ) {
    super(message);
    this.name = "LearnerApiError";
  }
}

function parseContract<T extends z.ZodType>(
  schema: T,
  value: unknown,
  contract: string
): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new LearnerApiError(
      `${contract} returned an invalid response.`,
      "INVALID_RESPONSE",
      "validation"
    );
  }
  return parsed.data;
}

function categorizeError(code: string, message: string) {
  if (code === "28000" || /auth|sign in/i.test(message))
    return "authentication";
  if (/access|expired|blocked/i.test(message)) return "access";
  if (code === "22023") return "validation";
  if (code === "P0002") return "missing";
  if (/fetch|network|offline/i.test(message)) return "connectivity";
  return "unexpected";
}

type RpcResponse = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

type AbortableRpcRequest = PromiseLike<RpcResponse> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<RpcResponse>;
};

export async function rpc(
  name: string,
  args: UnknownRow = {},
  signal?: AbortSignal
) {
  const supabase = getSupabase();
  const call = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    parameters?: UnknownRow
  ) => AbortableRpcRequest;
  const request = call(name, args);
  const response =
    signal && request.abortSignal ? request.abortSignal(signal) : request;
  const { data, error } = await response;
  if (error) {
    const code = String(error.code || "UNEXPECTED");
    throw new LearnerApiError(
      error.message,
      code,
      categorizeError(code, error.message)
    );
  }
  return data;
}

export async function fetchShellBootstrap() {
  const payload = parseContract(
    shellDtoSchema,
    await rpc("app_shell_bootstrap_v2"),
    "Shell bootstrap"
  );
  return {
    access: normalizeAccess(payload.access),
    preferences: normalizePreferences(payload.preferences),
  };
}

export async function fetchHomeBootstrap(): Promise<HomeBootstrap> {
  const payload = parseContract(
    homeDtoSchema,
    await rpc("app_home_bootstrap_v2"),
    "Home bootstrap"
  );
  const dashboard = payload.dashboard;
  const best = asRecord(payload.bestAttempt);
  return {
    access: normalizeAccess(payload.access),
    preferences: normalizePreferences(payload.preferences),
    dashboard: {
      attemptCount: dashboard.attemptCount,
      activeYears: dashboard.activeYears,
      completedCount: dashboard.completedCount,
      averageScore: dashboard.averageScore,
      bestScore: number(best, "percentage"),
      levels: dashboard.levels
        .map((row) => ({
          id: row.levelId,
          name: row.name,
          displayOrder: row.displayOrder,
          courseCount: row.courseCount,
          doneCount: row.doneCount,
          totalCount: row.totalCount,
          percent: row.percent,
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      pastPaperYears: dashboard.pastPaperYears.filter((item) => item.year),
    },
    drafts: payload.drafts,
    recentAttempts: payload.recentAttempts,
  };
}

export async function fetchBrowsePage(
  kind: "year" | "courses" | "subtopics" | "types" | "quizzes",
  params: UnknownRow
) {
  const functions = {
    year: "app_year_overview",
    courses: "app_browse_courses",
    subtopics: "app_browse_subtopics",
    types: "app_browse_types",
    quizzes: "app_browse_quizzes",
  } as const;
  return asRecord(await rpc(functions[kind], params));
}

export async function fetchQuizSession(
  quizId: string,
  progressKey: string
): Promise<QuizSession> {
  const payload = parseContract(
    quizSessionDtoSchema,
    await rpc("app_quiz_session_v2", {
      p_quiz_id: quizId,
      p_progress_key: progressKey,
    }),
    "Quiz session"
  );
  const descriptor = payload.descriptor;
  const type = descriptor.question_type;
  return {
    descriptor: {
      quizId: descriptor.quiz_id || quizId,
      title: descriptor.quiz_title,
      type,
      level: descriptor.level,
      area: descriptor.area,
      sub: descriptor.sub,
    },
    questions: payload.questions
      .map((row, index) => {
        const optionLabels = {
          A: row.optionA,
          B: row.optionB,
          C: row.optionC,
          D: row.optionD,
          E: row.optionE,
        };
        const options =
          type === "tf"
            ? [
                { value: "TRUE", label: "True" },
                { value: "FALSE", label: "False" },
              ]
            : ["A", "B", "C", "D", "E"]
                .map((value) => ({
                  value,
                  label: optionLabels[value as keyof typeof optionLabels] || "",
                }))
                .filter((option) => option.label);
        return {
          id: row.id,
          position: row.position || index + 1,
          questionText: row.questionText,
          imageUrl: row.imageUrl || "",
          options,
        };
      })
      .filter((question) => question.id && question.questionText),
    progress: payload.progress,
  };
}

export async function checkQuizAnswer(
  quizId: string,
  questionId: string,
  answer: string
): Promise<AnswerFeedback> {
  const row = parseContract(
    feedbackDtoSchema,
    await rpc("app_check_quiz_answer", {
      p_quiz_id: quizId,
      p_question_id: questionId,
      p_answer: answer,
    }),
    "Study feedback"
  );
  return {
    questionId: row.questionId || questionId,
    isCorrect: row.isCorrect,
    correctAnswer: row.correctAnswer,
    explanation: row.explanation,
  };
}

function normalizeSubmission(
  value: unknown,
  assessmentId: string
): AssessmentSubmission {
  const row = parseContract(
    submissionDtoSchema,
    value,
    "Assessment submission"
  );
  return {
    attemptId: row.attemptId,
    assessmentId,
    submissionId: row.submissionId,
    mode: row.mode,
    score: row.score,
    total: row.totalQuestions,
    correct: row.correct,
    wrong: row.wrong,
    unanswered: row.unanswered,
    percentage: row.percentage,
    durationMinutes: row.durationMinutes,
    negativeMarking: row.negativeMarking,
    timedOut: row.timedOut,
  };
}

export async function submitQuiz(
  quizId: string,
  submissionId: string,
  answers: Record<string, string>,
  settings: {
    mode: "study" | "exam";
    durationMinutes: number | null;
    negativeMarking: boolean;
    timedOut: boolean;
  }
) {
  return normalizeSubmission(
    await rpc("app_submit_quiz_attempt", {
      p_quiz_id: quizId,
      p_submission_id: submissionId,
      p_answers: answers,
      p_mode: settings.mode,
      p_duration_minutes: settings.durationMinutes,
      p_negative_marking: settings.negativeMarking,
      p_timed_out: settings.timedOut,
    }),
    quizId
  );
}

export async function fetchAccountPage() {
  return asRecord(await rpc("app_account_page", { p_limit: 5 }));
}

export async function fetchSearch(
  query: string,
  signal?: AbortSignal
): Promise<LearningSearchResult[]> {
  const payload = parseContract(
    searchDtoSchema,
    await rpc(
      "app_learning_search",
      {
        p_query: query.trim().toLowerCase(),
        p_limit: query.trim() ? 20 : 12,
      },
      signal
    ),
    "Learning search"
  );
  return payload.results;
}

export async function fetchHistory(
  filters: HistoryFilters,
  cursor?: { completedAt: string; key: string } | null
): Promise<HistoryPage> {
  const payload = parseContract(
    historyDtoSchema,
    await rpc("app_attempt_history", {
      p_limit: 20,
      p_cursor_completed_at: cursor?.completedAt || null,
      p_cursor_key: cursor?.key || null,
      p_kind: filters.kind || null,
      p_mode: filters.mode || null,
      p_level: filters.level || null,
      p_area: filters.area || null,
      p_from: filters.from || null,
      p_to: filters.to || null,
    }),
    "Attempt history"
  );
  return {
    summary: payload.summary,
    items: payload.items,
    nextCursor: payload.nextCursor,
  };
}

export async function fetchAttemptReview(
  kind: AttemptKind,
  attemptId: string
): Promise<AttemptReview> {
  const raw = await rpc(
    kind === "past_paper"
      ? "app_past_paper_attempt_review_v2"
      : "app_quiz_attempt_review",
    { p_attempt_id: attemptId }
  );
  let attempt: z.infer<typeof reviewAttemptDtoSchema>;
  let detailAvailable: boolean;
  let items: AttemptReviewItem[];
  if (kind === "past_paper") {
    const payload = parseContract(
      pastPaperReviewDtoSchema,
      raw,
      "Past-paper review"
    );
    attempt = payload.attempt;
    detailAvailable = payload.detailAvailable;
    items = payload.units.flatMap((unit) =>
      unit.branches.map((branch) => ({
        id: branch.branchId,
        position: branch.order,
        questionText: branch.prompt,
        imageUrl: branch.imageUrl || "",
        userAnswer: branch.userAnswer === null ? "" : String(branch.userAnswer),
        correctAnswer: String(branch.correctAnswer),
        explanation: branch.explanation || "",
        isCorrect: branch.isCorrect,
        points: branch.points,
      }))
    );
  } else {
    const payload = parseContract(quizReviewDtoSchema, raw, "Quiz review");
    attempt = payload.attempt;
    detailAvailable = payload.detailAvailable;
    items = payload.items.map((item) => ({
      id: item.questionId,
      position: item.position,
      questionText: item.questionText,
      imageUrl: item.imageUrl || "",
      userAnswer: item.userAnswer || "",
      correctAnswer: item.correctAnswer,
      explanation: item.explanation,
      isCorrect: item.isCorrect,
      points: item.points,
    }));
  }
  return {
    detailAvailable,
    attempt: {
      kind,
      attemptId: attempt.attemptId,
      quizId: attempt.quizId || null,
      setId: attempt.setId || null,
      title: attempt.title,
      level: attempt.level,
      area: attempt.area,
      sub: attempt.sub,
      mode: attempt.mode,
      score: attempt.score,
      total: attempt.totalQuestions,
      correct: attempt.correct,
      wrong: attempt.wrong,
      unanswered: attempt.unanswered,
      percentage: attempt.percentage,
      completedAt: attempt.completedAt,
      durationMinutes: attempt.durationMinutes,
      negativeMarking: attempt.negativeMarking,
      timedOut: attempt.timedOut,
    },
    items,
  };
}

export async function fetchPastPaperYears() {
  return asRows(await rpc("app_past_paper_years"));
}

export async function fetchPastPaperTopics(year: string) {
  return asRows(
    await rpc("app_past_paper_topics", {
      p_year_label: year,
      p_paper_group_label: "Past Papers",
    })
  );
}

export async function fetchPastPaperExams(year: string, topic: string) {
  return asRows(
    await rpc("app_past_paper_exams", {
      p_year_label: year,
      p_topic_label: topic,
      p_paper_group_label: "Past Papers",
    })
  );
}

export async function fetchPastPaperSession(
  setId: string,
  progressKey: string
) {
  return asRecord(
    await rpc("app_past_paper_session", {
      p_set_id: setId,
      p_progress_key: progressKey,
    })
  );
}

export async function submitPastPaper(
  setId: string,
  submissionId: string,
  answers: Record<string, string>,
  settings: {
    durationMinutes: number | null;
    negativeMarking: boolean;
    timedOut: boolean;
  }
) {
  return normalizeSubmission(
    await rpc("app_submit_past_paper_attempt_v2", {
      p_set_id: setId,
      p_submission_id: submissionId,
      p_answers: answers,
      p_duration_minutes: settings.durationMinutes,
      p_negative_marking: settings.negativeMarking,
      p_timed_out: settings.timedOut,
    }),
    setId
  );
}

export async function savePreferences(
  userId: string,
  preferences: LearnerPreferences
) {
  const { error } = await getSupabase().from("user_preferences").upsert(
    {
      user_id: userId,
      theme: preferences.theme,
      text_size: preferences.textSize,
      reduced_motion: preferences.reducedMotion,
      default_mode: preferences.defaultMode,
      default_duration_minutes: preferences.defaultDurationMinutes,
      default_negative_marking: preferences.defaultNegativeMarking,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new LearnerApiError(error.message, error.code);
}

export async function clearDrafts() {
  await rpc("app_clear_assessment_drafts");
}
