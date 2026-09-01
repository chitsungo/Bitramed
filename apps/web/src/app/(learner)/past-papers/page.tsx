import { Suspense } from "react";
import { PastPapersPage } from "@/components/learner/past-paper-pages";
export default function Page() {
  return (
    <Suspense>
      <PastPapersPage />
    </Suspense>
  );
}
