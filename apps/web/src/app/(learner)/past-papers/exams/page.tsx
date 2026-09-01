import { Suspense } from "react";
import { PastPaperExamsPage } from "@/components/learner/past-paper-pages";
export default function Page() {
  return (
    <Suspense>
      <PastPaperExamsPage />
    </Suspense>
  );
}
