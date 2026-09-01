"use client";
import { useMemo, useState } from "react";
import { useAdminData } from "@/hooks/use-admin-data";
import { buildActivity } from "@/lib/metrics";
import { formatPercent, relativeDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { EmptyState, ErrorState, PageLoading } from "@/components/page-state";
import { ListToolbar } from "@/components/list-toolbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export default function ActivityPage() {
  const query = useAdminData();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const activity = useMemo(
    () => (query.data ? buildActivity(query.data) : []),
    [query.data]
  );
  if (query.isLoading) return <PageLoading />;
  if (query.isError)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const rows = activity.filter(
    (i) =>
      `${i.display_name} ${i.email} ${i.title} ${i.area}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (kind === "all" || i.kind === kind)
  );
  return (
    <>
      <PageHeading
        title="Activity"
        description="A unified feed of normal-quiz and past-paper attempts."
      />
      <Card className="overflow-hidden">
        <ListToolbar
          search={search}
          setSearch={setSearch}
          placeholder="Search learner, assessment or course"
        >
          <select
            aria-label="Assessment type"
            className="h-9 rounded-lg border bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">All types</option>
            <option>Quiz</option>
            <option>Past paper</option>
          </select>
        </ListToolbar>
        {rows.length ? (
          <div className="divide-y">
            {rows.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 p-4 hover:bg-muted/25 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.display_name || item.email || "Learner"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relativeDate(item.completed_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.area} · {item.mode}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{item.kind}</Badge>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums">
                    {formatPercent(item.percentage)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </Card>
    </>
  );
}
