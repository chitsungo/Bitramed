import { Suspense } from "react";
import { PastPaperReviewPage } from "@/components/learner/past-paper-pages";
export default function Page() {
  return (
    <Suspense>
      <PastPaperReviewPage />
    </Suspense>
  );
}
