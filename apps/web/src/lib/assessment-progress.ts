import { getSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import {
  clearLocalLearnerData,
  deleteLocalDraft,
  readLocalDraft,
  saveLocalDraft,
} from "@/lib/assessment-store";

export type AssessmentDraft = {
  progressKey: string;
  mode: "study" | "exam";
  durationMinutes: number | null;
  negativeMarking: boolean;
  context: Record<string, unknown>;
  answers: Record<string, string>;
  flags: string[];
  currentIndex: number;
  submissionId: string;
  timerExpiresAt: string | null;
  sessionPayload?: unknown;
};

export async function saveAssessmentDraft(
  userId: string,
  kind: "quiz" | "past_paper",
  assessmentId: string,
  draft: AssessmentDraft
) {
  const updatedAt = new Date().toISOString();
  await saveLocalDraft({
    ...draft,
    userId,
    kind,
    assessmentId,
    updatedAt,
  }).catch(() => undefined);
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
        progress_data: {
          answers: draft.answers,
          flags: draft.flags,
          currentIndex: draft.currentIndex,
          submissionId: draft.submissionId,
        },
        timer_expires_at: draft.timerExpiresAt,
      },
      { onConflict: "user_id,assessment_kind,assessment_id,progress_key" }
    );
  if (error) throw error;
  return { synced: true, updatedAt };
}

export { readLocalDraft };

export async function deleteAssessmentDraft(
  userId: string,
  kind: "quiz" | "past_paper",
  assessmentId: string,
  progressKey: string
) {
  await deleteLocalDraft(userId, kind, assessmentId, progressKey).catch(
    () => undefined
  );
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
  if (result.error) throw result.error;
  await clearLocalLearnerData(userId).catch(() => undefined);
}

export async function clearAssessmentDrafts(userId: string) {
  const result = await getSupabase().rpc("app_clear_assessment_drafts");
  if (result.error) throw result.error;
  await clearLocalLearnerData(userId).catch(() => undefined);
}

export { clearLocalLearnerData };
