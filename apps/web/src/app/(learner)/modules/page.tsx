import { Suspense } from "react";
import { ModulesPage } from "@/components/learner/browse-pages";
export default function Page() {
  return (
    <Suspense>
      <ModulesPage />
    </Suspense>
  );
}
