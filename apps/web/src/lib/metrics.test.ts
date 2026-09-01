import { describe, expect, it } from "vitest";
import { aggregateKpis, buildActivity, buildLearnerMetrics } from "./metrics";
import type { AdminData } from "../types/admin";
const data: AdminData = {
  overview: {
    total_users: 1,
    active_users: 1,
    total_attempts: 2,
    total_quizzes_done: 1,
    average_percentage: 60,
  },
  users: [
    {
      user_id: "u1",
      display_name: "Ada",
      email: "ada@example.com",
      total_attempts: 2,
      quizzes_done: 1,
      average_percentage: 60,
      best_percentage: 70,
      strongest_area: "A",
      weakest_area: "B",
      latest_activity: "2026-08-16T00:00:00Z",
    },
  ],
  courses: [],
  quizAttempts: [
    {
      user_id: "u1",
      quiz_title: "Quiz",
      display_name: "Ada",
      email: "ada@example.com",
      area: "A",
      mode: "study",
      percentage: 60,
      score: 6,
      total_questions: 10,
      completed_at: "2026-08-16T00:00:00Z",
    },
  ],
  paperAttempts: [
    {
      attempt_id: 1,
      user_id: "u1",
      set_id: "p1",
      quiz_title: "Paper",
      area: "A",
      level: "2025",
      mode: "exam",
      assessment_kind: "past_paper",
      score: 8,
      total_questions: 10,
      correct_count: 8,
      wrong_count: 2,
      unanswered_count: 0,
      percentage: 80,
      duration_minutes: 30,
      negative_marking: false,
      timed_out: false,
      completed_at: "2026-08-17T00:00:00Z",
    },
  ],
  access: [
    {
      user_id: "u1",
      email: "ada@example.com",
      display_name: "Ada",
      access_starts_at: null,
      access_expires_at: "2027-01-01T00:00:00Z",
      blocked_at: null,
      block_reason: null,
      notes: null,
      status: "active",
      granted_by: null,
      updated_at: null,
    },
  ],
};
describe("combined admin metrics", () => {
  it("weights normal quiz and past-paper attempts", () => {
    const learner = buildLearnerMetrics(data)[0];
    expect(learner.combined_attempts).toBe(3);
    expect(learner.combined_average).toBe(67);
    expect(learner.combined_assessments).toBe(2);
    expect(learner.latest_activity).toBe("2026-08-17T00:00:00Z");
  });
  it("calculates active engagement", () => {
    expect(aggregateKpis(buildLearnerMetrics(data), true)).toEqual({
      users: 1,
      attempts: 3,
      average: 67,
      engagement: 100,
    });
  });
  it("merges activity newest first", () => {
    expect(buildActivity(data).map((item) => item.kind)).toEqual([
      "Past paper",
      "Quiz",
    ]);
  });
});
