"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  asRecord,
  asRows,
  fetchAccountPage,
  number,
  text,
} from "@/lib/learner-api";
import { learnerKeys } from "@/lib/learner-query-keys";
import { clearLocalLearnerSession } from "@/lib/assessment-store";
import { getSupabase } from "@/lib/supabase";
import { useLearnerSession } from "@/components/learner/learner-gate";
import {
  Empty,
  PageError,
  PageHeader,
  StatStrip,
} from "@/components/learner/page-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function accessLabel(status: string) {
  return (
    {
      active: "Active",
      expiring: "Expiring",
      owner: "Owner",
      expired: "Expired",
      blocked: "Blocked",
      no_access: "Not activated",
      signed_out: "Signed out",
    }[status] || "Unavailable"
  );
}

function formatDate(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString()
    : "Unavailable";
}

export function AccountPage() {
  const { user, access } = useLearnerSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState(
    String(user.user_metadata?.display_name || user.email?.split("@")[0] || "")
  );
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: learnerKeys.account(),
    queryFn: fetchAccountPage,
  });
  if (query.isLoading) return <Skeleton className="h-[36rem]" />;
  if (query.error || !query.data) return <PageError error={query.error} />;
  const data = query.data;
  const recent = asRows(data.recentAttempts ?? data.recent_attempts);
  const courses = asRows(data.courseStats ?? data.course_stats);
  const best = asRecord(data.bestAttempt ?? data.best_attempt);
  const sections = asRecord(data.sectionStats ?? data.section_stats);
  const normal = asRecord(sections.normal);
  const exam = asRecord(sections.exam);
  const expiresAt = access.accessExpiresAt
    ? Date.parse(access.accessExpiresAt)
    : NaN;
  const daysRemaining = Number.isFinite(expiresAt)
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000))
    : null;

  async function updateName() {
    const displayName = name.trim();
    if (displayName.length < 2) {
      toast.error("Enter at least two characters.");
      return;
    }
    setSaving(true);
    const { error } = await getSupabase().auth.updateUser({
      data: { ...user.user_metadata, display_name: displayName },
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated.");
      await queryClient.invalidateQueries({ queryKey: learnerKeys.all });
    }
  }

  async function signOut() {
    await clearLocalLearnerSession(user.id).catch(() => undefined);
    await getSupabase().auth.signOut();
    window.location.assign("/");
  }

  return (
    <section id="account-view">
      <PageHeader
        eyebrow="Learner account"
        title="Account"
        description="Manage your profile, access, and learning performance."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" />
              <h2 className="font-semibold">Profile</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-sm font-medium">
                Display name
                <Input
                  className="mt-1 h-11"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <Button disabled={saving} onClick={() => void updateName()}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}Save
                profile
              </Button>
            </div>
            <dl className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-1 break-all font-medium">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Verification</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-medium text-success">
                  <CheckCircle2 className="size-4" />
                  {user.email_confirmed_at ? "Verified" : "Pending"}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Award className="size-5 text-warning" />
              <h2 className="font-semibold">Learning summary</h2>
            </div>
            <StatStrip
              items={[
                ["Attempts", number(data, "attemptsCount", "attempts_count")],
                [
                  "Completed",
                  number(data, "quizzesDoneCount", "quizzes_done_count"),
                ],
                [
                  "Average",
                  `${number(data, "averagePercentage", "average_percentage")}%`,
                ],
                ["Best", `${number(best, "percentage")}%`],
              ]}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Quizzes
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {number(normal, "averagePercentage")}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {number(normal, "attemptsCount")} attempts
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Past papers
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {number(exam, "averagePercentage")}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {number(exam, "attemptsCount")} attempts
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-semibold">Course performance</h2>
            <div className="mt-3 divide-y rounded-lg border bg-card">
              {courses.map((row) => (
                <div className="p-4" key={text(row, "area")}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm font-medium">
                      {text(row, "area")}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {number(row, "averagePercentage", "average_percentage")}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, number(row, "averagePercentage", "average_percentage"))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {!courses.length && <Empty>No course performance yet.</Empty>}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recent attempts</h2>
              <Link
                href="/history/"
                className="text-sm font-medium text-primary hover:underline"
              >
                Full history
              </Link>
            </div>
            <div className="divide-y rounded-lg border bg-card">
              {recent.map((row, index) => {
                const kind =
                  text(row, "assessmentKind", "assessment_kind") ===
                  "past_paper"
                    ? "past_paper"
                    : "quiz";
                const id = text(row, "id", "attemptId", "attempt_id");
                return (
                  <Link
                    href={`/history/review/?kind=${kind}&attemptId=${encodeURIComponent(id)}`}
                    className="flex min-h-16 items-center gap-3 p-4 hover:bg-muted/60"
                    key={`${kind}:${id || index}`}
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">
                        {text(row, "quizTitle", "quiz_title", "title")}
                      </strong>
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {text(row, "area")} · {text(row, "mode")}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {number(row, "percentage")}%
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
              {!recent.length && <Empty>No attempts recorded yet.</Empty>}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <h2 className="font-semibold">Access status</h2>
              </div>
              <span
                className={cn(
                  "rounded-lg px-2 py-1 text-xs font-semibold",
                  access.status === "expiring"
                    ? "bg-warning/10 text-warning"
                    : access.hasAccess
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                )}
              >
                {accessLabel(access.status)}
              </span>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Starts</dt>
                <dd className="mt-1 font-medium">
                  {formatDate(access.accessStartsAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Expires</dt>
                <dd className="mt-1 font-medium">
                  {access.status === "owner"
                    ? "No expiry"
                    : formatDate(access.accessExpiresAt)}
                </dd>
              </div>
              {daysRemaining !== null && (
                <div>
                  <dt className="text-xs text-muted-foreground">Remaining</dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-medium">
                    <Clock3 className="size-4" />
                    {daysRemaining} days
                  </dd>
                </div>
              )}
              {access.blockReason && (
                <div>
                  <dt className="text-xs text-muted-foreground">Reason</dt>
                  <dd className="mt-1 text-destructive">
                    {access.blockReason}
                  </dd>
                </div>
              )}
            </dl>
          </section>
          <Link
            href="/settings/"
            className="flex min-h-12 items-center gap-3 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <Settings className="size-5" /> Settings{" "}
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
          <Link
            href="/settings/#security"
            className="flex min-h-12 items-center gap-3 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <LockKeyhole className="size-5" /> Password{" "}
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={() => void signOut()}
          >
            <LogOut className="size-5" /> Sign out
          </Button>
        </aside>
      </div>
    </section>
  );
}
