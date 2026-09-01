import { getSupabase } from "@/lib/supabase";
import {
  normalizeAccess,
  normalizePreferences,
} from "@/lib/learner-normalizers";
import type {
  AnswerFeedback,
  AssessmentSubmission,
  AttemptKind,
  AttemptReview,
  AttemptSummary,
  HistoryFilters,
  HistoryPage,
  HomeBootstrap,
  LearnerPreferences,
  LearningSearchResult,
  QuizSession,
} from "@/types/learner";

type Row = Record<string, unknown>;
type Rpc = (name: string, args?: Row, signal?: AbortSignal) => Promise<unknown>;

type LegacyQuestion = {
  id: string;
  position: number;
  questionText: string;
  imageUrl: string;
  expectedAnswer: string;
  explanation: string;
  options: Array<{ value: string; label: string }>;
};

const legacyQuestions = new Map<string, Map<string, LegacyQuestion>>();
const legacyDescriptors = new Map<string, QuizSession["descriptor"]>();

function row(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function rows(value: unknown): Row[] {
  return (Array.isArray(value) ? value : []).map(row);
}

function text(source: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function number(source: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function bool(source: Row, ...keys: string[]) {
  for (const key of keys) {
    if (source[key] !== null && source[key] !== undefined) {
      return source[key] === true;
    }
  }
  return false;
}

function normalizeAnswer(value: unknown, type: "sba" | "tf") {
  const answer = String(value || "")
    .trim()
    .toUpperCase();
  if (type === "tf") {
    if (["TRUE", "T", "1", "YES"].includes(answer)) return "TRUE";
    if (["FALSE", "F", "0", "NO"].includes(answer)) return "FALSE";
    return "";
  }
  return answer;
}

function normalizeAttempt(value: unknown): AttemptSummary {
  const source = row(value);
  const kind = text(source, "kind", "assessmentKind", "assessment_kind");
  return {
    kind: kind === "past_paper" ? "past_paper" : "quiz",
    attemptId: text(source, "attemptId", "attempt_id", "id").replace(
      /^past_paper:/,
      ""
    ),
    quizId: text(source, "quizId", "quiz_id") || null,
    setId: text(source, "setId", "set_id") || null,
    level: text(source, "level", "yearLabel", "year_label"),
    area: text(source, "area", "topicLabel", "topic_label"),
    sub:
      text(source, "sub") || (kind === "past_paper" ? "Past Paper Exam" : ""),
    title: text(source, "title", "quizTitle", "quiz_title") || "Assessment",
    mode: text(source, "mode") === "study" ? "study" : "exam",
    score: number(source, "score"),
    total: number(source, "total", "totalQuestions", "total_questions"),
    correct: number(source, "correct", "correctCount", "correct_count"),
    wrong: number(source, "wrong", "wrongCount", "wrong_count"),
    unanswered: number(
      source,
      "unanswered",
      "unansweredCount",
      "unanswered_count"
    ),
    percentage: number(source, "percentage"),
    completedAt: text(source, "completedAt", "completed_at"),
  };
}

function reviewStorageKey(attemptId: string) {
  return `bitramed:legacy-review:${attemptId}`;
}

export function isMissingRpcError(error: unknown) {
  const source = error as { code?: unknown; message?: unknown };
  const code = String(source?.code || "");
  const message = String(source?.message || "");
  return (
    code === "PGRST202" ||
    code === "42883" ||
    /could not find the function|does not exist.*function|schema cache/i.test(
      message
    )
  );
}

export async function fetchLegacyShell(rpc: Rpc) {
  const payload = row(await rpc("app_shell_bootstrap"));
  return {
    access: normalizeAccess(payload.access),
    preferences: normalizePreferences({ theme: payload.themePreference }),
  };
}

export async function fetchLegacyHome(rpc: Rpc): Promise<HomeBootstrap> {
  const [homeValue, accountValue] = await Promise.all([
    rpc("app_home_bootstrap"),
    rpc("app_account_page", { p_limit: 50 }),
  ]);
  const payload = row(homeValue);
  const dashboard = row(payload.dashboard);
  const account = row(accountValue);
  const best = row(account.bestAttempt);
  return {
    access: normalizeAccess(payload.access),
    preferences: normalizePreferences({ theme: payload.themePreference }),
    dashboard: {
      attemptCount: number(account, "attemptsCount", "attempts_count"),
      activeYears: number(dashboard, "activeYears", "active_years"),
      completedCount: number(dashboard, "completedCount", "completed_count"),
      averageScore: number(dashboard, "averageScore", "average_score"),
      bestScore: number(best, "percentage"),
      levels: rows(dashboard.levels)
        .map((item) => ({
          id: text(item, "levelId", "level_id"),
          name: text(item, "name", "level"),
          displayOrder: number(item, "displayOrder", "display_order"),
          courseCount: number(item, "courseCount", "course_count"),
          doneCount: number(item, "doneCount", "done_count"),
          totalCount: number(item, "totalCount", "total_count"),
          percent: number(item, "percent"),
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      pastPaperYears: rows(
        dashboard.pastPaperYears ?? dashboard.past_paper_years
      ).map((item) => ({
        year: text(item, "year", "year_label"),
        examCount: number(item, "examCount", "exam_count"),
        totalMarks: number(item, "totalMarks", "total_marks"),
        bestPercentage: number(item, "bestPercentage", "best_percentage"),
      })),
    },
    drafts: [],
    recentAttempts: rows(account.recentAttempts).map(normalizeAttempt),
  };
}

export async function fetchLegacyQuizSession(
  rpc: Rpc,
  quizId: string,
  progressKey: string
): Promise<QuizSession> {
  const payload = row(
    await rpc("app_quiz_session", {
      p_quiz_id: quizId,
      p_progress_key: progressKey,
    })
  );
  const descriptor = row(payload.descriptor);
  const type =
    text(descriptor, "question_type", "questionType") === "tf" ? "tf" : "sba";
  const answerMap = new Map<string, LegacyQuestion>();
  const questions = rows(payload.questions)
    .map((item, index) => {
      const id = text(item, "id", "question_id");
      const options =
        type === "tf"
          ? [
              { value: "TRUE", label: "True" },
              { value: "FALSE", label: "False" },
            ]
          : ["A", "B", "C", "D", "E"]
              .map((value) => ({
                value,
                label: text(
                  item,
                  `option_${value.toLowerCase()}`,
                  `option${value}`
                ),
              }))
              .filter((option) => option.label);
      const question: LegacyQuestion = {
        id,
        position: index + 1,
        questionText: text(item, "question_text", "questionText"),
        imageUrl: text(item, "image_url", "imageUrl"),
        expectedAnswer: normalizeAnswer(
          text(item, "correct_answer", "correctAnswer"),
          type
        ),
        explanation: text(item, "explanation"),
        options,
      };
      if (id) answerMap.set(id, question);
      return {
        id: question.id,
        position: question.position,
        questionText: question.questionText,
        imageUrl: question.imageUrl,
        options: question.options,
      };
    })
    .filter((question) => question.id && question.questionText);
  legacyQuestions.set(quizId, answerMap);
  const normalizedDescriptor: QuizSession["descriptor"] = {
    quizId: text(descriptor, "quiz_id") || quizId,
    title: text(descriptor, "quiz_title", "title") || "Assessment",
    type,
    level: text(descriptor, "level"),
    area: text(descriptor, "area"),
    sub: text(descriptor, "sub"),
  };
  legacyDescriptors.set(quizId, normalizedDescriptor);
  return {
    descriptor: normalizedDescriptor,
    questions,
    progress: Object.keys(row(payload.progress)).length
      ? row(payload.progress)
      : null,
  };
}

export function checkLegacyQuizAnswer(
  quizId: string,
  questionId: string,
  answer: string
): AnswerFeedback {
  const question = legacyQuestions.get(quizId)?.get(questionId);
  if (!question) throw new Error("Reload this assessment to check the answer.");
  const type = question.options[0]?.value === "TRUE" ? "tf" : "sba";
  const normalized = normalizeAnswer(answer, type);
  return {
    questionId,
    isCorrect: Boolean(normalized) && normalized === question.expectedAnswer,
    correctAnswer: question.expectedAnswer,
    explanation: question.explanation,
  };
}

export async function submitLegacyQuiz(
  quizId: string,
  submissionId: string,
  answers: Record<string, string>,
  settings: {
    mode: "study" | "exam";
    durationMinutes: number | null;
    negativeMarking: boolean;
    timedOut: boolean;
  }
): Promise<AssessmentSubmission> {
  const questions = [...(legacyQuestions.get(quizId)?.values() || [])];
  if (!questions.length)
    throw new Error("Reload this assessment before submitting.");
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  const reviewItems = questions.map((question) => {
    const type = question.options[0]?.value === "TRUE" ? "tf" : "sba";
    const userAnswer = normalizeAnswer(answers[question.id], type);
    const isCorrect =
      Boolean(userAnswer) && userAnswer === question.expectedAnswer;
    const points = !userAnswer
      ? 0
      : isCorrect
        ? 1
        : settings.negativeMarking
          ? -1
          : 0;
    if (!userAnswer) unanswered += 1;
    else if (isCorrect) correct += 1;
    else wrong += 1;
    score += points;
    return {
      id: question.id,
      position: question.position,
      questionText: question.questionText,
      imageUrl: question.imageUrl,
      userAnswer,
      correctAnswer: question.expectedAnswer,
      explanation: question.explanation,
      isCorrect,
      points,
    };
  });
  const total = questions.length;
  const percentage = total ? Math.round((Math.max(score, 0) / total) * 100) : 0;
  const { data: userData, error: userError } =
    await getSupabase().auth.getUser();
  const userId = userData.user?.id;
  if (userError || !userId) throw userError || new Error("Sign in to submit.");
  const { data, error } = await getSupabase()
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      quiz_id: quizId,
      mode: settings.mode,
      score,
      total_questions: total,
      correct_count: correct,
      wrong_count: wrong,
      unanswered_count: unanswered,
      percentage,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  const attemptId = String(data?.id || "");
  if (!attemptId)
    throw new Error("The server did not return an attempt reference.");
  const submission: AssessmentSubmission = {
    attemptId,
    assessmentId: quizId,
    submissionId,
    mode: settings.mode,
    score,
    total,
    correct,
    wrong,
    unanswered,
    percentage,
    durationMinutes: settings.durationMinutes,
    negativeMarking: settings.negativeMarking,
    timedOut: settings.timedOut,
  };
  const descriptor = legacyDescriptors.get(quizId);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(
      reviewStorageKey(attemptId),
      JSON.stringify({
        detailAvailable: true,
        attempt: {
          kind: "quiz",
          attemptId,
          quizId,
          setId: null,
          level: descriptor?.level || "",
          area: descriptor?.area || "",
          sub: descriptor?.sub || "",
          title: descriptor?.title || "Assessment",
          mode: settings.mode,
          score,
          total,
          correct,
          wrong,
          unanswered,
          percentage,
          completedAt: new Date().toISOString(),
          durationMinutes: settings.durationMinutes,
          negativeMarking: settings.negativeMarking,
          timedOut: settings.timedOut,
        },
        items: reviewItems,
      } satisfies AttemptReview)
    );
  }
  return submission;
}

export async function fetchLegacySearch(
  rpc: Rpc,
  query: string,
  signal?: AbortSignal
): Promise<LearningSearchResult[]> {
  const payload = row(
    await rpc(
      "app_quiz_search",
      {
        p_query: query.trim().toLowerCase(),
        p_limit: query.trim() ? 20 : 12,
      },
      signal
    )
  );
  return rows(payload.results)
    .map((item) => ({
      kind: "quiz" as const,
      id: text(item, "quizId", "quiz_id", "id"),
      level: text(item, "level"),
      area: text(item, "area"),
      sub: text(item, "sub"),
      title: text(item, "title", "quizTitle", "quiz_title"),
      type: text(item, "type", "questionType", "question_type"),
      itemCount: number(item, "itemCount", "count", "question_count"),
    }))
    .filter((item) => item.id && item.title);
}

function matchesHistory(attempt: AttemptSummary, filters: HistoryFilters) {
  if (filters.kind && attempt.kind !== filters.kind) return false;
  if (filters.mode && attempt.mode !== filters.mode) return false;
  if (
    filters.level &&
    attempt.level.toLowerCase() !== filters.level.toLowerCase()
  )
    return false;
  if (filters.area && attempt.area.toLowerCase() !== filters.area.toLowerCase())
    return false;
  const completed = Date.parse(attempt.completedAt);
  if (filters.from && completed < Date.parse(filters.from)) return false;
  if (filters.to && completed > Date.parse(filters.to)) return false;
  return true;
}

export async function fetchLegacyHistory(
  rpc: Rpc,
  filters: HistoryFilters
): Promise<HistoryPage> {
  const payload = row(await rpc("app_account_page", { p_limit: 50 }));
  const items = rows(payload.recentAttempts)
    .map(normalizeAttempt)
    .filter((attempt) => matchesHistory(attempt, filters));
  const percentages = items.map((attempt) => attempt.percentage);
  return {
    summary: {
      attempts: items.length,
      averagePercentage: percentages.length
        ? Math.round(
            percentages.reduce((sum, value) => sum + value, 0) /
              percentages.length
          )
        : 0,
      bestPercentage: percentages.length ? Math.max(...percentages) : 0,
    },
    items,
    nextCursor: null,
  };
}

function summaryReview(attempt: AttemptSummary): AttemptReview {
  return {
    detailAvailable: false,
    attempt: {
      ...attempt,
      durationMinutes: null,
      negativeMarking: false,
      timedOut: false,
    },
    items: [],
  };
}

export async function fetchLegacyReview(
  rpc: Rpc,
  kind: AttemptKind,
  attemptId: string
): Promise<AttemptReview> {
  if (kind === "quiz") {
    if (typeof sessionStorage !== "undefined") {
      const stored = sessionStorage.getItem(reviewStorageKey(attemptId));
      if (stored) return JSON.parse(stored) as AttemptReview;
    }
    const history = await fetchLegacyHistory(rpc, {});
    const attempt = history.items.find(
      (item) => item.kind === "quiz" && item.attemptId === attemptId
    );
    if (!attempt) throw new Error("Attempt was not found.");
    return summaryReview(attempt);
  }
  const payload = row(
    await rpc("app_past_paper_attempt_review", { p_attempt_id: attemptId })
  );
  const attemptRow = row(payload.attempt);
  const attempt = normalizeAttempt({
    ...attemptRow,
    kind: "past_paper",
    total: number(attemptRow, "totalMarks", "total_marks"),
    level: text(attemptRow, "yearLabel", "year_label"),
    area: text(attemptRow, "topicLabel", "topic_label"),
    sub: "Past Paper Exam",
    mode: "exam",
  });
  return {
    detailAvailable: rows(payload.units).length > 0,
    attempt: {
      ...attempt,
      durationMinutes:
        attemptRow.durationMinutes === null
          ? null
          : number(attemptRow, "durationMinutes", "duration_minutes") || null,
      negativeMarking: bool(attemptRow, "negativeMarking", "negative_marking"),
      timedOut: bool(attemptRow, "timedOut", "timed_out"),
    },
    items: rows(payload.units).flatMap((unit) =>
      rows(unit.branches).map((branch, index) => ({
        id: text(branch, "branchId", "branch_id") || String(index + 1),
        position: number(branch, "order") || index + 1,
        questionText: text(branch, "prompt"),
        imageUrl: text(branch, "imageUrl", "image_url"),
        userAnswer:
          branch.userAnswer === null || branch.user_answer === null
            ? ""
            : String(branch.userAnswer ?? branch.user_answer ?? ""),
        correctAnswer: String(
          branch.correctAnswer ?? branch.correct_answer ?? ""
        ),
        explanation: text(branch, "explanation"),
        isCorrect: bool(branch, "isCorrect", "is_correct"),
        points: number(branch, "points"),
      }))
    ),
  };
}

export async function submitLegacyPastPaper(
  rpc: Rpc,
  setId: string,
  submissionId: string,
  answers: Record<string, string>,
  settings: {
    durationMinutes: number | null;
    negativeMarking: boolean;
    timedOut: boolean;
  }
): Promise<AssessmentSubmission> {
  const payload = row(
    await rpc("app_submit_past_paper_attempt", {
      p_set_id: setId,
      p_answers: answers,
      p_duration_minutes: settings.durationMinutes,
      p_negative_marking: settings.negativeMarking,
      p_timed_out: settings.timedOut,
    })
  );
  return {
    attemptId: text(payload, "attemptId", "attempt_id"),
    assessmentId: setId,
    submissionId,
    mode: "exam",
    score: number(payload, "score"),
    total: number(payload, "totalQuestions", "totalMarks", "total_marks"),
    correct: number(payload, "correct"),
    wrong: number(payload, "wrong"),
    unanswered: number(payload, "unanswered"),
    percentage: number(payload, "percentage"),
    durationMinutes: settings.durationMinutes,
    negativeMarking: settings.negativeMarking,
    timedOut: settings.timedOut,
  };
}

export async function saveLegacyPreferences(
  userId: string,
  preferences: LearnerPreferences
) {
  const theme = preferences.theme === "system" ? "light" : preferences.theme;
  const { error } = await getSupabase()
    .from("user_preferences")
    .upsert({ user_id: userId, theme }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function clearLegacyDrafts(userId: string) {
  const { error } = await getSupabase()
    .from("user_assessment_progress")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
