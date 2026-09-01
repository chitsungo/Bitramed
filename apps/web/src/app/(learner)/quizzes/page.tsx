import { Suspense } from "react";
import { QuizzesPage } from "@/components/learner/browse-pages";
export default function Page() {
  return (
    <Suspense>
      <QuizzesPage />
    </Suspense>
  );
}
