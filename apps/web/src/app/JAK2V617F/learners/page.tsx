"use client";
import { useMemo, useState } from "react";
import { useAdminData } from "@/hooks/use-admin-data";
import { buildLearnerMetrics } from "@/lib/metrics";
import { formatDate, formatPercent, relativeDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { EmptyState, ErrorState, PageLoading } from "@/components/page-state";
import { ListToolbar } from "@/components/list-toolbar";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LearnersPage() {
  const query = useAdminData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const learners = useMemo(
    () => (query.data ? buildLearnerMetrics(query.data) : []),
    [query.data]
  );
  const filtered = learners.filter((item) => {
    const haystack =
      `${item.display_name || ""} ${item.email || ""}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (status === "all" || item.status === status)
    );
  });
  const learner = learners.find((item) => item.user_id === selected);
  if (query.isLoading) return <PageLoading />;
  if (query.isError)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  return (
    <>
      <PageHeading
        title="Learners"
        description="Search learner performance across normal quizzes and past papers."
      />
      <Card className="overflow-hidden">
        <ListToolbar
          search={search}
          setSearch={setSearch}
          placeholder="Search name or email"
        >
          <select
            aria-label="Access status"
            className="h-9 rounded-lg border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All access</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="no_access">New</option>
            <option value="blocked">Blocked</option>
          </select>
        </ListToolbar>
        {filtered.length ? (
          <>
            <div className="divide-y md:hidden">
              {filtered.map((item) => (
                <article className="p-4" key={item.user_id}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">
                        {item.display_name || "Unnamed learner"}
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.email || "No email"}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/35 p-3">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Attempts
                      </dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums">
                        {item.combined_attempts}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Average
                      </dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums">
                        {formatPercent(item.combined_average)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Papers
                      </dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums">
                        {item.past_paper_attempts}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      Latest {relativeDate(item.latest_activity)}
                    </p>
                    <Button
                      className="shrink-0"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(item.user_id)}
                    >
                      View profile
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/35 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Learner</th>
                    <th className="px-4 py-3 font-medium">Access</th>
                    <th className="px-4 py-3 font-medium">Attempts</th>
                    <th className="px-4 py-3 font-medium">Average</th>
                    <th className="px-4 py-3 font-medium">Latest</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item) => (
                    <tr key={item.user_id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {item.display_name || "Unnamed learner"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.email || "No email"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {item.combined_attempts}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({item.past_paper_attempts} papers)
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatPercent(item.combined_average)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {relativeDate(item.latest_activity)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(item.user_id)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </Card>
      {learner && (
        <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close learner profile"
            onClick={() => setSelected(null)}
          />
          <aside
            role="dialog"
            aria-modal
            aria-label="Learner details"
            className="relative h-dvh w-screen min-w-0 overflow-y-auto bg-background p-4 shadow-2xl sm:w-full sm:max-w-lg sm:border-l sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Learner profile
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {learner.display_name || "Unnamed learner"}
                </h2>
                <p className="text-sm text-muted-foreground">{learner.email}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Combined attempts", learner.combined_attempts],
                ["Combined average", formatPercent(learner.combined_average)],
                ["Best score", formatPercent(learner.best_percentage)],
                ["Assessments", learner.combined_assessments],
              ].map(([label, value]) => (
                <div className="rounded-lg border p-4" key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <dl className="mt-6 divide-y rounded-xl border px-4 text-sm">
              {[
                ["Access status", learner.status],
                ["Access expires", formatDate(learner.access_expires_at)],
                ["Latest activity", formatDate(learner.latest_activity, true)],
                ["Strongest area", learner.strongest_area || "—"],
                ["Needs focus", learner.weakest_area || "—"],
              ].map(([term, value]) => (
                <div className="flex justify-between gap-6 py-3" key={term}>
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </>
  );
}
