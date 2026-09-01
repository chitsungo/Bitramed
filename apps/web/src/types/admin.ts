export type AccessStatus = "active" | "expired" | "no_access" | "blocked";

export interface OverviewStats {
  total_users: number;
  active_users: number;
  total_attempts: number;
  total_quizzes_done: number;
  average_percentage: number;
}

export interface UserSummary {
  user_id: string;
  display_name: string | null;
  email: string | null;
  total_attempts: number;
  quizzes_done: number;
  average_percentage: number;
  best_percentage: number;
  strongest_area: string | null;
  weakest_area: string | null;
  latest_activity: string | null;
}

export interface CourseSummary {
  area: string;
  total_attempts: number;
  unique_users: number;
  average_percentage: number;
  best_user_average: number;
}

export interface QuizAttempt {
  user_id: string;
  quiz_title: string;
  display_name: string | null;
  email: string | null;
  area: string;
  mode: string;
  percentage: number;
  score: number;
  total_questions: number;
  completed_at: string;
  assessment_kind?: "quiz";
}

export interface PastPaperAttempt {
  attempt_id: number | string;
  user_id: string;
  set_id: string;
  quiz_title: string;
  area: string;
  level: string;
  mode: "exam";
  assessment_kind: "past_paper";
  score: number;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  percentage: number;
  duration_minutes: number | null;
  negative_marking: boolean;
  timed_out: boolean;
  completed_at: string;
}

export interface AccessRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  access_starts_at: string | null;
  access_expires_at: string | null;
  blocked_at: string | null;
  block_reason: string | null;
  notes: string | null;
  status: AccessStatus;
  granted_by: string | null;
  updated_at: string | null;
}

export interface LearnerMetric extends AccessRow {
  normal_attempts: number;
  past_paper_attempts: number;
  combined_attempts: number;
  combined_assessments: number;
  combined_average: number;
  best_percentage: number;
  latest_activity: string | null;
  strongest_area: string | null;
  weakest_area: string | null;
}

export interface ActivityItem {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  title: string;
  area: string;
  kind: "Quiz" | "Past paper";
  mode: string;
  percentage: number;
  score: number;
  total_questions: number;
  completed_at: string;
}

export interface AdminData {
  overview: OverviewStats;
  users: UserSummary[];
  courses: CourseSummary[];
  quizAttempts: QuizAttempt[];
  paperAttempts: PastPaperAttempt[];
  access: AccessRow[];
}
