const PROGRESS_COLUMNS = [
  "user_id",
  "assessment_kind",
  "assessment_id",
  "progress_key",
  "mode",
  "duration_minutes",
  "negative_marking",
  "context",
  "progress_data",
  "timer_expires_at",
  "updated_at",
].join(", ");

export async function fetchAssessmentProgress(
  supabase,
  userId,
  assessmentKind,
  assessmentId,
  progressKey = ""
) {
  if (!userId || !assessmentKind || !assessmentId) {
    return { data: null, error: null };
  }

  let query = supabase
    .from("user_assessment_progress")
    .select(PROGRESS_COLUMNS)
    .eq("user_id", userId)
    .eq("assessment_kind", assessmentKind)
    .eq("assessment_id", String(assessmentId));

  if (progressKey) {
    query = query.eq("progress_key", progressKey);
  } else {
    query = query.order("updated_at", { ascending: false }).limit(1);
  }
  return query.maybeSingle();
}

export async function upsertAssessmentProgress(
  supabase,
  userId,
  assessmentKind,
  assessmentId,
  draft
) {
  if (!userId || !assessmentKind || !assessmentId) {
    return { data: null, error: null };
  }

  return supabase.from("user_assessment_progress").upsert(
    {
      user_id: userId,
      assessment_kind: assessmentKind,
      assessment_id: String(assessmentId),
      progress_key: draft.progressKey,
      mode: draft.mode === "exam" ? "exam" : "study",
      duration_minutes: draft.durationMinutes || null,
      negative_marking: !!draft.negativeMarking,
      context: draft.context || {},
      progress_data: draft.progressData || {},
      timer_expires_at: draft.timerExpiresAt || null,
    },
    {
      onConflict: "user_id,assessment_kind,assessment_id,progress_key",
    }
  );
}

export async function deleteAssessmentProgress(
  supabase,
  userId,
  assessmentKind,
  assessmentId,
  progressKey
) {
  if (!userId || !assessmentKind || !assessmentId || !progressKey) {
    return { data: null, error: null };
  }

  return supabase
    .from("user_assessment_progress")
    .delete()
    .eq("user_id", userId)
    .eq("assessment_kind", assessmentKind)
    .eq("assessment_id", String(assessmentId))
    .eq("progress_key", progressKey);
}

export async function deleteAllAssessmentProgress(supabase, userId) {
  if (!userId) return { data: null, error: null };

  return supabase
    .from("user_assessment_progress")
    .delete()
    .eq("user_id", userId);
}
