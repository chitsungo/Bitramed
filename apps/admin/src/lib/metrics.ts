import type { ActivityItem, AdminData, LearnerMetric } from "@/types/admin";

export function buildLearnerMetrics(data: AdminData): LearnerMetric[] {
  const users = new Map(data.users.map((user) => [user.user_id, user]));
  const papers = new Map<string, typeof data.paperAttempts>();
  for (const attempt of data.paperAttempts)
    papers.set(attempt.user_id, [
      ...(papers.get(attempt.user_id) || []),
      attempt,
    ]);

  return data.access.map((access) => {
    const normal = users.get(access.user_id);
    const paper = papers.get(access.user_id) || [];
    const normalAttempts = normal?.total_attempts || 0;
    const combinedAttempts = normalAttempts + paper.length;
    const paperTotal = paper.reduce((sum, item) => sum + item.percentage, 0);
    const average = combinedAttempts
      ? ((normal?.average_percentage || 0) * normalAttempts + paperTotal) /
        combinedAttempts
      : 0;
    const paperLatest =
      paper
        .map((item) => item.completed_at)
        .sort()
        .at(-1) || null;
    const latest =
      [normal?.latest_activity, paperLatest].filter(Boolean).sort().at(-1) ||
      null;
    return {
      ...access,
      normal_attempts: normalAttempts,
      past_paper_attempts: paper.length,
      combined_attempts: combinedAttempts,
      combined_assessments:
        (normal?.quizzes_done || 0) +
        new Set(paper.map((item) => item.set_id)).size,
      combined_average: Math.round(average),
      best_percentage: Math.max(
        normal?.best_percentage || 0,
        ...paper.map((item) => item.percentage),
        0
      ),
      latest_activity: latest,
      strongest_area: normal?.strongest_area || null,
      weakest_area: normal?.weakest_area || null,
    };
  });
}

export function buildActivity(data: AdminData): ActivityItem[] {
  const identity = new Map(data.access.map((row) => [row.user_id, row]));
  return [
    ...data.quizAttempts.map((item, index) => ({
      id: `quiz-${item.user_id}-${item.completed_at}-${index}`,
      user_id: item.user_id,
      display_name: item.display_name,
      email: item.email,
      title: item.quiz_title,
      area: item.area,
      kind: "Quiz" as const,
      mode: item.mode,
      percentage: item.percentage,
      score: item.score,
      total_questions: item.total_questions,
      completed_at: item.completed_at,
    })),
    ...data.paperAttempts.map((item) => ({
      id: `paper-${item.attempt_id}`,
      user_id: item.user_id,
      display_name: identity.get(item.user_id)?.display_name || null,
      email: identity.get(item.user_id)?.email || null,
      title: item.quiz_title,
      area: item.area,
      kind: "Past paper" as const,
      mode: item.mode,
      percentage: item.percentage,
      score: item.score,
      total_questions: item.total_questions,
      completed_at: item.completed_at,
    })),
  ].sort((a, b) => +new Date(b.completed_at) - +new Date(a.completed_at));
}

export function aggregateKpis(learners: LearnerMetric[], activeOnly: boolean) {
  const scope = activeOnly
    ? learners.filter((item) => item.status === "active")
    : learners;
  const attempts = scope.reduce((sum, item) => sum + item.combined_attempts, 0);
  const weighted = scope.reduce(
    (sum, item) => sum + item.combined_average * item.combined_attempts,
    0
  );
  const engaged = scope.filter((item) => item.combined_attempts > 0).length;
  return {
    users: scope.length,
    attempts,
    average: attempts ? Math.round(weighted / attempts) : 0,
    engagement: scope.length ? Math.round((engaged / scope.length) * 100) : 0,
  };
}
