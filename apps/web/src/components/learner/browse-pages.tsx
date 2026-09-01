"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  fetchBrowsePage,
  asRecord,
  asRows,
  number,
  text,
} from "@/lib/learner-api";
import { AssessmentSettingsDialog } from "@/components/learner/assessment-settings-dialog";
import {
  BrowseCard,
  Empty,
  PageError,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";
import { Skeleton } from "@/components/ui/skeleton";

function useRequiredParams(names: string[]) {
  const params = useSearchParams();
  return Object.fromEntries(
    names.map((name) => [name, String(params.get(name) || "").trim()])
  );
}

function GridState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: unknown;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <Skeleton className="h-40" key={key} />
        ))}
      </div>
    );
  if (error) return <PageError error={error} />;
  return children;
}

export function YearPage() {
  const { year } = useRequiredParams(["year"]);
  const query = useQuery({
    queryKey: ["learner", "year", year],
    queryFn: () => fetchBrowsePage("year", { p_level: year }),
    enabled: Boolean(year),
  });
  const normal = asRecord(query.data?.normal);
  const paper = asRecord(query.data?.pastPaper ?? query.data?.past_paper);
  if (!year)
    return <PageError error={new Error("No curriculum year was selected.")} />;
  return (
    <section id="year-view">
      <PageHeader
        eyebrow="Year overview"
        title={year || "Choose a year"}
        description="Choose structured topic revision or work through complete past papers."
      />
      <GridState loading={query.isLoading} error={query.error}>
        <div id="year-option-grid" className="grid gap-4 sm:grid-cols-2">
          <BrowseCard
            href={`/modules/?level=${encodeURIComponent(year)}`}
            title="Topic revision"
            meta={`${number(normal, "courseCount", "course_count")} courses`}
            progress={number(normal, "percent")}
            badge="Curriculum"
          />
          {Object.keys(paper).length > 0 && (
            <BrowseCard
              href={`/past-papers/?year=${encodeURIComponent(year)}`}
              title="Past papers"
              meta={`${number(paper, "examCount", "exam_count")} exams`}
              progress={number(paper, "bestPercentage", "best_percentage")}
              badge="Exam practice"
            />
          )}
        </div>
      </GridState>
    </section>
  );
}

export function ModulesPage() {
  const { level } = useRequiredParams(["level"]);
  const query = useQuery({
    queryKey: ["learner", "courses", level],
    queryFn: () => fetchBrowsePage("courses", { p_level: level }),
    enabled: Boolean(level),
  });
  const courses = asRows(query.data?.courses);
  if (!level)
    return <PageError error={new Error("No curriculum year was selected.")} />;
  return (
    <section id="modules-view">
      <PageHeader
        eyebrow={level || "Curriculum"}
        title="Courses"
        description="Select a course to continue into its modules and assessments."
      />
      <GridState loading={query.isLoading} error={query.error}>
        {courses.length ? (
          <div
            id="module-grid"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {courses.map((row) => {
              const name = text(row, "name", "area");
              const summary = Object.keys(asRecord(row.summary)).length
                ? asRecord(row.summary)
                : row;
              return (
                <BrowseCard
                  key={text(row, "courseId", "course_id", "id") || name}
                  href={`/subtopics/?level=${encodeURIComponent(level)}&area=${encodeURIComponent(name)}`}
                  title={name}
                  meta={`${number(summary, "moduleCount", "module_count")} modules`}
                  progress={number(summary, "percent")}
                />
              );
            })}
          </div>
        ) : (
          <Empty />
        )}
      </GridState>
    </section>
  );
}

export function SubtopicsPage() {
  const { level, area } = useRequiredParams(["level", "area"]);
  const query = useQuery({
    queryKey: ["learner", "subtopics", level, area],
    queryFn: () =>
      fetchBrowsePage("subtopics", { p_level: level, p_area: area }),
    enabled: Boolean(level && area),
  });
  const subtopics = asRows(query.data?.subtopics);
  if (!level || !area)
    return <PageError error={new Error("This course link is incomplete.")} />;
  return (
    <section id="subtopics-view">
      <PageHeader
        eyebrow={level}
        title={area || "Modules"}
        description="Choose a module to see its assessment formats."
      />
      <GridState loading={query.isLoading} error={query.error}>
        {subtopics.length ? (
          <div
            id="subtopics-grid"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {subtopics.map((row) => {
              const name = text(row, "name", "subtopic_name");
              const summary = Object.keys(asRecord(row.summary)).length
                ? asRecord(row.summary)
                : row;
              return (
                <BrowseCard
                  key={text(row, "subtopicId", "subtopic_id", "id") || name}
                  href={`/types/?level=${encodeURIComponent(level)}&area=${encodeURIComponent(area)}&sub=${encodeURIComponent(name)}`}
                  title={name}
                  meta={`${number(summary, "totalCount", "total_count")} assessments`}
                  progress={number(summary, "percent")}
                />
              );
            })}
          </div>
        ) : (
          <Empty />
        )}
      </GridState>
    </section>
  );
}

