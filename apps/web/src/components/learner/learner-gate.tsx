"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import {
  fetchShellBootstrap,
  normalizeAccess,
  rpc,
  type AccessStatus,
} from "@/lib/learner-api";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type LearnerSession = { user: User; access: AccessStatus };
const LearnerSessionContext = createContext<LearnerSession | null>(null);

export function useLearnerSession() {
  const value = useContext(LearnerSessionContext);
  if (!value) throw new Error("Learner session is unavailable.");
  return value;
}

export function LearnerGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LearnerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { setTheme } = useTheme();

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const { data, error: authError } =
          await getSupabase().auth.getSession();
        const user = data.session?.user;
        if (authError || !user) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/?next=${encodeURIComponent(next)}`);
          return;
        }
        let bootstrap;
        try {
          bootstrap = await fetchShellBootstrap();
        } catch (bootstrapError) {
          const code = String(
            (bootstrapError as { code?: string })?.code || ""
          );
          if (code !== "PGRST202" && code !== "42883") throw bootstrapError;
          bootstrap = {
            access: normalizeAccess(await rpc("app_my_access_status")),
            themePreference: null,
          };
        }
        if (!active) return;
        if (bootstrap.themePreference) setTheme(bootstrap.themePreference);
        setSession({ user, access: bootstrap.access });
      } catch (caught) {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load Bitramed."
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, [setTheme]);

  if (loading) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-6xl content-start gap-4 p-5 pt-24">
        <Skeleton className="h-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Skeleton className="h-44" key={key} />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center p-5">
        <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-7 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Couldn&apos;t connect</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        </section>
      </main>
    );
  }

  if (!session) return null;
  if (!session.access.hasAccess) {
    const statusCopy = {
      blocked: [
        "Account blocked",
        session.access.blockReason || "Contact support to restore access.",
      ],
      expired: [
        "Access expired",
        "Renew your learner access to continue revising.",
      ],
      no_access: [
        "Activation required",
        "Your account is ready and waiting for learner access.",
      ],
      signed_out: ["Sign in required", "Sign in again to continue."],
      active: ["Access unavailable", "Refresh the page to try again."],
    }[session.access.status];
    return (
      <main id="access-view" className="grid min-h-dvh place-items-center p-5">
        <section className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase text-primary">
            Learner access
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{statusCopy[0]}</h1>
          <p className="mt-2 text-muted-foreground">{statusCopy[1]}</p>
          <div className="access-identity-pill mt-6 flex min-w-0 items-center justify-between gap-3 rounded-lg border p-4">
            <div className="access-identity-main min-w-0">
              <p className="truncate text-sm font-medium">
                {session.user.email}
              </p>
              <p className="text-xs text-muted-foreground">
                Authenticated learner
              </p>
            </div>
            <span className="access-identity-status shrink-0 text-xs font-medium capitalize">
              {session.access.status.replace("_", " ")}
            </span>
          </div>
          <Button
            className="mt-6"
            variant="outline"
            onClick={async () => {
              await getSupabase().auth.signOut();
              window.location.assign("/");
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </section>
      </main>
    );
  }

  return (
    <LearnerSessionContext.Provider value={session}>
      {children}
    </LearnerSessionContext.Provider>
  );
}
