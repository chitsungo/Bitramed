"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Clock3, GraduationCap, TrendingUp } from "lucide-react";
import { fetchHomeBootstrap, number, text } from "@/lib/learner-api";
import {
  BrowseCard,
  Empty,
  PageError,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";
import { Skeleton } from "@/components/ui/skeleton";

export function HomePage() {
  const query = useQuery({
    queryKey: ["learner", "home"],
    queryFn: fetchHomeBootstrap,
  });
  if (query.isLoading)
    return (
      <div className="grid gap-5">
        <Skeleton className="h-28" />
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  if (query.error || !query.data) return <PageError error={query.error} />;
  const { dashboard } = query.data;
  return (
    <section id="home-view">
      <PageHeader
        eyebrow="Learning dashboard"
        title="Pick up where you left off"
        description="Structured revision and past-paper practice, with progress kept in sync across devices."
      />
      <StatStrip
        className="mb-7"
        items={[
          ["Active years", dashboard.activeYears],
          ["Completed", dashboard.completedCount],
          ["Average", `${dashboard.averageScore}%`],
        ]}
      />
      <div id="year-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboard.levels.map((level) => (
          <BrowseCard
            key={level.id}
            href={`/year/?year=${encodeURIComponent(level.name)}`}
            title={level.name}
            meta={`${level.courseCount} courses / ${level.totalCount} assessments`}
            progress={level.percent}
            badge="Curriculum"
          />
        ))}
      </div>
      {!dashboard.levels.length && (
        <Empty>No curriculum years are available yet.</Empty>
      )}
      {dashboard.pastPaperYears.length > 0 && (
        <section className="mt-10 border-t pt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">
                Exam preparation
              </p>
              <h2 className="mt-1 text-xl font-semibold">Past papers</h2>
            </div>
            <Clock3 className="size-5 text-muted-foreground" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.pastPaperYears.map((row) => {
              const year = text(row, "year_label", "yearLabel");
              return (
                <BrowseCard
                  key={year}
                  href={`/past-papers/?year=${encodeURIComponent(year)}`}
                  title={year}
                  meta={`${number(row, "exam_count", "examCount")} exams / ${number(row, "total_marks", "totalMarks")} marks`}
                  progress={number(row, "best_percentage", "bestPercentage")}
                  badge="Past papers"
                />
              );
            })}
          </div>
        </section>
      )}
      <div className="mt-10 grid grid-cols-3 gap-3 border-t pt-7 text-center text-xs text-muted-foreground">
        <span>
          <GraduationCap className="mx-auto mb-2 size-5 text-primary" />
          Curriculum aligned
        </span>
        <span>
          <BookOpenCheck className="mx-auto mb-2 size-5 text-success" />
          Saved progress
        </span>
        <span>
          <TrendingUp className="mx-auto mb-2 size-5 text-warning" />
          Performance trends
        </span>
      </div>
    </section>
  );
}