export function TypesPage() {
  const { level, area, sub } = useRequiredParams(["level", "area", "sub"]);
  const query = useQuery({
    queryKey: ["learner", "types", level, area, sub],
    queryFn: () =>
      fetchBrowsePage("types", { p_level: level, p_area: area, p_sub: sub }),
    enabled: Boolean(level && area && sub),
  });
  const types = asRows(query.data?.types);
  if (!level || !area || !sub)
    return <PageError error={new Error("This module link is incomplete.")} />;
  return (
    <section id="types-view">
      <PageHeader
        eyebrow={`${level} / ${area}`}
        title={sub || "Question formats"}
      />
      <StatStrip
        className="selection-stats mb-6"
        items={[
          [
            "Questions",
            number(query.data || {}, "totalQuestions", "total_questions"),
          ],
          [
            "Assessments",
            number(query.data || {}, "totalQuizCount", "total_quiz_count"),
          ],
          ["Complete", `${number(query.data || {}, "percent")}%`],
        ]}
      />
      <GridState loading={query.isLoading} error={query.error}>
        <div id="types-grid" className="grid gap-4 sm:grid-cols-2">
          {types.map((row) => {
            const type = text(row, "type") === "tf" ? "tf" : "sba";
            return (
              <BrowseCard
                className="selection-card"
                key={type}
                href={`/quizzes/?level=${encodeURIComponent(level)}&area=${encodeURIComponent(area)}&sub=${encodeURIComponent(sub)}&type=${type}`}
                title={type === "tf" ? "True or False" : "Single Best Answer"}
                meta={`${number(row, "quizCount", "quiz_count")} assessments / ${number(row, "questionCount", "question_count")} questions`}
                progress={number(row, "percent")}
                badge={type === "tf" ? "Speed" : "Precision"}
              />
            );
          })}
        </div>
      </GridState>
    </section>
  );
}

export function QuizzesPage() {
  const { level, area, sub, type } = useRequiredParams([
    "level",
    "area",
    "sub",
    "type",
  ]);
  const router = useRouter();
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const query = useQuery({
    queryKey: ["learner", "quizzes", level, area, sub, type],
    queryFn: () =>
      fetchBrowsePage("quizzes", {
        p_level: level,
        p_area: area,
        p_sub: sub,
        p_type: type,
      }),
    enabled: Boolean(level && area && sub && ["sba", "tf"].includes(type)),
  });
  const quizzes = asRows(query.data?.quizzes);
  const summary = asRecord(query.data?.summary);
  if (!level || !area || !sub || !["sba", "tf"].includes(type)) {
    return (
      <PageError error={new Error("This assessment list link is invalid.")} />
    );
  }
  return (
    <section id="quiz-list-view">
      <PageHeader
        eyebrow={`${level} / ${area}`}
        title={sub || "Assessments"}
        description={
          type === "tf"
            ? "Fast binary recall assessments."
            : "Five-option clinical reasoning assessments."
        }
      />
      <StatStrip
        className="quizlist-stat-bar mb-6"
        items={[
          [
            "Assessments",
            number(summary, "assessmentCount", "assessment_count") ||
              quizzes.length,
          ],
          ["Completed", number(summary, "completedCount", "completed_count")],
          [
            "Average",
            `${number(summary, "averageBestPercentage", "average_best_percentage")}%`,
          ],
        ]}
      />
      <GridState loading={query.isLoading} error={query.error}>
        {quizzes.length ? (
          <div
            id="quiz-list"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {quizzes.map((row) => {
              const quiz = {
                id: text(row, "quizId", "quiz_id", "id"),
                title: text(row, "title", "quiz_title"),
              };
              return (
                <BrowseCard
                  className="quizlist-card"
                  key={quiz.id}
                  title={quiz.title}
                  meta={`${number(row, "questionCount", "question_count", "count")} questions / ${number(row, "totalAttempts", "total_attempts")} attempts`}
                  progress={
                    row.bestPercentage === null || row.best_percentage === null
                      ? undefined
                      : number(row, "bestPercentage", "best_percentage")
                  }
                  badge={type.toUpperCase()}
                  onClick={() => setSelected(quiz)}
                />
              );
            })}
          </div>
        ) : (
          <Empty />
        )}
      </GridState>
      {selected && (
        <AssessmentSettingsDialog
          title={selected.title}
          close={() => setSelected(null)}
          start={(mode, duration, negative) =>
            router.push(
              `/quiz/?quizId=${encodeURIComponent(selected.id)}&mode=${mode}&duration=${duration || ""}&negative=${negative ? "1" : "0"}`
            )
          }
        />
      )}
    </section>
  );
}
