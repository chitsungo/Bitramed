"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, BarChart3, CalendarDays } from "lucide-react";
import {
  asRecord,
  asRows,
  fetchAccountPage,
  number,
  text,
} from "@/lib/learner-api";
import {
  Empty,
  PageError,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";
import { Skeleton } from "@/components/ui/skeleton";

export function AccountPage() {
  const query = useQuery({
    queryKey: ["learner", "account"],
    queryFn: fetchAccountPage,
  });
  if (query.isLoading) return <Skeleton className="h-96" />;
  if (query.error || !query.data) return <PageError error={query.error} />;
  const data = query.data;
  const recent = asRows(data.recentAttempts ?? data.recent_attempts);
  const courses = asRows(data.courseStats ?? data.course_stats);
  const best = asRecord(data.bestAttempt ?? data.best_attempt);
  return (
    <section id="account-view">
      <PageHeader
        eyebrow="Performance"
        title="Your account"
        description="A combined view of topic assessments and exam practice."
      />
      <StatStrip
        className="mb-7"
        items={[
          ["Attempts", number(data, "attemptsCount", "attempts_count")],
          ["Completed", number(data, "quizzesDoneCount", "quizzes_done_count")],
          [
            "Average",
            `${number(data, "averagePercentage", "average_percentage")}%`,
          ],
        ]}
      />
      <div className="grid gap-7 lg:grid-cols-[1fr_1.4fr]">
        <section>
          <div className="rounded-lg border bg-card p-5">
            <Award className="size-5 text-warning" />
            <p className="mt-4 text-xs uppercase text-muted-foreground">
              Best result
            </p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {number(best, "percentage")}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {text(best, "mode") || "No attempts yet"}
            </p>
          </div>
          <h2 className="mt-7 text-lg font-semibold">Course averages</h2>
          <div className="mt-3 space-y-3">
            {courses.map((row) => (
              <div
                className="rounded-lg border bg-card p-4"
                key={text(row, "area")}
              >
                <div className="flex justify-between gap-4">
                  <span className="font-medium">{text(row, "area")}</span>
                  <span className="tabular-nums">
                    {number(row, "averagePercentage", "average_percentage")}%
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${number(row, "averagePercentage", "average_percentage")}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Recent attempts</h2>
          </div>
          <div className="mt-3 divide-y rounded-lg border bg-card">
            {recent.map((row, index) => (
              <div
                className="flex items-center justify-between gap-4 p-4"
                key={text(row, "id", "quizId", "quiz_id") || index}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {text(row, "quizTitle", "quiz_title", "title")}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {text(row, "area")} / {text(row, "mode")}
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums">
                  {number(row, "percentage")}%
                </span>
              </div>
            ))}
            {!recent.length && <Empty>No attempts recorded yet.</Empty>}
          </div>
        </section>
      </div>
    </section>
  );
}
