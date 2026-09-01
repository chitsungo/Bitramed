"use client";

import { useState } from "react";
import { Info, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLearnerSession } from "@/components/learner/learner-gate";
import { cn } from "@/lib/utils";

const durations = [0, 5, 10, 15, 20, 30, 45, 60];

export function AssessmentSettingsDialog({
  title,
  kind = "quiz",
  close,
  start,
}: {
  title: string;
  kind?: "quiz" | "past_paper";
  close: () => void;
  start: (mode: "study" | "exam", duration: number, negative: boolean) => void;
}) {
  const { preferences } = useLearnerSession();
  const [mode, setMode] = useState<"study" | "exam">(
    kind === "past_paper" ? "exam" : preferences.defaultMode
  );
  const [duration, setDuration] = useState(
    preferences.defaultDurationMinutes || 0
  );
  const [negative, setNegative] = useState(preferences.defaultNegativeMarking);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/50 p-4">
      <button
        aria-label="Close settings"
        className="absolute inset-0"
        onClick={close}
      />
      <section
        role="dialog"
        aria-modal
        className="dialog-panel relative w-full max-w-md rounded-lg border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              Assessment setup
            </p>
            <h2 className="dialog-title mt-1 text-xl font-semibold">{title}</h2>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Close"
            onClick={close}
          >
            <X className="size-4" />
          </Button>
        </div>
        {kind === "quiz" && (
          <div className="mt-6">
            <p className="text-sm font-medium">Mode</p>
            <div className="mt-2 grid grid-cols-2 rounded-lg border p-1">
              {(["study", "exam"] as const).map((value) => (
                <button
                  key={value}
                  className={cn(
                    "rounded-lg px-3 text-sm font-medium capitalize",
                    mode === value
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setMode(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {mode === "study"
                ? "Answers are checked immediately and explanations appear before you continue."
                : "Correct answers remain hidden until final submission."}
            </p>
          </div>
        )}
        <div className="mt-6">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Timer className="size-4" /> Timer
          </p>
          <div className="dialog-wheel-list mt-2 grid grid-cols-4 gap-2">
            {durations.map((value) => (
              <button
                type="button"
                data-value={value}
                className={`dialog-wheel-option rounded-md border px-2 py-2 text-xs ${duration === value ? "is-selected border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                key={value}
                onClick={() => setDuration(value)}
              >
                {value ? `${value} min` : "No time"}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-6 flex items-center justify-between gap-4 rounded-md border p-4">
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              Negative marking{" "}
              <span className="dialog-info-btn relative" tabIndex={0}>
                <Info className="size-3.5" />
                <span className="dialog-info-tooltip invisible absolute right-0 top-6 z-10 w-52 rounded-md bg-foreground p-2 text-xs text-background shadow-lg group-focus:visible">
                  Wrong answers lose 1 point. Unanswered questions score zero.
                </span>
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              Correct +1, wrong -1
            </span>
          </span>
          <input
            className="dialog-switch-input size-5 accent-primary"
            type="checkbox"
            checked={negative}
            onChange={(event) => setNegative(event.target.checked)}
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button className="dialog-btn" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            className="dialog-btn primary"
            onClick={() => start(mode, duration, negative)}
          >
            Start assessment
          </Button>
        </div>
      </section>
    </div>
  );
}
