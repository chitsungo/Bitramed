"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Flag,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  scoreAssessment,
  type AssessmentResult,
  type Question,
} from "@/lib/assessment";
import {
  deleteAssessmentDraft,
  saveAssessmentDraft,
} from "@/lib/assessment-progress";
import {
  asRecord,
  asRows,
  fetchQuizSession,
  text,
  type UnknownRow,
} from "@/lib/learner-api";
import { getSupabase } from "@/lib/supabase";
import { useLearnerSession } from "@/components/learner/learner-gate";
import { PageError } from "@/components/learner/page-primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ResultSnapshot = AssessmentResult & {
  quizId: string;
  title: string;
  mode: "study" | "exam";
  negativeMarking: boolean;
  completedAt: string;
};

function normalizeQuestions(value: unknown, type: "sba" | "tf"): Question[] {
  return asRows(value)
    .map((row, index) => ({
      key: text(row, "id", "question_id", "key") || String(index + 1),
      text: text(row, "question_text", "questionText", "prompt"),
      answer: text(row, "correct_answer", "correctAnswer", "answer"),
      explanation: text(row, "explanation"),
      imageUrl: text(row, "image_url", "imageUrl"),
      options:
        type === "tf"
          ? ["TRUE", "FALSE"]
          : ["A", "B", "C", "D", "E"].filter((letter) =>
              text(row, `option_${letter.toLowerCase()}`, `option${letter}`)
            ),
      type,
    }))
    .filter((question) => question.text);
}

function restoredAnswers(progress: UnknownRow) {
  const data = asRecord(progress.progress_data ?? progress.progressData);
  const answers = asRecord(data.answers ?? progress.answers);
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [key, String(value || "")])
  ) as Record<string, string>;
}

