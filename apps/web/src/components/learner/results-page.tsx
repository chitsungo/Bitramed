"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HistoryReviewPage } from "@/components/learner/history-pages";

export function ResultsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const hasAttempt = Boolean(params.get("attemptId") && params.get("kind"));
  useEffect(() => {
    if (!hasAttempt) router.replace("/history/");
  }, [hasAttempt, router]);
  return hasAttempt ? <HistoryReviewPage /> : null;
}
