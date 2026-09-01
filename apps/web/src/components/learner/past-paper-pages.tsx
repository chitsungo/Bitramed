"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock3, Flag, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  deleteAssessmentDraft,
  readLocalDraft,
  saveAssessmentDraft,
} from "@/lib/assessment-progress";
import {
  asRecord,
  asRows,
  fetchPastPaperExams,
  fetchPastPaperSession,
  fetchPastPaperTopics,
  fetchPastPaperYears,
  number,
  submitPastPaper,
  text,
} from "@/lib/learner-api";
import { useLearnerSession } from "@/components/learner/learner-gate";
import { AssessmentSettingsDialog } from "@/components/learner/assessment-settings-dialog";
import {
  BrowseCard,
  Empty,
  PageError,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HistoryReviewPage } from "@/components/learner/history-pages";
import { parseBooleanParam, parseDurationParam } from "@/lib/learner-query";

export function PastPapersPage() {
  const params = useSearchParams();
  const year = String(params.get("year") || "");
  const query = useQuery({
    queryKey: ["learner", "papers", year],
    queryFn: () => (year ? fetchPastPaperTopics(year) : fetchPastPaperYears()),
  });
  if (query.isLoading) return <Skeleton className="h-80" />;
  if (query.error) return <PageError error={query.error} />;
  const rows = query.data || [];
  return (
    <section id="past-papers-view">
      <PageHeader
        eyebrow="Exam preparation"
        title={year || "Past papers"}
        description={
          year
            ? "Choose a subject to see its available papers."
            : "Practice complete papers with optional timing and negative marking."
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const title = year
            ? text(row, "topic_label", "topicLabel")
            : text(row, "year_label", "yearLabel");
          const href = year
            ? `/past-papers/exams/?year=${encodeURIComponent(year)}&topic=${encodeURIComponent(title)}`
            : `/past-papers/?year=${encodeURIComponent(title)}`;
          return (
            <BrowseCard
              key={title}
              href={href}
              title={title}
              meta={`${number(row, "exam_count", "examCount")} exams / ${number(row, "total_marks", "totalMarks")} marks`}
              progress={number(row, "best_percentage", "bestPercentage")}
              badge="Past papers"
            />
          );
        })}
      </div>
      {!rows.length && <Empty>No past papers are available yet.</Empty>}
    </section>
  );
}

export function PastPaperExamsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const year = String(params.get("year") || "");
  const topic = String(params.get("topic") || "");
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const query = useQuery({
    queryKey: ["learner", "paper-exams", year, topic],
    queryFn: () => fetchPastPaperExams(year, topic),
    enabled: Boolean(year && topic),
  });
  if (query.isLoading) return <Skeleton className="h-80" />;
  if (query.error) return <PageError error={query.error} />;
  const rows = query.data || [];
  if (!year || !topic)
    return (
      <PageError error={new Error("This past-paper link is incomplete.")} />
    );
  return (
    <section id="past-paper-exams-view">
      <PageHeader eyebrow={`${year} / Past papers`} title={topic || "Exams"} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const id = text(row, "set_id", "setId");
          return (
            <BrowseCard
              key={id}
              title={text(row, "title")}
              meta={`${number(row, "unit_count", "unitCount")} sections / ${number(row, "total_marks", "totalMarks")} marks`}
              progress={number(row, "best_percentage", "bestPercentage")}
              badge="Exam"
              onClick={() => setSelected({ id, title: text(row, "title") })}
            />
          );
        })}
      </div>
      {!rows.length && <Empty />}
      {selected && (
        <AssessmentSettingsDialog
          title={selected.title}
          kind="past_paper"
          close={() => setSelected(null)}
          start={(_mode, duration, negative) =>
            router.push(
              `/past-papers/session/?setId=${encodeURIComponent(selected.id)}&duration=${duration || ""}&negative=${negative ? "1" : "0"}`
            )
          }
        />
      )}
    </section>
  );
}

