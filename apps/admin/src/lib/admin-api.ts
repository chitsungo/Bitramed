import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import type {
  AccessRow,
  AdminData,
  CourseSummary,
  OverviewStats,
  PastPaperAttempt,
  QuizAttempt,
  UserSummary,
} from "@/types/admin";

const number = z.coerce.number().catch(0);
const nullableText = z.string().nullable().catch(null);
const overviewSchema = z.object({
  total_users: number,
  active_users: number,
  total_attempts: number,
  total_quizzes_done: number,
  average_percentage: number,
});
const userSchema = z.object({
  user_id: z.string(),
  display_name: nullableText,
  email: nullableText,
  total_attempts: number,
  quizzes_done: number,
  average_percentage: number,
  best_percentage: number,
  strongest_area: nullableText,
  weakest_area: nullableText,
  latest_activity: nullableText,
});
const courseSchema = z.object({
  area: z.string().catch("Uncategorised"),
  total_attempts: number,
  unique_users: number,
  average_percentage: number,
  best_user_average: number,
});
const accessSchema = z.object({
  user_id: z.string(),
  email: nullableText,
  display_name: nullableText,
  access_starts_at: nullableText,
  access_expires_at: nullableText,
  blocked_at: nullableText,
  block_reason: nullableText,
  notes: nullableText,
  status: z.enum(["active", "expired", "no_access", "blocked"]),
  granted_by: nullableText,
  updated_at: nullableText,
});
const quizSchema = z.object({
  user_id: z.string(),
  quiz_title: z.string().catch("Quiz"),
  display_name: nullableText,
  email: nullableText,
  area: z.string().catch("Uncategorised"),
  mode: z.string().catch("study"),
  percentage: number,
  score: number,
  total_questions: number,
  completed_at: z.string(),
});
const paperSchema = z.object({
  attempt_id: z.union([z.number(), z.string()]),
  user_id: z.string(),
  set_id: z.string(),
  quiz_title: z.string().catch("Past paper"),
  area: z.string().catch("Uncategorised"),
  level: z.string().catch(""),
  mode: z.literal("exam").catch("exam"),
  assessment_kind: z.literal("past_paper").catch("past_paper"),
  score: number,
  total_questions: number,
  correct_count: number,
  wrong_count: number,
  unanswered_count: number,
  percentage: number,
  duration_minutes: z.coerce.number().nullable().catch(null),
  negative_marking: z.boolean().catch(false),
  timed_out: z.boolean().catch(false),
  completed_at: z.string(),
});

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const supabase = getSupabase();
  const call = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    parameters?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await call(name, args);
  if (error) throw new Error(error.message);
  return data;
}

function list<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const result = z
    .array(schema)
    .safeParse(Array.isArray(value) ? value : value ? [value] : []);
  if (!result.success)
    throw new Error("The admin service returned an unexpected response.");
  return result.data;
}

export async function isAdmin() {
  const value = await rpc("is_current_user_admin");
  return value === true;
}

export async function fetchAdminData(): Promise<AdminData> {
  const [overviewRaw, usersRaw, coursesRaw, attemptsRaw, papersRaw, accessRaw] =
    await Promise.all([
      rpc("admin_overview_stats"),
      rpc("admin_user_summaries"),
      rpc("admin_course_summaries"),
      rpc("admin_recent_attempts"),
      rpc("admin_past_paper_attempts"),
      rpc("admin_list_user_access"),
    ]);
  const overviewRows = list(overviewSchema, overviewRaw);
  return {
    overview: (overviewRows[0] || overviewSchema.parse({})) as OverviewStats,
    users: list(userSchema, usersRaw) as UserSummary[],
    courses: list(courseSchema, coursesRaw) as CourseSummary[],
    quizAttempts: list(quizSchema, attemptsRaw) as QuizAttempt[],
    paperAttempts: list(paperSchema, papersRaw) as PastPaperAttempt[],
    access: list(accessSchema, accessRaw) as AccessRow[],
  };
}

export type AccessAction =
  | { type: "grant" | "extend"; userId: string; days: number; notes: string }
  | { type: "block"; userId: string; reason: string }
  | { type: "unblock"; userId: string; notes: string };

export async function mutateAccess(action: AccessAction) {
  if (action.type === "grant")
    return rpc("admin_set_user_access", {
      p_user_id: action.userId,
      p_days: action.days,
      p_notes: action.notes,
    });
  if (action.type === "extend")
    return rpc("admin_extend_user_access", {
      p_user_id: action.userId,
      p_days: action.days,
      p_notes: action.notes,
    });
  if (action.type === "block")
    return rpc("admin_block_user_access", {
      p_user_id: action.userId,
      p_reason: action.reason,
    });
  return rpc("admin_unblock_user_access", {
    p_user_id: action.userId,
    p_notes: action.notes,
  });
}
