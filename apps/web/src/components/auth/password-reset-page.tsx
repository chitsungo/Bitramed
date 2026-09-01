"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, LoaderCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { safeInternalPath } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordResetPage() {
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        active &&
        session?.user &&
        ["PASSWORD_RECOVERY", "SIGNED_IN"].includes(event)
      )
        setReady(true);
    });
    async function resolve() {
      const tokenHash = params.get("token_hash");
      if (tokenHash && params.get("type") === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (active && error) setInvalid(true);
        if (active && !error) setReady(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionData.session?.user) setReady(true);
      else window.setTimeout(() => active && setInvalid(true), 3000);
    }
    void resolve();
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [params]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password.length < 6)
      return setFeedback("Use a password with at least 6 characters.");
    if (password !== confirmation)
      return setFeedback("Passwords do not match.");
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      setFeedback(error.message);
      setBusy(false);
      return;
    }
    await getSupabase().auth.signOut();
    const target = new URL("/", window.location.origin);
    target.searchParams.set("mode", "login");
    target.searchParams.set("reset", "success");
    const next = safeInternalPath(params.get("next"));
    if (next) target.searchParams.set("next", next);
    window.location.replace(target.toString());
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-5">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <KeyRound className="size-7 text-primary" />
        <h1 id="resetPageTitle" className="mt-4 text-2xl font-semibold">
          {invalid ? "Reset link expired." : "Set your new password."}
        </h1>
        <p id="resetPageCopy" className="mt-2 text-sm text-muted-foreground">
          {invalid
            ? "Request a new password reset email and try again."
            : "Choose a new password for your Bitramed account."}
        </p>
        <div
          id="resetLoadingState"
          hidden={ready || invalid}
          className="mt-6 text-sm text-muted-foreground"
        >
          Validating recovery link...
        </div>
        <div id="resetInvalidState" hidden={!invalid} className="mt-6">
          <Link
            className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
            href="/?mode=reset-request"
          >
            Request another link
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Need help?{" "}
            <a href="mailto:bitramed91@gmail.com" className="underline">
              Contact support
            </a>
          </p>
        </div>
        <form
          id="passwordResetForm"
          hidden={!ready || invalid}
          className="mt-6 space-y-4"
          onSubmit={submit}
        >
          <Input
            id="reset-password"
            name="password"
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            required
          />
          <Input
            id="reset-password-confirm"
            name="confirmation"
            type="password"
            placeholder="Confirm password"
            autoComplete="new-password"
            required
          />
          {feedback && (
            <div
              id="password-reset-feedback"
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {feedback}
            </div>
          )}
          <Button id="passwordResetSubmit" className="w-full" disabled={busy}>
            <span id="passwordResetSubmitText">
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                "Update password"
              )}
            </span>
          </Button>
        </form>
      </section>
    </main>
  );
}
