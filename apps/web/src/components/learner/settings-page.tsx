"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  Moon,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearAssessmentDrafts,
  clearAssessmentHistory,
} from "@/lib/assessment-progress";
import { savePreferences } from "@/lib/learner-api";
import { learnerKeys } from "@/lib/learner-query-keys";
import { getSupabase } from "@/lib/supabase";
import type { LearnerPreferences } from "@/types/learner";
import { useLearnerSession } from "@/components/learner/learner-gate";
import { PageHeader } from "@/components/learner/page-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const durations = [0, 5, 10, 15, 20, 30, 45, 60];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "compact-control relative h-7 w-12 shrink-0 rounded-full border transition-colors",
        checked ? "border-primary bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "absolute top-1 grid size-5 place-items-center rounded-full bg-white text-primary shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
    </button>
  );
}

export function SettingsPage() {
  const { user, preferences: initial, updatePreferences } = useLearnerSession();
  const [preferences, setPreferences] = useState(initial);
  const [busy, setBusy] = useState<"drafts" | "history" | "password" | null>(
    null
  );
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null
  );
  const [standalone, setStandalone] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setWorkerReady(Boolean(navigator.serviceWorker?.controller));
    const markUpdate = () => setUpdateAvailable(true);
    window.addEventListener("bitramed:pwa-update", markUpdate);
    void navigator.serviceWorker
      ?.getRegistration()
      .then((registration) =>
        setUpdateAvailable(Boolean(registration?.waiting))
      );
    window.addEventListener("beforeinstallprompt", capture);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("bitramed:pwa-update", markUpdate);
    };
  }, []);

  async function change(patch: Partial<LearnerPreferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    updatePreferences(next);
    setTheme(next.theme);
    const app = document.querySelector<HTMLElement>(".learner-app");
    if (app) {
      app.dataset.textSize = next.textSize;
      app.dataset.reducedMotion = String(next.reducedMotion);
    }
    try {
      await savePreferences(user.id, next);
      toast.success("Settings saved.");
      await queryClient.invalidateQueries({ queryKey: learnerKeys.home() });
    } catch {
      toast.error(
        "The setting changed on this device but could not be synced."
      );
    }
  }

  async function sendPasswordReset() {
    if (!user.email) return;
    setBusy("password");
    const { error } = await getSupabase().auth.resetPasswordForEmail(
      user.email,
      {
        redirectTo: `${window.location.origin}/update-password/`,
      }
    );
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent.");
  }

  async function clearDraftData() {
    if (
      !window.confirm(
        "Clear every saved assessment draft? Submitted history will be kept."
      )
    )
      return;
    setBusy("drafts");
    try {
      await clearAssessmentDrafts(user.id);
      await queryClient.invalidateQueries({ queryKey: learnerKeys.all });
      toast.success("Saved drafts cleared.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Drafts could not be cleared."
      );
    } finally {
      setBusy(null);
    }
  }

  async function resetHistory() {
    if (
      !window.confirm(
        "Delete all attempts, answer reviews, performance summaries, and drafts? This cannot be undone."
      )
    )
      return;
    setBusy("history");
    try {
      await clearAssessmentHistory(user.id);
      queryClient.removeQueries({ queryKey: learnerKeys.all });
      toast.success("Learning history reset.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "History could not be reset."
      );
    } finally {
      setBusy(null);
    }
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setStandalone(true);
      setInstallPrompt(null);
    }
  }

  return (
    <section id="settings-view">
      <PageHeader
        eyebrow="Learner preferences"
        title="Settings"
        description="Control appearance, assessment defaults, security, and saved data."
      />
      <div className="max-w-3xl space-y-6">
        <section className="rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold">Appearance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Synced across your signed-in devices.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <div className="mt-2 grid grid-cols-3 rounded-lg border p-1">
                {(
                  [
                    { value: "system", label: "System", icon: Laptop },
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium",
                      preferences.theme === value
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => void change({ theme: value })}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Text size</p>
              <div className="mt-2 grid grid-cols-2 rounded-lg border p-1">
                {(["normal", "large"] as const).map((value) => (
                  <button
                    key={value}
                    className={cn(
                      "min-h-11 rounded-lg text-sm font-medium capitalize",
                      preferences.textSize === value
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => void change({ textSize: value })}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Reduce motion</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Minimize non-essential animation.
                </p>
              </div>
              <Toggle
                label="Reduce motion"
                checked={preferences.reducedMotion}
                onChange={(checked) => void change({ reducedMotion: checked })}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold">Assessment defaults</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Applied when starting a quiz; each assessment can override them.
            </p>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <p className="text-sm font-medium">Quiz mode</p>
              <div className="mt-2 grid grid-cols-2 rounded-lg border p-1">
                {(["study", "exam"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={cn(
                      "min-h-11 rounded-lg text-sm font-medium capitalize",
                      preferences.defaultMode === mode
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => void change({ defaultMode: mode })}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm font-medium">
              Timer
              <select
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm"
                value={preferences.defaultDurationMinutes || 0}
                onChange={(event) =>
                  void change({
                    defaultDurationMinutes: Number(event.target.value) || null,
                  })
                }
              >
                {durations.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration ? `${duration} minutes` : "No timer"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Negative marking</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Correct +1, incorrect -1, unanswered 0.
                </p>
              </div>
              <Toggle
                label="Default negative marking"
                checked={preferences.defaultNegativeMarking}
                onChange={(checked) =>
                  void change({ defaultNegativeMarking: checked })
                }
              />
            </div>
          </div>
        </section>

        <section id="security" className="rounded-lg border bg-card p-5">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Security</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                Password reset will be sent to {user.email}.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                disabled={busy === "password"}
                onClick={() => void sendPasswordReset()}
              >
                {busy === "password" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Send password reset
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Data and storage</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              className="flex min-h-20 items-center gap-3 rounded-lg border p-4 text-left hover:bg-muted"
              disabled={busy !== null}
              onClick={() => void clearDraftData()}
            >
              {busy === "drafts" ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Trash2 className="size-5 text-warning" />
              )}
              <span>
                <strong className="block text-sm">Clear saved drafts</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Keep submitted history
                </span>
              </span>
            </button>
            <button
              id="settings-reset-account-btn"
              className="flex min-h-20 items-center gap-3 rounded-lg border border-destructive/30 p-4 text-left text-destructive hover:bg-destructive/10"
              disabled={busy !== null}
              onClick={() => void resetHistory()}
            >
              {busy === "history" ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <RotateCcw className="size-5" />
              )}
              <span>
                <strong className="block text-sm">
                  Reset learning history
                </strong>
                <span className="mt-1 block text-xs opacity-80">
                  Delete attempts and drafts
                </span>
              </span>
            </button>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Bitramed app</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Installation
                  </dt>
                  <dd className="mt-1 font-medium">
                    {standalone
                      ? "Installed"
                      : installPrompt
                        ? "Available"
                        : "Browser managed"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Offline shell
                  </dt>
                  <dd className="mt-1 font-medium">
                    {workerReady ? "Ready" : "Preparing"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Version</dt>
                  <dd className="mt-1 font-medium">3.1.0</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Update</dt>
                  <dd className="mt-1 font-medium">
                    {updateAvailable ? "Available" : "Current"}
                  </dd>
                </div>
              </dl>
              {installPrompt && !standalone && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => void install()}
                >
                  <Download className="size-4" />
                  Install app
                </Button>
              )}
              {updateAvailable && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="size-4" />
                  Reload to update
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
