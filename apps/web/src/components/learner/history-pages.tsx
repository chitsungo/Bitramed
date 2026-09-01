"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  LoaderCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { fetchAttemptReview, fetchHistory } from "@/lib/learner-api";
import { learnerKeys } from "@/lib/learner-query-keys";
import type { AttemptKind, HistoryFilters } from "@/types/learner";
import {
  Empty,
  PageError,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "Date unavailable";
}

export function HistoryPage() {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const query = useInfiniteQuery({
    queryKey: learnerKeys.history(filters),
    queryFn: ({ pageParam }) => fetchHistory(filters, pageParam),
    initialPageParam: null as { completedAt: string; key: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });
  const pages = query.data?.pages || [];
  const summary = pages[0]?.summary || {
    attempts: 0,
    averagePercentage: 0,
    bestPercentage: 0,
  };
  const attempts = pages.flatMap((page) => page.items);
  return (
    <section id="history-view">
      <PageHeader
        eyebrow="Performance record"
        title="History"
        description="Review every submitted quiz and past paper."
      />
      <StatStrip
        className="mb-6"
        items={[
          ["Attempts", summary.attempts],
          ["Average", `${summary.averagePercentage}%`],
          ["Best", `${summary.bestPercentage}%`],
        ]}
      />

      <div className="mb-5 grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-medium text-muted-foreground">
          Type
          <select
            className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground"
            value={filters.kind || ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                kind: (event.target.value || undefined) as
                  | AttemptKind
                  | undefined,
              }))
            }
          >
            <option value="">All types</option>
            <option value="quiz">Quizzes</option>
            <option value="past_paper">Past papers</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Mode
          <select
            className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground"
            value={filters.mode || ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                mode: (event.target.value || undefined) as
                  | "study"
                  | "exam"
                  | undefined,
              }))
            }
          >
            <option value="">All modes</option>
            <option value="study">Study</option>
            <option value="exam">Exam</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Year
          <Input
            className="mt-1 h-11"
            value={filters.level || ""}
            placeholder="Any year"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                level: event.target.value || undefined,
              }))
            }
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Course
          <Input
            className="mt-1 h-11"
            value={filters.area || ""}
            placeholder="Any course"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                area: event.target.value || undefined,
              }))
            }
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Since
          <Input
            type="date"
            className="mt-1 h-11"
            value={filters.from?.slice(0, 10) || ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                from: event.target.value
                  ? new Date(`${event.target.value}T00:00:00`).toISOString()
                  : undefined,
              }))
            }
          />
        </label>
      </div>

      {query.isLoading && <Skeleton className="h-80" />}
      {query.error && <PageError error={query.error} />}
      {!query.isLoading && !query.error && !attempts.length && (
        <Empty>No attempts match these filters.</Empty>
      )}
      {attempts.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {attempts.map((attempt) => (
            <Link
              key={`${attempt.kind}:${attempt.attemptId}`}
              href={`/history/review/?kind=${attempt.kind}&attemptId=${encodeURIComponent(attempt.attemptId)}`}
              className="flex min-h-20 items-center gap-3 p-4 hover:bg-muted/60"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <FileText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">
                  {attempt.title}
                </strong>
                <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />{" "}
                  {formatDate(attempt.completedAt)} · {attempt.mode}
                </span>
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {attempt.percentage}%
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
      {query.hasNextPage && (
        <div className="mt-5 text-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}

export function HistoryReviewPage({
  forcedKind,
}: {
  forcedKind?: AttemptKind;
} = {}) {
  const params = useSearchParams();
  const rawKind = params.get("kind");
  const kind: AttemptKind | null =
    forcedKind ||
    (rawKind === "quiz" || rawKind === "past_paper" ? rawKind : null);
  const attemptId = String(params.get("attemptId") || "").trim();
  const query = useQuery({
    queryKey: learnerKeys.review(kind || "invalid", attemptId),
    queryFn: () => fetchAttemptReview(kind!, attemptId),
    enabled: Boolean(kind && attemptId),
  });
  if (!kind || !attemptId)
    return <PageError error={new Error("This review link is invalid.")} />;
  if (query.isLoading) return <Skeleton className="h-[32rem]" />;
  if (query.error || !query.data) return <PageError error={query.error} />;
  const { attempt, items, detailAvailable } = query.data;
  const retryHref =
    kind === "past_paper"
      ? `/past-papers/session/?setId=${encodeURIComponent(attempt.setId || "")}`
      : `/quiz/?quizId=${encodeURIComponent(attempt.quizId || "")}&mode=${attempt.mode}`;
  return (
    <section id="history-review-view">
      <PageHeader
        eyebrow={`${kind === "past_paper" ? "Past paper" : attempt.mode} result`}
        title={attempt.title}
        description={formatDate(attempt.completedAt)}
      />
      <StatStrip
        className="mb-6"
        items={[
          ["Score", `${attempt.score}/${attempt.total}`],
          ["Correct", attempt.correct],
          ["Wrong", attempt.wrong],
          ["Percentage", `${attempt.percentage}%`],
        ]}
      />
      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm sm:grid-cols-4">
        <div className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">Deductions</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {attempt.negativeMarking ? `-${attempt.wrong}` : "0"}
          </dd>
        </div>
        <div className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">Unanswered</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {attempt.unanswered}
          </dd>
        </div>
        <div className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">Timer</dt>
          <dd className="mt-1 font-medium">
            {attempt.durationMinutes
              ? `${attempt.durationMinutes} minutes`
              : "Untimed"}
          </dd>
        </div>
        <div className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">Submission</dt>
          <dd className="mt-1 font-medium">
            {attempt.timedOut ? "Time expired" : "Completed"}
          </dd>
        </div>
      </dl>
      <div className="mb-7 flex flex-wrap gap-3">
        <Link
          href={retryHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 text-sm font-medium text-action-foreground"
        >
          <RotateCcw className="size-4" /> Try again
        </Link>
        <Link
          href="/history/"
          className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
        >
          Back to history
        </Link>
      </div>
      {!detailAvailable && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          This older attempt has a score summary but no saved question-level
          review.
        </div>
      )}
      {detailAvailable && (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border bg-card p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                {item.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Question {item.position} ·{" "}
                    {item.isCorrect
                      ? "Correct"
                      : item.userAnswer
                        ? "Incorrect"
                        : "Unanswered"}
                  </p>
                  <h2 className="mt-2 text-sm font-medium leading-6 sm:text-base">
                    {item.questionText}
                  </h2>
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt="Question reference"
                      width={1200}
                      height={700}
                      className="mt-4 max-h-72 w-full rounded-lg object-contain"
                    />
                  )}
                  <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Your answer
                      </dt>
                      <dd className="mt-1 font-medium">
                        {item.userAnswer || "Unanswered"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Correct answer
                      </dt>
                      <dd className="mt-1 font-medium">{item.correctAnswer}</dd>
                    </div>
                  </dl>
                  {item.explanation && (
                    <p className="mt-4 rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">
                      {item.explanation}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
