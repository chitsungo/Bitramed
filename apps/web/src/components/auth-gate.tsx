"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { isAdmin } from "@/lib/admin-api";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type GateState = "loading" | "allowed" | "denied" | "error";
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const { data, error } = await getSupabase().auth.getUser();
        if (error || !data.user) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/?next=${encodeURIComponent(next)}`);
          return;
        }
        const allowed = await isAdmin();
        if (active) setState(allowed ? "allowed" : "denied");
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to verify this session."
          );
          setState("error");
        }
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, []);

  if (state === "allowed") return children;
  if (state === "loading")
    return (
      <div className="mx-auto grid min-h-screen max-w-6xl gap-5 p-6">
        <Skeleton className="h-12" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm">
        <ShieldAlert
          className="mx-auto mb-4 size-8 text-destructive"
          aria-hidden
        />
        <h1 className="text-lg font-semibold">
          {state === "denied"
            ? "Owner access required"
            : "We couldn’t verify access"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state === "denied"
            ? "This area is restricted to approved Bitramed owners."
            : message}
        </p>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => window.location.assign("/")}
        >
          Return to Bitramed
        </Button>
      </section>
    </main>
  );
}
