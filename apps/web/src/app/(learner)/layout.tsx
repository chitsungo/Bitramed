import type { ReactNode } from "react";
import { LearnerGate } from "@/components/learner/learner-gate";
import { LearnerShell } from "@/components/learner/learner-shell";

export default function LearnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="learner-app min-h-dvh">
      <LearnerGate>
        <LearnerShell>{children}</LearnerShell>
      </LearnerGate>
    </div>
  );
}