export function QuizPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useLearnerSession();
  const quizId = String(params.get("quizId") || "");
  const mode = params.get("mode") === "exam" ? "exam" : "study";
  const durationMinutes =
    Math.max(0, Number(params.get("duration") || 0)) || null;
  const negativeMarking = params.get("negative") === "1";
  const progressKey = "current";
  const query = useQuery({
    queryKey: ["learner", "quiz", quizId],
    queryFn: () => fetchQuizSession(quizId, progressKey),
    enabled: Boolean(quizId),
  });
  const descriptor = asRecord(query.data?.descriptor);
  const type =
    text(descriptor, "question_type", "questionType", "type") === "tf"
      ? "tf"
      : "sba";
  const questions = useMemo(
    () => normalizeQuestions(query.data?.questions, type),
    [query.data?.questions, type]
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const progress = asRecord(query.data.progress);
    setAnswers(restoredAnswers(progress));
    const savedExpiry = Date.parse(
      text(progress, "timer_expires_at", "timerExpiresAt")
    );
    const expiry = Number.isFinite(savedExpiry)
      ? savedExpiry
      : durationMinutes
        ? Date.now() + durationMinutes * 60_000
        : null;
    setExpiresAt(expiry);
  }, [query.data, durationMinutes]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (!query.data || !Object.keys(answers).length) return;
    const timer = window.setTimeout(() => {
      void saveAssessmentDraft(user.id, "quiz", quizId, {
        progressKey,
        mode,
        durationMinutes,
        negativeMarking,
        context: descriptor,
        answers,
        timerExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }).catch(() => toast.error("Draft could not be synced."));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    answers,
    descriptor,
    durationMinutes,
    expiresAt,
    mode,
    negativeMarking,
    query.data,
    quizId,
    user.id,
  ]);

  const submit = useCallback(
    async (timedOut = false) => {
      if (submitting || !questions.length) return;
      const unanswered = questions.filter(
        (question) => !answers[question.key]
      ).length;
      if (
        !timedOut &&
        unanswered &&
        !window.confirm(
          `Submit with ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}?`
        )
      )
        return;
      setSubmitting(true);
      try {
        const result = scoreAssessment(questions, answers, negativeMarking);
        const { error } = await getSupabase().from("quiz_attempts").insert({
          user_id: user.id,
          quiz_id: quizId,
          mode,
          score: result.score,
          total_questions: result.total,
          correct_count: result.correct,
          wrong_count: result.wrong,
          unanswered_count: result.unanswered,
          percentage: result.percentage,
        });
        if (error) throw error;
        await deleteAssessmentDraft(user.id, "quiz", quizId, progressKey).catch(
          () => undefined
        );
        const snapshot: ResultSnapshot = {
          ...result,
          quizId,
          title: text(descriptor, "quiz_title", "title") || "Assessment",
          mode,
          negativeMarking,
          completedAt: new Date().toISOString(),
        };
        sessionStorage.setItem(
          "bitramed:quiz-result",
          JSON.stringify(snapshot)
        );
        router.replace("/results/");
      } catch (caught) {
        toast.error(
          caught instanceof Error
            ? caught.message
            : "The result could not be saved."
        );
        setSubmitting(false);
      }
    },
    [
      answers,
      descriptor,
      mode,
      negativeMarking,
      progressKey,
      questions,
      quizId,
      router,
      submitting,
      user.id,
    ]
  );

  useEffect(() => {
    if (remaining === 0) void submit(true);
  }, [remaining, submit]);

  if (!quizId)
    return <PageError error={new Error("No assessment was selected.")} />;
  if (query.isLoading) return <Skeleton className="h-[34rem]" />;
  if (query.error) return <PageError error={query.error} />;
  if (!questions.length)
    return (
      <PageError
        error={new Error("This assessment has no published questions.")}
      />
    );
  const question = questions[Math.min(index, questions.length - 1)];
  const optionRows =
    question.type === "tf"
      ? question.options.map((value) => [value, value])
      : question.options.map((letter) => [
          letter,
          text(
            asRows(query.data?.questions)[index] || {},
            `option_${letter.toLowerCase()}`,
            `option${letter}`
          ),
        ]);
  const answered = Object.keys(answers).filter((key) => answers[key]).length;
  return (
    <section id="quiz-view" className="mx-auto max-w-4xl">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            {mode} mode
          </p>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
            {text(descriptor, "quiz_title", "title") || "Assessment"}
          </h1>
        </div>
        {remaining !== null && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 font-medium tabular-nums">
            <Clock3 className="size-4" />
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
        )}
      </header>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(answered / questions.length) * 100}%` }}
        />
      </div>
      <article className="rounded-lg border bg-card p-5 sm:p-7">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span>{answered} answered</span>
        </div>
        {question.imageUrl && (
          <Image
            src={question.imageUrl}
            alt="Question reference"
            width={1200}
            height={700}
            className="mt-5 max-h-72 w-full rounded-lg object-contain"
          />
        )}
        <h2 className="mt-5 text-lg font-medium leading-7 sm:text-xl">
          {question.text}
        </h2>
        <div className="mt-6 grid gap-3">
          {optionRows.map(([value, label]) => {
            const selected = answers[question.key] === value;
            return (
              <button
                className={`flex min-h-12 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${selected ? "border-primary bg-accent" : "hover:bg-muted"}`}
                key={value}
                type="button"
                onClick={() =>
                  setAnswers((current) => ({
                    ...current,
                    [question.key]: value,
                  }))
                }
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-md border text-xs font-semibold ${selected ? "border-primary bg-primary text-primary-foreground" : ""}`}
                >
                  {selected ? (
                    <Check className="size-4" />
                  ) : value === "TRUE" ? (
                    "T"
                  ) : value === "FALSE" ? (
                    "F"
                  ) : (
                    value
                  )}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </article>
      <footer className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <ArrowLeft className="size-4" /> Previous
        </Button>
        {index < questions.length - 1 ? (
          <Button
            onClick={() =>
              setIndex((value) => Math.min(questions.length - 1, value + 1))
            }
          >
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button disabled={submitting} onClick={() => void submit()}>
            {submitting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Flag className="size-4" />
            )}{" "}
            Submit
          </Button>
        )}
      </footer>
      <div
        className="mt-5 flex flex-wrap gap-2"
        aria-label="Question navigator"
      >
        {questions.map((item, itemIndex) => (
          <button
            aria-label={`Question ${itemIndex + 1}`}
            className={`size-8 rounded-md border text-xs font-medium ${itemIndex === index ? "border-primary bg-primary text-primary-foreground" : answers[item.key] ? "bg-accent text-accent-foreground" : "bg-card"}`}
            key={item.key}
            onClick={() => setIndex(itemIndex)}
          >
            {itemIndex + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