type Branch = { id: string; order: number; prompt: string };
type Unit = { id: string; stem: string; imageUrl: string; branches: Branch[] };
function normalizeUnits(value: unknown): Unit[] {
  return asRows(value).map((row, index) => ({
    id: text(row, "unit_id", "unitId") || String(index),
    stem: text(row, "stem"),
    imageUrl: text(row, "image_url", "imageUrl"),
    branches: asRows(row.branches).map((branch, branchIndex) => ({
      id:
        text(branch, "branchId", "branch_id", "id") ||
        `${index}-${branchIndex}`,
      order: number(branch, "order", "display_order") || branchIndex + 1,
      prompt: text(branch, "prompt"),
    })),
  }));
}

export function PastPaperSessionPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useLearnerSession();
  const setId = String(params.get("setId") || "");
  const durationParam = parseDurationParam(params.get("duration"));
  const negativeParam = parseBooleanParam(params.get("negative"));
  const duration = durationParam.value;
  const negative = negativeParam.value;
  const invalidSettings = !durationParam.valid || !negativeParam.valid;
  const progressKey = "current";
  const query = useQuery({
    queryKey: ["learner", "paper-session", setId],
    queryFn: async () => {
      try {
        return await fetchPastPaperSession(setId, progressKey);
      } catch (error) {
        const local = await readLocalDraft(
          user.id,
          "past_paper",
          setId,
          progressKey
        ).catch(() => undefined);
        if (local?.sessionPayload) return asRecord(local.sessionPayload);
        throw error;
      }
    },
    enabled: Boolean(setId && !invalidSettings),
  });
  const paper = asRecord(query.data?.paper);
  const units = useMemo(
    () => normalizeUnits(query.data?.units),
    [query.data?.units]
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  useEffect(() => {
    if (!query.data) return;
    let active = true;
    async function restore() {
      const progress = asRecord(query.data?.progress);
      const data = asRecord(progress.progress_data ?? progress.progressData);
      const local = await readLocalDraft(
        user.id,
        "past_paper",
        setId,
        progressKey
      ).catch(() => undefined);
      if (!active) return;
      const saved = local?.answers || asRecord(data.answers);
      setSubmissionId(
        local?.submissionId || String(data.submissionId || crypto.randomUUID())
      );
      setAnswers(
        Object.fromEntries(
          Object.entries(saved).map(([key, value]) => [key, String(value)])
        )
      );
      const localExpiry = local?.timerExpiresAt
        ? Date.parse(local.timerExpiresAt)
        : NaN;
      const remoteExpiry = Date.parse(
        text(progress, "timer_expires_at", "timerExpiresAt")
      );
      setExpiresAt(
        Number.isFinite(localExpiry)
          ? localExpiry
          : Number.isFinite(remoteExpiry)
            ? remoteExpiry
            : duration
              ? Date.now() + duration * 60000
              : null
      );
    }
    void restore();
    return () => {
      active = false;
    };
  }, [query.data, duration, setId, user.id]);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  useEffect(() => {
    if (!query.data || !submissionId) return;
    const id = window.setTimeout(
      () =>
        void saveAssessmentDraft(user.id, "past_paper", setId, {
          progressKey,
          mode: "exam",
          durationMinutes: duration,
          negativeMarking: negative,
          context: paper,
          answers,
          flags: [],
          currentIndex: 0,
          submissionId,
          timerExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          sessionPayload: query.data,
        }).catch(() => toast.error("Draft could not be synced.")),
      500
    );
    return () => window.clearTimeout(id);
  }, [
    answers,
    duration,
    expiresAt,
    negative,
    paper,
    query.data,
    setId,
    submissionId,
    user.id,
  ]);
  const total = units.reduce((sum, unit) => sum + unit.branches.length, 0);
  const answered = Object.keys(answers).filter((key) => answers[key]).length;
  const submit = useCallback(
    async (timedOut = false) => {
      if (busy) return;
      const unanswered = total - answered;
      if (
        !timedOut &&
        unanswered &&
        !window.confirm(
          `Submit with ${unanswered} unanswered branch${unanswered === 1 ? "" : "es"}?`
        )
      )
        return;
      setBusy(true);
      try {
        const submittedAnswers = Object.fromEntries(
          Object.entries(answers).filter(([, value]) => value !== "not_sure")
        );
        const data = await submitPastPaper(
          setId,
          submissionId || crypto.randomUUID(),
          submittedAnswers,
          {
            durationMinutes: duration,
            negativeMarking: negative,
            timedOut,
          }
        );
        const attemptId = data.attemptId;
        if (!attemptId)
          throw new Error("The server did not return an attempt reference.");
        await deleteAssessmentDraft(
          user.id,
          "past_paper",
          setId,
          progressKey
        ).catch(() => undefined);
        router.replace(
          `/history/review/?kind=past_paper&attemptId=${encodeURIComponent(attemptId)}`
        );
      } catch (caught) {
        toast.error(
          caught instanceof Error
            ? caught.message
            : "The paper could not be submitted."
        );
        setBusy(false);
      }
    },
    [
      answered,
      answers,
      busy,
      duration,
      negative,
      progressKey,
      router,
      setId,
      submissionId,
      total,
      user.id,
    ]
  );
  useEffect(() => {
    if (remaining === 0) void submit(true);
  }, [remaining, submit]);
  if (!setId || invalidSettings)
    return <PageError error={new Error("This past-paper link is invalid.")} />;
  if (query.isLoading) return <Skeleton className="h-[36rem]" />;
  if (query.error) return <PageError error={query.error} />;
  if (!units.length)
    return <Empty>This paper has no published questions.</Empty>;
  return (
    <section id="past-paper-session-view">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            Past paper
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {text(paper, "title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(paper, "year_label", "yearLabel")} /{" "}
            {text(paper, "topic_label", "topicLabel")}
          </p>
        </div>
        {remaining !== null && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 font-medium tabular-nums">
            <Clock3 className="size-4" />
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
        )}
      </header>
      <StatStrip
        className="mb-6"
        items={[
          ["Marks", total],
          ["Answered", answered],
          ["Remaining", total - answered],
        ]}
      />
      <nav
        className="mb-5 flex gap-2 overflow-x-auto pb-1"
        aria-label="Paper section navigator"
      >
        {units.map((unit, unitIndex) => {
          const sectionAnswered = unit.branches.filter(
            (branch) => answers[branch.id]
          ).length;
          return (
            <a
              key={unit.id}
              href={`#paper-section-${unitIndex + 1}`}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              Section {unitIndex + 1}
              <span className="text-muted-foreground">
                {sectionAnswered}/{unit.branches.length}
              </span>
            </a>
          );
        })}
      </nav>
      <div className="space-y-5">
        {units.map((unit, unitIndex) => (
          <article
            id={`paper-section-${unitIndex + 1}`}
            className="rounded-lg border bg-card p-5 sm:p-6"
            key={unit.id}
          >
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Section {unitIndex + 1}
            </p>
            <h2 className="mt-2 font-medium leading-6">{unit.stem}</h2>
            {unit.imageUrl && (
              <Image
                src={unit.imageUrl}
                alt="Exam reference"
                width={1200}
                height={700}
                className="mt-4 max-h-72 w-full rounded-lg object-contain"
              />
            )}
            <div className="mt-5 divide-y border-y">
              {unit.branches.map((branch) => (
                <div className="py-4" key={branch.id}>
                  <p className="text-sm leading-6">
                    <span className="mr-2 font-semibold">{branch.order}.</span>
                    {branch.prompt}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      ["true", "True"],
                      ["false", "False"],
                      ["not_sure", "Not sure"],
                    ].map(([value, label]) => {
                      const selected = answers[branch.id] === value;
                      return (
                        <button
                          className={`flex h-10 items-center justify-center gap-2 rounded-md border text-sm ${selected ? "border-primary bg-accent" : "hover:bg-muted"}`}
                          key={value}
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              [branch.id]: value,
                            }))
                          }
                        >
                          {selected && <Check className="size-4" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 mt-6 flex justify-end rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <Button size="lg" disabled={busy} onClick={() => void submit()}>
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Flag className="size-4" />
          )}
          Submit paper
        </Button>
      </div>
    </section>
  );
}

export function PastPaperReviewPage() {
  return <HistoryReviewPage forcedKind="past_paper" />;
}
