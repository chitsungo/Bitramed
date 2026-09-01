import { Suspense } from "react";
import { SubtopicsPage } from "@/components/learner/browse-pages";
export default function Page() {
  return (
    <Suspense>
      <SubtopicsPage />
    </Suspense>
  );
}
