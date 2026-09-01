import { Suspense } from "react";
import { TypesPage } from "@/components/learner/browse-pages";
export default function Page() {
  return (
    <Suspense>
      <TypesPage />
    </Suspense>
  );
}
