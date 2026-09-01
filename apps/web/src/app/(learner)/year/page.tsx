import { Suspense } from "react";
import { YearPage } from "@/components/learner/browse-pages";
export default function Page() {
  return (
    <Suspense>
      <YearPage />
    </Suspense>
  );
}
