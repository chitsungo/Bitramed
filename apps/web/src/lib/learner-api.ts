import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

export type AccessStatus = {
  status: "active" | "expired" | "blocked" | "no_access" | "signed_out";
  hasAccess: boolean;
  accessExpiresAt: string | null;
  blockReason: string;
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

export type HomeBootstrap = {
  access: AccessStatus;
  themePreference: "light" | "dark" | null;
  dashboard: {
    activeYears: number;
    completedCount: number;
    averageScore: number;
    levels: LevelSummary[];
    pastPaperYears: UnknownRow[];
  };
};

export type UnknownRow = Record<string, unknown>;

const recordSchema = z.record(z.string(), z.unknown());

function record(value: unknown): UnknownRow {
  const result = recordSchema.safeParse(value);
  return result.success ? result.data : {};
}

function rows(value: unknown): UnknownRow[] {
  return (Array.isArray(value) ? value : []).map(record);
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

export function boolean(row: UnknownRow, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) return row[key] === true;
  }
  return false;
}

export async function rpc(name: string, args: UnknownRow = {}) {
  const supabase = getSupabase();
  const call = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    parameters?: UnknownRow
  ) => Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
  const { data, error } = await call(name, args);
  if (error)
    throw Object.assign(new Error(error.message), { code: error.code });
  return data;
}

export function normalizeAccess(value: unknown): AccessStatus {
  const source = record(value);
  const rawStatus = text(source, "status");
  const status = [
    "active",
    "expired",
    "blocked",
    "no_access",
    "signed_out",
  ].includes(rawStatus)
    ? (rawStatus as AccessStatus["status"])
    : "no_access";
  return {
    status,
    hasAccess:
      boolean(source, "hasAccess", "has_access") || status === "active",
    accessExpiresAt:
      text(source, "accessExpiresAt", "access_expires_at") || null,
    blockReason: text(source, "blockReason", "block_reason"),
  };
}

export async function fetchShellBootstrap() {
  const payload = record(await rpc("app_shell_bootstrap"));
  return {
    access: normalizeAccess(payload.access),
    themePreference:
      payload.themePreference === "dark" || payload.themePreference === "light"
        ? payload.themePreference
        : null,
  };
}

export async function fetchHomeBootstrap(): Promise<HomeBootstrap> {
  const payload = record(await rpc("app_home_bootstrap"));
  const dashboard = record(payload.dashboard);
  return {
    access: normalizeAccess(payload.access),
    themePreference:
      payload.themePreference === "dark" || payload.themePreference === "light"
        ? payload.themePreference
        : null,
    dashboard: {
      activeYears: number(dashboard, "activeYears", "active_years"),
      completedCount: number(dashboard, "completedCount", "completed_count"),
      averageScore: number(dashboard, "averageScore", "average_score"),
      levels: rows(dashboard.levels)
        .map((row) => ({
          id: text(row, "levelId", "level_id", "id"),
          name: text(row, "name", "level"),
          displayOrder: number(row, "displayOrder", "display_order"),
          courseCount: number(row, "courseCount", "course_count"),
          doneCount: number(row, "doneCount", "done_count"),
          totalCount: number(row, "totalCount", "total_count"),
          percent: number(row, "percent"),
        }))
        .filter((row) => row.id && row.name)
        .sort(
          (a, b) =>
            a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
        ),
      pastPaperYears: rows(
        dashboard.pastPaperYears ?? dashboard.past_paper_years
      ),
    },
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
  return record(await rpc(functions[kind], params));
}

export async function fetchQuizSession(quizId: string, progressKey: string) {
  return record(
    await rpc("app_quiz_session", {
      p_quiz_id: quizId,
      p_progress_key: progressKey,
    })
  );
}

export async function fetchAccountPage() {
  return record(await rpc("app_account_page", { p_limit: 10 }));
}

export async function fetchSearch(query: string) {
  return record(
    await rpc("app_quiz_search", {
      p_query: query.trim().toLowerCase(),
      p_limit: query.trim() ? 18 : 12,
    })
  );
}

export async function fetchPastPaperYears() {
  return rows(await rpc("app_past_paper_years"));
}

export async function fetchPastPaperTopics(year: string) {
  return rows(
    await rpc("app_past_paper_topics", {
      p_year_label: year,
      p_paper_group_label: "Past Papers",
    })
  );
}

export async function fetchPastPaperExams(year: string, topic: string) {
  return rows(
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
  return record(
    await rpc("app_past_paper_session", {
      p_set_id: setId,
      p_progress_key: progressKey,
    })
  );
}

export async function submitPastPaper(
  setId: string,
  answers: Record<string, string>,
  settings: {
    durationMinutes: number | null;
    negativeMarking: boolean;
    timedOut: boolean;
  }
) {
  return record(
    await rpc("app_submit_past_paper_attempt", {
      p_set_id: setId,
      p_answers: answers,
      p_duration_minutes: settings.durationMinutes,
      p_negative_marking: settings.negativeMarking,
      p_timed_out: settings.timedOut,
    })
  );
}

export async function fetchPastPaperReview(attemptId: string) {
  return record(
    await rpc("app_past_paper_attempt_review", { p_attempt_id: attemptId })
  );
}

export { record as asRecord, rows as asRows };
