export async function fetchPastPaperYears(supabase) {
  return supabase.rpc("app_past_paper_years");
}

export async function fetchPastPaperTopics(
  supabase,
  yearLabel,
  paperGroupLabel = "Past Papers"
) {
  return supabase.rpc("app_past_paper_topics", {
    p_year_label: yearLabel,
    p_paper_group_label: paperGroupLabel,
  });
}

export async function fetchPastPaperExams(
  supabase,
  yearLabel,
  topicLabel,
  paperGroupLabel = "Past Papers"
) {
  return supabase.rpc("app_past_paper_exams", {
    p_year_label: yearLabel,
    p_topic_label: topicLabel,
    p_paper_group_label: paperGroupLabel,
  });
}

export async function submitPastPaperAttempt(
  supabase,
  setId,
  answers,
  { durationMinutes = null, negativeMarking = false, timedOut = false } = {}
) {
  return supabase.rpc("app_submit_past_paper_attempt", {
    p_set_id: setId,
    p_answers: answers,
    p_duration_minutes: durationMinutes,
    p_negative_marking: !!negativeMarking,
    p_timed_out: !!timedOut,
  });
}

export async function fetchPastPaperAttemptReview(supabase, attemptId) {
  return supabase.rpc("app_past_paper_attempt_review", {
    p_attempt_id: attemptId,
  });
}
