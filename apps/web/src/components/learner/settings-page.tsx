"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { LoaderCircle, Moon, RotateCcw, Sun } from "lucide-react";
import { toast } from "sonner";
import { clearAssessmentHistory } from "@/lib/assessment-progress";
import { saveThemePreference } from "@/lib/preferences";
import { useLearnerSession } from "@/components/learner/learner-gate";
import { PageHeader } from "@/components/learner/page-primitives";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  const { user } = useLearnerSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [resetting, setResetting] = useState(false);
  const dark = resolvedTheme === "dark";
  async function changeTheme(next: "light" | "dark") {
    setTheme(next);
    try {
      await saveThemePreference(user.id, next);
    } catch {
      toast.error("Theme was changed locally but could not be synced.");
    }
  }
  async function reset() {
    if (
      !window.confirm(
        "Delete all saved assessment history and drafts? This cannot be undone."
      )
    )
      return;
    setResetting(true);
    try {
      await clearAssessmentHistory(user.id);
      toast.success("Assessment history reset.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Account history could not be reset."
      );
    } finally {
      setResetting(false);
    }
  }
  return (
    <section id="settings-view">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Control this device and your synced learner account."
      />
      <div className="max-w-2xl divide-y rounded-lg border bg-card">
        <section className="flex items-center justify-between gap-5 p-5">
          <div>
            <h2 className="font-medium">Appearance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use a light or dark interface across signed-in devices.
            </p>
          </div>
          <div className="flex rounded-lg border p-1">
            <button
              aria-label="Use light theme"
              className={`grid size-9 place-items-center rounded-md ${!dark ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => void changeTheme("light")}
            >
              <Sun className="size-4" />
            </button>
            <button
              aria-label="Use dark theme"
              className={`grid size-9 place-items-center rounded-md ${dark ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => void changeTheme("dark")}
            >
              <Moon className="size-4" />
            </button>
          </div>
        </section>
        <section className="p-5">
          <h2 className="font-medium">Account history</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Remove quiz attempts, past-paper attempts, performance summaries,
            and saved drafts while keeping your login.
          </p>
          <Button
            id="settings-reset-account-btn"
            className="mt-4"
            variant="destructive"
            disabled={resetting}
            onClick={() => void reset()}
          >
            {resetting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Reset account history
          </Button>
        </section>
        <section className="p-5">
          <h2 className="font-medium">Signed-in account</h2>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            {user.email}
          </p>
        </section>
      </div>
    </section>
  );
}
