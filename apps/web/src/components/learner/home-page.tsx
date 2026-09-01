"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  FileText,
  History,
  Play,
} from "lucide-react";
import { fetchHomeBootstrap, text } from "@/lib/learner-api";
import { learnerKeys } from "@/lib/learner-query-keys";
import { useLearnerSession } from "@/components/learner/learner-gate";
import {
  BrowseCard,
  Empty,
  PageError,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";
import { Skeleton } from "@/components/ui/skeleton";

function formatRelative(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Recently";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function HomePage() {
  const { user } = useLearnerSession();
  const query = useQuery({
    queryKey: learnerKeys.home(),
    queryFn: fetchHomeBootstrap,
  });
  if (query.isLoading)
    return (
      <div className="grid gap-5">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    );
  if (query.error || !query.data) return <PageError error={query.error} />;
  const { dashboard, drafts, recentAttempts } = query.data;
  const displayName = String(
    user.user_metadata?.display_name || user.email?.split("@")[0] || "Learner"
  );
  return (
    <section id="home-view">
      <PageHeader
        eyebrow="Learning dashboard"
        title={`Welcome back, ${displayName}`}
        description="Continue a saved assessment or choose the next area to revise."
      />

      <StatStrip
        className="mb-7"
        items={[
          ["Attempts", dashboard.attemptCount],
          ["Completed", dashboard.completedCount],
          ["Average", `${dashboard.averageScore}%`],
          ["Best", `${dashboard.bestScore}%`],
        ]}
      />

      {drafts.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">
                Continue learning
              </p>
              <h2 className="mt-1 text-lg font-semibold">Saved assessments</h2>
            </div>
            <Clock3 className="size-5 text-muted-foreground" />
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {drafts.slice(0, 3).map((draft) => {
              const title =
                text(draft.context, "quiz_title", "title") ||
                (draft.kind === "past_paper" ? "Past paper" : "Assessment");
              const href =
                draft.kind === "past_paper"
                  ? `/past-papers/session/?setId=${encodeURIComponent(draft.assessmentId)}&duration=${draft.durationMinutes || ""}&negative=${draft.negativeMarking ? "1" : "0"}`
                  : `/quiz/?quizId=${encodeURIComponent(draft.assessmentId)}&mode=${draft.mode}&duration=${draft.durationMinutes || ""}&negative=${draft.negativeMarking ? "1" : "0"}`;
              return (
                <Link
                  key={`${draft.kind}:${draft.assessmentId}`}
                  href={href}
                  className="flex min-h-20 items-center gap-3 p-4 hover:bg-muted/60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Play className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{title}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {draft.answeredCount} answered ·{" "}
                      {formatRelative(draft.updatedAt)}
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/learn/?view=revision"
          className="flex min-h-24 items-center gap-4 rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-muted/40"
        >
          <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
            <BookOpen className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block">Curriculum revision</strong>
            <span className="mt-1 block text-sm text-muted-foreground">
              Browse years, courses, and modules
            </span>
          </span>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>
        <Link
          href="/learn/?view=papers"
          className="flex min-h-24 items-center gap-4 rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-muted/40"
        >
          <span className="grid size-11 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block">Past papers</strong>
            <span className="mt-1 block text-sm text-muted-foreground">
              Timed full-paper practice
            </span>
          </span>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              Curriculum
            </p>
            <h2 className="mt-1 text-lg font-semibold">Years</h2>
          </div>
          <Link
            href="/learn/"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div id="year-grid" className="grid gap-3 sm:grid-cols-2">
          {dashboard.levels.map((level) => (
            <BrowseCard
              key={level.id}
              href={`/year/?year=${encodeURIComponent(level.name)}`}
              title={level.name}
              meta={`${level.courseCount} courses · ${level.totalCount} assessments`}
              progress={level.percent}
              badge="Curriculum"
            />
          ))}
        </div>
        {!dashboard.levels.length && (
          <Empty>No curriculum years are available yet.</Empty>
        )}
      </section>

      <section className="mt-9 border-t pt-7">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              Recent activity
            </p>
            <h2 className="mt-1 text-lg font-semibold">Latest attempts</h2>
          </div>
          <Link
            href="/history/"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <History className="size-4" /> Full history
          </Link>
        </div>
        {recentAttempts.length ? (
          <div className="divide-y rounded-lg border bg-card">
            {recentAttempts.slice(0, 5).map((attempt) => (
              <Link
                key={`${attempt.kind}:${attempt.attemptId}`}
                href={`/history/review/?kind=${attempt.kind}&attemptId=${encodeURIComponent(attempt.attemptId)}`}
                className="flex min-h-16 items-center gap-3 p-4 hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">
                    {attempt.title}
                  </strong>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {[attempt.level, attempt.area, attempt.mode]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {attempt.percentage}%
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>No attempts recorded yet.</Empty>
        )}
      </section>
    </section>
  );
}
