"use client";
import { useEffect, useMemo, useState } from "react";
import { useAdminData } from "@/hooks/use-admin-data";
import { formatDate } from "@/lib/utils";
import type { AccessRow } from "@/types/admin";
import { PageHeading } from "@/components/page-heading";
import { EmptyState, ErrorState, PageLoading } from "@/components/page-state";
import { ListToolbar } from "@/components/list-toolbar";
import { StatusBadge } from "@/components/status-badge";
import { AccessDialog } from "@/components/access-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
type Dialog = {
  row: AccessRow;
  type: "grant" | "extend" | "block" | "unblock";
} | null;
export default function AccessPage() {
  const query = useAdminData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dialog, setDialog] = useState<Dialog>(null);
  useEffect(
    () => setSearch(new URLSearchParams(window.location.search).get("q") || ""),
    []
  );
  const rows = useMemo(
    () =>
      (query.data?.access || []).filter(
        (row) =>
          `${row.display_name || ""} ${row.email || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (status === "all" || row.status === status)
      ),
    [query.data, search, status]
  );
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
        title="Access control"
        description="Grant, extend and protect learner access with a clear audit trail."
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
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="no_access">New</option>
            <option value="blocked">Blocked</option>
          </select>
        </ListToolbar>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/35 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Learner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.user_id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {row.display_name || "Unnamed learner"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.email || "No email"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.access_expires_at)}
                    </td>
                    <td className="max-w-52 truncate px-4 py-3 text-muted-foreground">
                      {row.block_reason || row.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {row.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDialog({ row, type: "extend" })}
                          >
                            Extend
                          </Button>
                        )}
                        {(row.status === "expired" ||
                          row.status === "no_access") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDialog({ row, type: "grant" })}
                          >
                            Grant
                          </Button>
                        )}
                        {row.status === "blocked" ? (
                          <Button
                            size="sm"
                            onClick={() => setDialog({ row, type: "unblock" })}
                          >
                            Unblock
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDialog({ row, type: "block" })}
                          >
                            Block
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState />
        )}
      </Card>
      {dialog && (
        <AccessDialog
          row={dialog.row}
          type={dialog.type}
          close={() => setDialog(null)}
        />
      )}
    </>
  );
}
