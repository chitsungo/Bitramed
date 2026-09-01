"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { AssessmentResult } from "@/lib/assessment";
import {
  Empty,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";

type Snapshot = AssessmentResult & {
  quizId: string;
  title: string;
  mode: string;
  negativeMarking: boolean;
};

export function ResultsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null | undefined>(
    undefined
  );
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bitramed:quiz-result");
      setSnapshot(raw ? (JSON.parse(raw) as Snapshot) : null);
    } catch {
      setSnapshot(null);
    }
  }, []);
  if (snapshot === undefined) return null;
  if (!snapshot)
    return (
      <Empty>
        No recent result is available. Complete an assessment to see its review.
      </Empty>
    );
  return (
    <section id="results-view">
      <PageHeader
        eyebrow={`${snapshot.mode} result`}
        title={snapshot.title}
        description={
          snapshot.negativeMarking
            ? "Incorrect answers used negative marking."
            : "Incorrect answers did not reduce the score."
        }
      />
      <StatStrip
        className="mb-7"
        items={[
          ["Score", `${snapshot.score}/${snapshot.total}`],
          ["Correct", snapshot.correct],
          ["Percentage", `${snapshot.percentage}%`],
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-action px-4 text-sm font-medium text-action-foreground"
          href={`/quiz/?quizId=${encodeURIComponent(snapshot.quizId)}&mode=${snapshot.mode}`}
        >
          <RotateCcw className="size-4" /> Try again
        </Link>
        <Link
          className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          href="/home/"
        >
          Dashboard
        </Link>
      </div>
      <div className="mt-8 space-y-4">
        {snapshot.items.map((item, index) => (
          <article
            className={`rounded-lg border bg-card p-5 ${item.correct ? "border-success/30" : "border-destructive/30"}`}
            key={item.question.key}
          >
            <div className="flex items-start gap-3">
              {item.correct ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              )}
              <div>
                <p className="text-xs uppercase text-muted-foreground">
                  Question {index + 1}
                </p>
                <h2 className="mt-1 font-medium leading-6">
                  {item.question.text}
                </h2>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
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
                {item.question.explanation && (
                  <p className="mt-4 border-t pt-4 text-sm leading-6 text-muted-foreground">
                    {item.question.explanation}
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
