"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText } from "lucide-react";
import { fetchHomeBootstrap } from "@/lib/learner-api";
import { learnerKeys } from "@/lib/learner-query-keys";
import {
  BrowseCard,
  Empty,
  PageError,
  PageHeader,
} from "@/components/learner/page-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LearnPage() {
  const params = useSearchParams();
  const rawView = params.get("view");
  const view = rawView === "papers" ? "papers" : "revision";
  const invalidView =
    rawView !== null && !["revision", "papers"].includes(rawView);
  const query = useQuery({
    queryKey: learnerKeys.home(),
    queryFn: fetchHomeBootstrap,
  });
  if (invalidView)
    return <PageError error={new Error("This learning link is invalid.")} />;
  if (query.isLoading) return <Skeleton className="h-96" />;
  if (query.error || !query.data) return <PageError error={query.error} />;
  const { levels, pastPaperYears } = query.data.dashboard;
  return (
    <section id="learn-view">
      <PageHeader
        eyebrow="Learning library"
        title="Learn"
        description="Choose structured curriculum revision or complete past-paper practice."
      />
      <div
        className="mb-6 grid grid-cols-2 rounded-lg border bg-card p-1"
        role="tablist"
        aria-label="Learning content"
      >
        <Link
          href="/learn/?view=revision"
          role="tab"
          aria-selected={view === "revision"}
          className={cn(
            "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium",
            view === "revision"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <BookOpen className="size-4" /> Revision
        </Link>
        <Link
          href="/learn/?view=papers"
          role="tab"
          aria-selected={view === "papers"}
          className={cn(
            "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium",
            view === "papers"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <FileText className="size-4" /> Past papers
        </Link>
      </div>

      {view === "revision" ? (
        levels.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {levels.map((level) => (
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
        ) : (
          <Empty>No curriculum years are available yet.</Empty>
        )
      ) : pastPaperYears.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {pastPaperYears.map((paper) => (
            <BrowseCard
              key={paper.year}
              href={`/past-papers/?year=${encodeURIComponent(paper.year)}`}
              title={paper.year}
              meta={`${paper.examCount} exams · ${paper.totalMarks} marks`}
              progress={paper.bestPercentage}
              badge="Past papers"
            />
          ))}
        </div>
      ) : (
        <Empty>No past papers are available yet.</Empty>
      )}
    </section>
  );
}
