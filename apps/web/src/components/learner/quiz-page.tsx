"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  LoaderCircle,
  Save,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteAssessmentDraft,
  readLocalDraft,
  saveAssessmentDraft,
} from "@/lib/assessment-progress";
import {
  asRecord,
  checkQuizAnswer,
  fetchQuizSession,
  submitQuiz,
} from "@/lib/learner-api";
import { learnerKeys } from "@/lib/learner-query-keys";
import {
  parseBooleanParam,
  parseDurationParam,
  parseQuizMode,
} from "@/lib/learner-query";
import type { AnswerFeedback, QuizSession } from "@/types/learner";
import { useLearnerSession } from "@/components/learner/learner-gate";
import { Empty, PageError } from "@/components/learner/page-primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function restoredProgress(progress: Record<string, unknown> | null) {
  const data = asRecord(progress?.progress_data ?? progress?.progressData);
  const answers = asRecord(data.answers);
  return {
    answers: Object.fromEntries(
      Object.entries(answers).map(([key, value]) => [key, String(value || "")])
    ) as Record<string, string>,
    flags: Array.isArray(data.flags) ? data.flags.map(String) : [],
    currentIndex: Math.max(0, Number(data.currentIndex || 0)),
    submissionId: String(data.submissionId || ""),
  };
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function QuizPage() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, access } = useLearnerSession();
  const online = useOnlineStatus();
  const quizId = String(params.get("quizId") || "").trim();
  const modeParam = parseQuizMode(params.get("mode"));
  const durationParam = parseDurationParam(params.get("duration"));
  const negativeParam = parseBooleanParam(params.get("negative"));
  const mode = modeParam.value;
  const durationMinutes = durationParam.value;
  const negativeMarking = negativeParam.value;
  const invalidSettings =
    !modeParam.valid || !durationParam.valid || !negativeParam.valid;
  const progressKey = "current";
  const query = useQuery({
    queryKey: learnerKeys.quiz(quizId),
    queryFn: async () => {
      try {
        return await fetchQuizSession(quizId, progressKey);
      } catch (error) {
        const local = await readLocalDraft(
          user.id,
          "quiz",
          quizId,
          progressKey
        ).catch(() => undefined);
        if (local?.sessionPayload) {
          return local.sessionPayload as QuizSession;
        }
        throw error;
      }
    },
    enabled: Boolean(quizId && !invalidSettings),
  });
  const questions = useMemo(
    () => query.data?.questions || [],
    [query.data?.questions]
  );
  const descriptor = query.data?.descriptor;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback>>({});
  const [checking, setChecking] = useState("");
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">(
    "saved"
  );
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submissionId = useRef("");
  const initialized = useRef(false);

  useEffect(() => {
    if (!query.data || initialized.current) return;
    let active = true;
    async function restore() {
      const remote = restoredProgress(query.data?.progress || null);
      const local = await readLocalDraft(
        user.id,
        "quiz",
        quizId,
        progressKey
      ).catch(() => undefined);
      if (!active) return;
      const source = local || remote;
      setAnswers(source.answers || {});
      setFlags(source.flags || []);
      setIndex(
        Math.min(source.currentIndex || 0, Math.max(0, questions.length - 1))
      );
      submissionId.current = source.submissionId || crypto.randomUUID();
      const remoteExpiry = Date.parse(
        String(
          query.data?.progress?.timer_expires_at ??
            query.data?.progress?.timerExpiresAt ??
            ""
        )
      );
      const localExpiry = local?.timerExpiresAt
        ? Date.parse(local.timerExpiresAt)
        : NaN;
      const expiry = Number.isFinite(localExpiry)
        ? localExpiry
        : Number.isFinite(remoteExpiry)
          ? remoteExpiry
          : durationMinutes
            ? Date.now() + durationMinutes * 60_000
            : null;
      setExpiresAt(expiry);
      initialized.current = true;
    }
    void restore();
    return () => {
      active = false;
    };
  }, [durationMinutes, query.data, questions.length, quizId, user.id]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (!initialized.current || !descriptor || !submissionId.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void saveAssessmentDraft(user.id, "quiz", quizId, {
        progressKey,
        mode,
        durationMinutes,
        negativeMarking,
        context: descriptor,
        answers,
        flags,
        currentIndex: index,
        submissionId: submissionId.current,
        timerExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        sessionPayload: query.data,
      })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("offline"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    answers,
    descriptor,
    durationMinutes,
    expiresAt,
    flags,
    index,
    mode,
    negativeMarking,
    query.data,
    quizId,
    user.id,
  ]);

  async function selectAnswer(questionId: string, answer: string) {
    if (mode === "study" && feedback[questionId]) return;
    setAnswers((current) => ({ ...current, [questionId]: answer }));
    if (mode !== "study") return;
    if (!online) {
      toast.error("Reconnect to check this study answer.");
      return;
    }
    setChecking(questionId);
    try {
      const result = await checkQuizAnswer(quizId, questionId, answer);
      setFeedback((current) => ({ ...current, [questionId]: result }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Answer could not be checked."
      );
    } finally {
      setChecking("");
    }
  }

  const submit = useCallback(
    async (timedOut = false) => {
      if (submitting || !questions.length) return;
      const unanswered = questions.filter(
        (question) => !answers[question.id]
      ).length;
      if (
        !timedOut &&
        unanswered &&
        !window.confirm(
          `Submit with ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}?`
        )
      )
        return;
      if (!access.hasAccess) {
        toast.error(
          "Your access must be active before this assessment can be submitted."
        );
        return;
      }
      setSubmitting(true);
      try {
        const result = await submitQuiz(
          quizId,
          submissionId.current || crypto.randomUUID(),
          answers,
          { mode, durationMinutes, negativeMarking, timedOut }
        );
        await deleteAssessmentDraft(user.id, "quiz", quizId, progressKey).catch(
          () => undefined
        );
        await queryClient.invalidateQueries({ queryKey: learnerKeys.all });
        router.replace(
          `/history/review/?kind=quiz&attemptId=${encodeURIComponent(result.attemptId)}`
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "The result could not be submitted."
        );
        setSubmitting(false);
      }
    },
    [
      access.hasAccess,
      answers,
      durationMinutes,
      mode,
      negativeMarking,
      progressKey,
      queryClient,
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

  const answered = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions]
  );

  if (!quizId || invalidSettings)
    return <PageError error={new Error("This assessment link is invalid.")} />;
  if (query.isLoading) return <Skeleton className="h-[34rem]" />;
  if (query.error) return <PageError error={query.error} />;
  if (!descriptor || !questions.length)
    return <Empty>This assessment has no published questions.</Empty>;
  const question = questions[Math.min(index, questions.length - 1)];
  const currentFeedback = feedback[question.id];
  const flagged = flags.includes(question.id);
  return (
    <section id="quiz-view" className="mx-auto max-w-4xl">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">
            {mode} mode
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">
            {descriptor.title}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {[descriptor.level, descriptor.area, descriptor.sub]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
        {remaining !== null && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 font-medium tabular-nums",
              remaining <= 60 && "border-destructive/40 text-destructive"
            )}
          >
            <Clock3 className="size-4" />
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
        )}
      </header>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(answered / questions.length) * 100}%` }}
          />
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {saveState === "saving" ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : saveState === "offline" ? (
            <WifiOff className="size-3.5 text-warning" />
          ) : (
            <Save className="size-3.5 text-success" />
          )}
          {saveState === "saving"
            ? "Saving"
            : saveState === "offline"
              ? "Saved offline"
              : "Saved"}
        </span>
      </div>

      <article className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <Button
            size="sm"
            variant={flagged ? "secondary" : "ghost"}
            onClick={() =>
              setFlags((current) =>
                current.includes(question.id)
                  ? current.filter((id) => id !== question.id)
                  : [...current, question.id]
              )
            }
          >
            {flagged ? (
              <BookmarkCheck className="size-4" />
            ) : (
              <Bookmark className="size-4" />
            )}
            {flagged ? "Flagged" : "Flag"}
          </Button>
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
        <h2 className="mt-5 text-base font-medium leading-7 sm:text-lg">
          {question.questionText}
        </h2>
        <div className="mt-6 grid gap-3">
          {question.options.map((option) => {
            const selected = answers[question.id] === option.value;
            const correctOption =
              currentFeedback?.correctAnswer === option.value;
            const incorrectSelected =
              selected && currentFeedback && !currentFeedback.isCorrect;
            return (
              <button
                key={option.value}
                type="button"
                disabled={Boolean(currentFeedback) || checking === question.id}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-100",
                  selected && !currentFeedback && "border-primary bg-accent",
                  correctOption && "border-success bg-success/10",
                  incorrectSelected && "border-destructive bg-destructive/10"
                )}
                onClick={() => void selectAnswer(question.id, option.value)}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg border text-xs font-semibold",
                    selected &&
                      !currentFeedback &&
                      "border-primary bg-primary text-primary-foreground",
                    correctOption && "border-success bg-success text-white",
                    incorrectSelected &&
                      "border-destructive bg-destructive text-white"
                  )}
                >
                  {checking === question.id && selected ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : correctOption ? (
                    <CheckCircle2 className="size-4" />
                  ) : incorrectSelected ? (
                    <XCircle className="size-4" />
                  ) : selected ? (
                    <Check className="size-4" />
                  ) : option.value === "TRUE" ? (
                    "T"
                  ) : option.value === "FALSE" ? (
                    "F"
                  ) : (
                    option.value
                  )}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        {currentFeedback && (
          <div
            role="status"
            className={cn(
              "mt-5 rounded-lg border p-4",
              currentFeedback.isCorrect
                ? "border-success/30 bg-success/10"
                : "border-destructive/30 bg-destructive/10"
            )}
          >
            <p
              className={cn(
                "flex items-center gap-2 text-sm font-semibold",
                currentFeedback.isCorrect ? "text-success" : "text-destructive"
              )}
            >
              {currentFeedback.isCorrect ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <XCircle className="size-5" />
              )}
              {currentFeedback.isCorrect
                ? "Correct"
                : `Incorrect · Correct answer: ${currentFeedback.correctAnswer}`}
            </p>
            {currentFeedback.explanation && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {currentFeedback.explanation}
              </p>
            )}
          </div>
        )}
      </article>

      <div
        className="mt-5 flex flex-wrap gap-2"
        aria-label="Question navigator"
      >
        {questions.map((item, itemIndex) => {
          const itemFeedback = feedback[item.id];
          return (
            <button
              aria-label={`Question ${itemIndex + 1}${flags.includes(item.id) ? ", flagged" : ""}`}
              className={cn(
                "size-11 rounded-lg border text-xs font-medium",
                itemIndex === index && "border-primary ring-2 ring-primary/20",
                itemFeedback?.isCorrect && "bg-success/10 text-success",
                itemFeedback &&
                  !itemFeedback.isCorrect &&
                  "bg-destructive/10 text-destructive",
                !itemFeedback &&
                  answers[item.id] &&
                  "bg-accent text-accent-foreground"
              )}
              key={item.id}
              onClick={() => setIndex(itemIndex)}
            >
              {flags.includes(item.id) ? (
                <Flag className="mx-auto size-3" />
              ) : (
                itemIndex + 1
              )}
            </button>
          );
        })}
      </div>

      <footer className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 mt-6 flex items-center justify-between gap-3 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <ArrowLeft className="size-4" /> Previous
        </Button>
        {index < questions.length - 1 ? (
          <Button
            disabled={
              mode === "study" &&
              Boolean(answers[question.id]) &&
              !currentFeedback
            }
            onClick={() =>
              setIndex((value) => Math.min(questions.length - 1, value + 1))
            }
          >
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            disabled={
              submitting ||
              (mode === "study" &&
                Boolean(answers[question.id]) &&
                !currentFeedback)
            }
            onClick={() => void submit()}
          >
            {submitting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Flag className="size-4" />
            )}
            Submit
          </Button>
        )}
      </footer>
    </section>
  );
}
