export type AccessState =
  | "active"
  | "expiring"
  | "owner"
  | "expired"
  | "blocked"
  | "no_access"
  | "signed_out";

export type AccessStatus = {
  status: AccessState;
  hasAccess: boolean;
  accessStartsAt: string | null;
  accessExpiresAt: string | null;
  blockReason: string;
};

export type LearnerPreferences = {
  theme: "system" | "light" | "dark";
  textSize: "normal" | "large";
  reducedMotion: boolean;
  defaultMode: "study" | "exam";
  defaultDurationMinutes: number | null;
  defaultNegativeMarking: boolean;
};

export type LevelSummary = {
  id: string;
  name: string;
  displayOrder: number;
  courseCount: number;
  doneCount: number;
  totalCount: number;
  percent: number;
};

export type PastPaperYearSummary = {
  year: string;
  examCount: number;
  totalMarks: number;
  bestPercentage: number;
};

export type AttemptKind = "quiz" | "past_paper";

export type AttemptSummary = {
  kind: AttemptKind;
  attemptId: string;
  quizId: string | null;
  setId: string | null;
  level: string;
  area: string;
  sub: string;
  title: string;
  mode: "study" | "exam";
  score: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percentage: number;
  completedAt: string;
};

export type DraftSummary = {
  kind: AttemptKind;
  assessmentId: string;
  progressKey: string;
  mode: "study" | "exam";
  durationMinutes: number | null;
  negativeMarking: boolean;
  context: Record<string, unknown>;
  answeredCount: number;
  currentIndex: number;
  timerExpiresAt: string | null;
  updatedAt: string;
};

export type HomeBootstrap = {
  access: AccessStatus;
  preferences: LearnerPreferences;
  dashboard: {
    attemptCount: number;
    activeYears: number;
    completedCount: number;
    averageScore: number;
    bestScore: number;
    levels: LevelSummary[];
    pastPaperYears: PastPaperYearSummary[];
  };
  drafts: DraftSummary[];
  recentAttempts: AttemptSummary[];
};

export type QuizSessionQuestion = {
  id: string;
  position: number;
  questionText: string;
  imageUrl: string;
  options: Array<{ value: string; label: string }>;
};

export type QuizSession = {
  descriptor: {
    quizId: string;
    title: string;
    type: "sba" | "tf";
    level: string;
    area: string;
    sub: string;
  };
  questions: QuizSessionQuestion[];
  progress: Record<string, unknown> | null;
};

export type AnswerFeedback = {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
};

export type AssessmentSubmission = {
  attemptId: string;
  assessmentId: string;
  submissionId: string;
  mode: "study" | "exam";
  score: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percentage: number;
  durationMinutes: number | null;
  negativeMarking: boolean;
  timedOut: boolean;
};

export type AttemptReviewItem = {
  id: string;
  position: number;
  questionText: string;
  imageUrl: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
  points: number;
};

export type AttemptReview = {
  detailAvailable: boolean;
  attempt: AttemptSummary & {
    durationMinutes: number | null;
    negativeMarking: boolean;
    timedOut: boolean;
  };
  items: AttemptReviewItem[];
};

export type LearningSearchResult = {
  kind: AttemptKind;
  id: string;
  level: string;
  area: string;
  sub: string;
  title: string;
  type: string;
  itemCount: number;
};

export type HistoryFilters = {
  kind?: AttemptKind;
  mode?: "study" | "exam";
  level?: string;
  area?: string;
  from?: string;
  to?: string;
};

export type HistoryPage = {
  summary: {
    attempts: number;
    averagePercentage: number;
    bestPercentage: number;
  };
  items: AttemptSummary[];
  nextCursor: { completedAt: string; key: string } | null;
};
