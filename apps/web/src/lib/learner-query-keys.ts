export const learnerKeys = {
  all: ["learner"] as const,
  shell: () => [...learnerKeys.all, "shell"] as const,
  home: () => [...learnerKeys.all, "home"] as const,
  account: () => [...learnerKeys.all, "account"] as const,
  search: (query: string) =>
    [...learnerKeys.all, "search", query.trim().toLowerCase()] as const,
  history: (filters: Record<string, unknown>) =>
    [...learnerKeys.all, "history", filters] as const,
  browse: (kind: string, ...parts: string[]) =>
    [...learnerKeys.all, "browse", kind, ...parts] as const,
  quiz: (quizId: string) =>
    [...learnerKeys.all, "assessment", "quiz", quizId] as const,
  paper: (setId: string) =>
    [...learnerKeys.all, "assessment", "past-paper", setId] as const,
  review: (kind: string, attemptId: string) =>
    [...learnerKeys.all, "review", kind, attemptId] as const,
};
