"use client";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminData } from "@/hooks/use-admin-data";
import { PageHeading } from "@/components/page-heading";
import { EmptyState, ErrorState, PageLoading } from "@/components/page-state";
import { ListToolbar } from "@/components/list-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/utils";
import { aggregateKpis, buildLearnerMetrics } from "@/lib/metrics";
export default function AnalyticsPage() {
  const query = useAdminData();
  const [search, setSearch] = useState("");
  const courses = useMemo(() => query.data?.courses || [], [query.data]);
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        message={query.error?.message || "No data was returned."}
        retry={() => void query.refetch()}
      />
    );
  const learners = buildLearnerMetrics(query.data);
  const kpis = aggregateKpis(learners, true);
  const paperAttempts = query.data.paperAttempts;
  const paperAverage = paperAttempts.length
    ? Math.round(
        paperAttempts.reduce((sum, item) => sum + item.percentage, 0) /
          paperAttempts.length
      )
    : 0;
  const rows = courses
    .filter((i) => i.area.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.total_attempts - a.total_attempts);
  const chartRows = [...courses]
    .sort((a, b) => b.average_percentage - a.average_percentage)
    .slice(0, 10);
  return (
    <>
      <PageHeading
        title="Analytics"
        description="Performance, course and engagement signals across normal quizzes and past papers."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          [
            "Active engagement",
            formatPercent(kpis.engagement),
            `${kpis.users} active learners`,
          ],
          [
            "Combined average",
            formatPercent(kpis.average),
            `${kpis.attempts} combined attempts`,
          ],
          [
            "Past-paper average",
            formatPercent(paperAverage),
            `${paperAttempts.length} paper attempts`,
          ],
        ].map(([label, value, note]) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Course performance</CardTitle>
            <p className="text-sm text-muted-foreground">
              Highest full-history normal-quiz averages by course area
            </p>
          </CardHeader>
          <CardContent>
            {chartRows.length ? (
              <>
                <div
                  className="space-y-4 sm:hidden"
                  role="list"
                  aria-label="Top course average scores"
                >
                  {chartRows.slice(0, 6).map((course, index) => {
                    const percentage = Math.max(
                      0,
                      Math.min(100, course.average_percentage)
                    );
                    return (
                      <div key={course.area} role="listitem">
                        <div className="mb-2 flex items-center gap-3">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {course.area}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {formatPercent(percentage)}
                          </span>
                        </div>
                        <div
                          className="ml-9 h-2 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-label={`${course.area} average score`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(percentage)}
                        >
                          <div
                            className="h-full rounded-full bg-primary transition-[width]"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="hidden h-80 sm:block"
                  role="img"
                  aria-label="Course average score bar chart"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartRows}
                      layout="vertical"
                      margin={{ left: 12, right: 12 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        axisLine={false}
                        tickLine={false}
                        fontSize={11}
                      />
                      <YAxis
                        type="category"
                        dataKey="area"
                        width={112}
                        axisLine={false}
                        tickLine={false}
                        fontSize={11}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatPercent(Number(value)),
                          "Average",
                        ]}
                        cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Bar
                        dataKey="average_percentage"
                        name="Average"
                        fill="var(--primary)"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <ListToolbar
            search={search}
            setSearch={setSearch}
            placeholder="Filter courses"
          />
          {rows.length ? (
            <div className="divide-y">
              {rows.map((course) => (
                <div
                  className="grid grid-cols-[1fr_auto] gap-3 p-4"
                  key={course.area}
                >
                  <div>
                    <p className="text-sm font-medium">{course.area}</p>
                    <p className="text-xs text-muted-foreground">
                      {course.total_attempts} attempts · {course.unique_users}{" "}
                      learners
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatPercent(course.average_percentage)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      best {formatPercent(course.best_user_average)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </Card>
      </div>
    </>
  );
}
