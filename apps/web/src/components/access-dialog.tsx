"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mutateAccess, type AccessAction } from "@/lib/admin-api";
import { adminDataKey } from "@/hooks/use-admin-data";
import type { AccessRow, AdminData } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ActionType = "grant" | "extend" | "block" | "unblock";
const labels: Record<ActionType, string> = {
  grant: "Grant access",
  extend: "Extend access",
  block: "Block learner",
  unblock: "Unblock learner",
};

function optimisticRow(row: AccessRow, action: AccessAction): AccessRow {
  const now = new Date();
  if (action.type === "block") {
    return {
      ...row,
      status: "blocked",
      blocked_at: now.toISOString(),
      block_reason: action.reason,
    };
  }
  if (action.type === "unblock") {
    const active = new Date(row.access_expires_at || 0) > now;
    return {
      ...row,
      status: active ? "active" : "expired",
      blocked_at: null,
      block_reason: null,
      notes: action.notes || row.notes,
    };
  }
  const base =
    action.type === "extend" && new Date(row.access_expires_at || 0) > now
      ? new Date(row.access_expires_at as string)
      : now;
  const expires = new Date(
    base.getTime() + action.days * 86_400_000
  ).toISOString();
  return {
    ...row,
    status: "active",
    access_starts_at:
      action.type === "grant" ? now.toISOString() : row.access_starts_at,
    access_expires_at: expires,
    blocked_at: null,
    block_reason: null,
    notes: action.notes || row.notes,
  };
}

export function AccessDialog({
  row,
  type,
  close,
}: {
  row: AccessRow;
  type: ActionType;
  close: () => void;
}) {
  const [days, setDays] = useState(30);
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: mutateAccess,
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: adminDataKey });
      const before = queryClient.getQueryData<AdminData>(adminDataKey);
      queryClient.setQueryData<AdminData>(adminDataKey, (old) =>
        old
          ? {
              ...old,
              access: old.access.map((item) =>
                item.user_id === row.user_id
                  ? optimisticRow(item, action)
                  : item
              ),
            }
          : old
      );
      return { before };
    },
    onError: (error, _action, context) => {
      if (context?.before)
        queryClient.setQueryData(adminDataKey, context.before);
      toast.error("Access update failed", { description: error.message });
    },
    onSuccess: () => {
      toast.success(`${labels[type]} completed`);
      close();
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: adminDataKey }),
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if ((type === "grant" || type === "extend") && days < 1) return;
    if (type === "block" && !text.trim()) return;
    const action: AccessAction =
      type === "grant" || type === "extend"
        ? { type, userId: row.user_id, days, notes: text.trim() }
        : type === "block"
          ? { type, userId: row.user_id, reason: text.trim() }
          : { type, userId: row.user_id, notes: text.trim() };
    mutation.mutate(action);
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-dialog-title"
        className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl"
      >
        <h2 id="access-dialog-title" className="text-lg font-semibold">
          {labels[type]}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.display_name || row.email || "This learner"}
        </p>
        {(type === "grant" || type === "extend") && (
          <label className="mt-5 block text-sm font-medium">
            Days
            <Input
              className="mt-2"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              required
            />
          </label>
        )}
        <label className="mt-4 block text-sm font-medium">
          {type === "block" ? "Reason" : "Notes"}
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={text}
            onChange={(event) => setText(event.target.value)}
            required={type === "block"}
            placeholder={
              type === "block" ? "Required reason" : "Optional internal note"
            }
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={type === "block" ? "destructive" : "default"}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : labels[type]}
          </Button>
        </div>
      </form>
    </div>
  );
}
