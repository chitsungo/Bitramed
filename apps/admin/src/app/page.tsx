"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CircleGauge,
  ClipboardCheck,
  UserRoundCheck,
} from "lucide-react";
import { useAdminData } from "@/hooks/use-admin-data";
import {
  aggregateKpis,
  buildActivity,
  buildLearnerMetrics,
} from "@/lib/metrics";
import { formatNumber, formatPercent, relativeDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { PageLoading, ErrorState, EmptyState } from "@/components/page-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OverviewPage() {
  const query = useAdminData();
  const [activeOnly, setActiveOnly] = useState(true);
  const [silentSearch, setSilentSearch] = useState("");
  const derived = useMemo(
    () =>
      query.data
        ? {
            learners: buildLearnerMetrics(query.data),
            activity: buildActivity(query.data),
          }
        : null,
    [query.data]
  );
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data || !derived)
    return (
      <ErrorState
        message={query.error?.message || "No data was returned."}
        retry={() => void query.refetch()}
      />
    );
  const kpis = aggregateKpis(derived.learners, activeOnly);
  const silent = derived.learners
    .filter(
      (item) =>
        item.status === "active" &&
        !item.combined_attempts &&
        `${item.display_name || ""} ${item.email || ""}`
          .toLowerCase()
          .includes(silentSearch.toLowerCase())
    )
    .sort(
      (a, b) =>
        +new Date(a.access_expires_at || 0) -
        +new Date(b.access_expires_at || 0)
    );
  const cards = [
    [
      activeOnly ? "Active learners" : "All learners",
      kpis.users,
      "Access in scope",
      UserRoundCheck,
    ],
    ["Combined attempts", kpis.attempts, "Quiz + past paper", ClipboardCheck],
    ["Combined average", `${kpis.average}%`, "Attempt weighted", CircleGauge],
    ["Engagement", `${kpis.engagement}%`, "Learners with activity", BarChart3],
  ] as const;
  return (
    <>
      <PageHeading
        title="Overview"
        description="A focused view of learner access, performance and recent engagement."
        actions={
          <div className="grid w-full grid-cols-2 rounded-lg border p-1 text-xs sm:w-auto">
            <button
              type="button"
              aria-pressed={activeOnly}
              className={`min-w-20 rounded-md px-3 py-1.5 text-center transition-colors ${activeOnly ? "bg-muted font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveOnly(true)}
            >
              Active
            </button>
            <button
              type="button"
              aria-pressed={!activeOnly}
              className={`min-w-20 rounded-md px-3 py-1.5 text-center transition-colors ${!activeOnly ? "bg-muted font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveOnly(false)}
            >
              All
            </button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note, Icon]) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className="size-4 text-primary" />
              </div>
              <p className="text-3xl font-semibold tracking-tight">
                {typeof value === "number" ? formatNumber(value) : value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Needs activity</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Active access with no recorded quiz or past-paper attempts.
              </p>
            </div>
            <Badge>{silent.length}</Badge>
          </CardHeader>
          <CardContent>
            <Input
              className="mb-2"
              value={silentSearch}
              onChange={(event) => setSilentSearch(event.target.value)}
              placeholder="Filter silent learners"
              aria-label="Filter silent learners"
            />
            {silent.length ? (
              <div className="divide-y">
                {silent.slice(0, 8).map((item) => (
                  <div
                    key={item.user_id}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                      {(item.display_name ||
                        item.email ||
                        "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.display_name || "Unnamed learner"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.email || "No email"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        window.location.assign(
                          `/JAK2V617F/access/?q=${encodeURIComponent(item.email || item.display_name || "")}`
                        )
                      }
                    >
                      Review <ArrowRight className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  silentSearch ? "No matching learners" : "Everyone is active"
                }
                description={
                  silentSearch
                    ? "Try a different search."
                    : "Every learner with active access has completed an attempt."
                }
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest quiz and past-paper submissions.
            </p>
          </CardHeader>
          <CardContent>
            {derived.activity.length ? (
              <div className="space-y-4">
                {derived.activity.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${item.percentage >= 70 ? "bg-emerald-500" : item.percentage >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.display_name || item.email || "Learner"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.title} · {relativeDate(item.completed_at)}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatPercent(item.percentage)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No recent attempts" />
            )}
            <Link
              href="/activity"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all activity <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
