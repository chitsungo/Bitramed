"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  LoaderCircle,
  X,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { safeInternalPath } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "signup" | "reset-request";

export function AuthPage() {
  const params = useSearchParams();
  const requestedMode = params.get("mode");
  const resetSuccess = params.get("reset") === "success";
  const [mode, setMode] = useState<Mode>(
    requestedMode === "signup" || requestedMode === "reset-request"
      ? requestedMode
      : "login"
  );
  const [open, setOpen] = useState(Boolean(requestedMode || resetSuccess));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(
    resetSuccess
      ? {
          message: "Password updated. Sign in with your new password.",
          type: "success",
        }
      : null
  );

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hash.get("type") || search.get("type");
    if (type === "recovery" || search.get("token_hash")) {
      const target = new URL("/update-password/", window.location.origin);
      const next = safeInternalPath(search.get("next"));
      if (next) target.searchParams.set("next", next);
      if (search.get("token_hash"))
        target.searchParams.set("token_hash", search.get("token_hash") || "");
      if (type) target.searchParams.set("type", type);
      target.hash = window.location.hash;
      window.location.replace(target.toString());
      return;
    }
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session?.user) return;
        window.location.replace(
          safeInternalPath(search.get("next")) || "/home/"
        );
      });
  }, []);

  function show(nextMode: Mode) {
    setMode(nextMode);
    setFeedback(null);
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const displayName = String(form.get("displayName") || "").trim();
    setFeedback(null);
    setBusy(true);
    try {
      if (mode === "reset-request") {
        const redirect = new URL("/update-password/", window.location.origin);
        const next = safeInternalPath(params.get("next"));
        if (next) redirect.searchParams.set("next", next);
        const { error } = await getSupabase().auth.resetPasswordForEmail(
          email,
          {
            redirectTo: redirect.toString(),
          }
        );
        if (error) throw error;
        setFeedback({
          message:
            "If an account exists for that email, we sent a password reset link.",
          type: "success",
        });
        return;
      }
      if (mode === "signup") {
        if (displayName.length < 2) throw new Error("Enter your full name.");
        if (password.length < 6)
          throw new Error("Use a password with at least 6 characters.");
        const { data, error } = await getSupabase().auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
        if (!data.session) {
          setFeedback({
            message:
              "Account created. Check your email to confirm, then sign in.",
            type: "success",
          });
          return;
        }
      } else {
        const { error } = await getSupabase().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      window.location.replace(safeInternalPath(params.get("next")) || "/home/");
    } catch (caught) {
      setFeedback({
        message:
          caught instanceof Error ? caught.message : "Authentication failed.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setFeedback(null);
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (caught) {
      setFeedback({
        message:
          caught instanceof Error ? caught.message : "Google sign in failed.",
        type: "error",
      });
      setBusy(false);
    }
  }

  const title =
    mode === "signup"
      ? "Join Bitramed."
      : mode === "reset-request"
        ? "Reset your password."
        : "Welcome back, doctor.";
  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <Image
        id="landing-background-image"
        src="https://frlujqujvpqwvtavofdq.supabase.co/storage/v1/object/public/Site%20Images/background.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-black/55" />
      <nav className="relative z-10 flex h-20 items-center justify-between px-5 sm:px-8">
        <button
          id="brand-close-btn"
          type="button"
          className="flex items-center gap-3 font-semibold"
          onClick={() => setOpen(false)}
        >
          <span className="grid size-8 place-items-center rounded-md bg-white font-bold text-black">
            B
          </span>{" "}
          Bitramed
        </button>
        <div className="flex items-center gap-2">
          <Button
            id="open-login-btn"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => show("login")}
          >
            Log in
          </Button>
          <Button
            id="open-signup-btn"
            className="bg-white text-black hover:bg-zinc-200"
            onClick={() => show("signup")}
          >
            Sign up
          </Button>
        </div>
      </nav>
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] max-w-5xl flex-col items-center justify-center px-5 pb-16 text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold uppercase text-rose-300 backdrop-blur">
          <HeartPulse className="size-4" /> Student portal
        </div>
        <h1 className="max-w-4xl text-5xl font-semibold leading-tight sm:text-7xl">
          High-Yield Medical Revision.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
          Targeted clinical scenarios, curriculum-aligned assessments, and timed
          performance tracking.
        </p>
        <Button
          id="hero-signup-btn"
          size="lg"
          className="mt-9 bg-white text-black hover:bg-zinc-200"
          onClick={() => show("signup")}
        >
          Start practicing <ArrowRight className="size-4" />
        </Button>
        <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm text-zinc-300">
          {["Core topics", "Years 1-3", "Timed modes"].map((item) => (
            <span
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2"
              key={item}
            >
              <CheckCircle2 className="size-4 text-emerald-300" />
              {item}
            </span>
          ))}
        </div>
        <p className="mt-9 text-sm text-zinc-400">
          Need help?{" "}
          <a
            href="mailto:bitramed91@gmail.com"
            className="text-emerald-300 underline"
          >
            Contact support
          </a>
        </p>
      </section>

      <div
        id="authModal"
        hidden={!open}
        className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      >
        <button
          id="modalBackdrop"
          type="button"
          aria-label="Close"
          className="absolute inset-0"
          onClick={() => setOpen(false)}
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
          className="relative mx-auto my-10 w-full max-w-md rounded-lg border border-white/10 bg-zinc-950 p-6 shadow-2xl sm:my-20"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-rose-300">
                Student portal
              </p>
              <h2 id="modalTitle" className="mt-2 text-2xl font-semibold">
                {title}
              </h2>
            </div>
            <Button
              id="close-auth-btn"
              size="icon"
              variant="ghost"
              className="text-zinc-300 hover:bg-white/10 hover:text-white"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <form id="signin-form" className="mt-6 space-y-4" onSubmit={submit}>
            {mode !== "reset-request" && (
              <Button
                id="google-signin-btn"
                type="button"
                variant="outline"
                className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                disabled={busy}
                onClick={() => void googleSignIn()}
              >
                <span id="googleSigninBtnText">Continue with Google</span>
              </Button>
            )}
            {mode === "signup" && (
              <div id="nameInputGroup">
                <label
                  htmlFor="signup-display-name"
                  className="mb-1.5 block text-xs text-zinc-400"
                >
                  Full name
                </label>
                <Input
                  id="signup-display-name"
                  name="displayName"
                  autoComplete="name"
                  className="border-white/10 bg-black/40"
                  required
                />
              </div>
            )}
            <div>
              <label
                htmlFor="signin-email"
                className="mb-1.5 block text-xs text-zinc-400"
              >
                Email address
              </label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                className="border-white/10 bg-black/40"
                required
              />
            </div>
            {mode !== "reset-request" && (
              <div id="passwordInputGroup">
                <label
                  htmlFor="signin-password"
                  className="mb-1.5 block text-xs text-zinc-400"
                >
                  Password
                </label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  className="border-white/10 bg-black/40"
                  required
                />
              </div>
            )}
            {mode === "login" && (
              <button
                id="forgotPasswordLink"
                type="button"
                className="text-sm text-zinc-400 underline"
                onClick={() => setMode("reset-request")}
              >
                Forgot password?
              </button>
            )}
            {feedback && (
              <div
                id="auth-feedback"
                role="status"
                className={`rounded-md border p-3 text-sm ${feedback.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}
              >
                {feedback.message}
              </div>
            )}
            <Button
              id="signin-submit-btn"
              className="w-full bg-white text-black hover:bg-zinc-200"
              disabled={busy}
            >
              <span id="submitBtnText">
                {busy ? (
                  <LoaderCircle className="mx-auto size-4 animate-spin" />
                ) : mode === "signup" ? (
                  "Create account"
                ) : mode === "reset-request" ? (
                  "Send reset link"
                ) : (
                  "Continue to dashboard"
                )}
              </span>
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-zinc-400">
            <span id="toggleTextPrompt">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}
            </span>{" "}
            <button
              id="toggleModeBtn"
              type="button"
              className="text-white underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
