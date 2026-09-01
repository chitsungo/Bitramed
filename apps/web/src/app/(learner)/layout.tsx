import type { ReactNode } from "react";
import { LearnerGate } from "@/components/learner/learner-gate";
import { LearnerShell } from "@/components/learner/learner-shell";

export default function LearnerLayout({ children }: { children: ReactNode }) {
  return (
    <LearnerGate>
      <LearnerShell>{children}</LearnerShell>
    </LearnerGate>
  );
}
