import { getSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

export type AssessmentDraft = {
  progressKey: string;
  mode: "study" | "exam";
  durationMinutes: number | null;
  negativeMarking: boolean;
  context: Record<string, unknown>;
  answers: Record<string, string>;
  timerExpiresAt: string | null;
};

export async function saveAssessmentDraft(
  userId: string,
  kind: "quiz" | "past_paper",
  assessmentId: string,
  draft: AssessmentDraft
) {
  const { error } = await getSupabase()
    .from("user_assessment_progress")
    .upsert(
      {
        user_id: userId,
        assessment_kind: kind,
        assessment_id: assessmentId,
        progress_key: draft.progressKey,
        mode: draft.mode,
        duration_minutes: draft.durationMinutes,
        negative_marking: draft.negativeMarking,
        context: JSON.parse(JSON.stringify(draft.context)) as Json,
        progress_data: { answers: draft.answers },
        timer_expires_at: draft.timerExpiresAt,
      },
      { onConflict: "user_id,assessment_kind,assessment_id,progress_key" }
    );
  if (error) throw error;
}

export async function deleteAssessmentDraft(
  userId: string,
  kind: "quiz" | "past_paper",
  assessmentId: string,
  progressKey: string
) {
  const { error } = await getSupabase()
    .from("user_assessment_progress")
    .delete()
    .eq("user_id", userId)
    .eq("assessment_kind", kind)
    .eq("assessment_id", assessmentId)
    .eq("progress_key", progressKey);
  if (error) throw error;
}

export async function clearAssessmentHistory(userId: string) {
  const result = await getSupabase().rpc("app_reset_account_history");
  if (!result.error) return;
  if (!["PGRST202", "42883"].includes(String(result.error.code || "")))
    throw result.error;
  const [attempts, progress] = await Promise.all([
    getSupabase().from("quiz_attempts").delete().eq("user_id", userId),
    getSupabase()
      .from("user_assessment_progress")
      .delete()
      .eq("user_id", userId),
  ]);
  if (attempts.error) throw attempts.error;
  if (progress.error) throw progress.error;
}
