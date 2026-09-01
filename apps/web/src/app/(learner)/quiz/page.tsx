import { Suspense } from "react";
import { QuizPage } from "@/components/learner/quiz-page";

export default function Page() {
  return (
    <Suspense>
      <QuizPage />
    </Suspense>
  );
}
