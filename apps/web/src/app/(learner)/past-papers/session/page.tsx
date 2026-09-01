import { Suspense } from "react";
import { PastPaperSessionPage } from "@/components/learner/past-paper-pages";
export default function Page() {
  return (
    <Suspense>
      <PastPaperSessionPage />
    </Suspense>
  );
}
