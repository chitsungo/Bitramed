"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  CircleUserRound,
  Clock3,
  FileText,
  History,
  Home,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Stethoscope,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSearch } from "@/lib/learner-api";
import { learnerKeys } from "@/lib/learner-query-keys";
import { clearLocalLearnerSession } from "@/lib/assessment-store";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLearnerSession } from "@/components/learner/learner-gate";

const navigation = [
  { href: "/home/", label: "Home", icon: Home },
  { href: "/learn/", label: "Learn", icon: BookOpen },
  { href: "/history/", label: "History", icon: History },
  { href: "/account/", label: "Account", icon: CircleUserRound },
] as const;

const learningPaths = [
  "/learn/",
  "/year/",
  "/modules/",
  "/subtopics/",
  "/types/",
  "/quizzes/",
  "/quiz/",
  "/past-papers/",
];
const RECENT_SEARCHES_KEY = "bitramed:recent-learning-searches";

function isActive(pathname: string, href: string) {
  if (href === "/learn/") {
    return learningPaths.some((path) => pathname.startsWith(path));
  }
  return pathname.startsWith(href);
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function formatExpiry(value: string | null) {
  if (!value) return null;
  const expires = Date.parse(value);
  if (!Number.isFinite(expires)) return null;
  const days = Math.ceil((expires - Date.now()) / 86_400_000);
  return { days, date: new Date(expires).toLocaleDateString() };
}

export function LearnerShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { user, access, preferences } = useLearnerSession();
  const displayName = String(
    user.user_metadata?.display_name || user.email?.split("@")[0] || "Learner"
  );
  const expiry = formatExpiry(access.accessExpiresAt);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setProfileOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!searchOpen) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`${RECENT_SEARCHES_KEY}:${user.id}`) || "[]"
      );
      setRecentSearches(
        Array.isArray(saved) ? saved.map(String).slice(0, 5) : []
      );
    } catch {
      setRecentSearches([]);
    }
    inputRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [searchOpen, user.id]);

  const search = useQuery({
    queryKey: learnerKeys.search(debouncedQuery),
    queryFn: ({ signal }) => fetchSearch(debouncedQuery, signal),
    enabled: searchOpen && debouncedQuery.trim().length >= 2,
    staleTime: 60_000,
  });
  const results = search.data || [];

  const pageTitle = useMemo(() => {
    if (pathname.startsWith("/history")) return "History";
    if (pathname.startsWith("/account")) return "Account";
    if (pathname.startsWith("/settings")) return "Settings";
    if (learningPaths.some((path) => pathname.startsWith(path))) return "Learn";
    return "Home";
  }, [pathname]);

  async function signOut() {
    await clearLocalLearnerSession(user.id).catch(() => undefined);
    await getSupabase().auth.signOut();
    window.location.assign("/");
  }

  function rememberSearch(value: string) {
    const term = value.trim();
    if (term.length < 2) return;
    const next = [
      term,
      ...recentSearches.filter(
        (item) => item.toLowerCase() !== term.toLowerCase()
      ),
    ].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem(
      `${RECENT_SEARCHES_KEY}:${user.id}`,
      JSON.stringify(next)
    );
  }

  function openResult(kind: "quiz" | "past_paper", id: string) {
    rememberSearch(query);
    setSearchOpen(false);
    if (kind === "past_paper") {
      router.push(
        `/past-papers/session/?setId=${encodeURIComponent(id)}&duration=${preferences.defaultDurationMinutes || ""}&negative=${preferences.defaultNegativeMarking ? "1" : "0"}`
      );
      return;
    }
    router.push(
      `/quiz/?quizId=${encodeURIComponent(id)}&mode=${preferences.defaultMode}&duration=${preferences.defaultDurationMinutes || ""}&negative=${preferences.defaultNegativeMarking ? "1" : "0"}`
    );
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link
          href="/home/"
          className="flex h-16 items-center gap-3 border-b px-5"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="size-5" />
          </span>
          <span className="font-semibold">Bitramed</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3" aria-label="Learner navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                isActive(pathname, href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <Link
            href="/settings/"
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-5" /> Settings
          </Link>
          <div className="mt-2 flex items-center gap-3 px-3 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link
              href="/home/"
              className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground lg:hidden"
              aria-label="Bitramed home"
            >
              <Stethoscope className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{pageTitle}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {online ? "Progress synced" : "Working offline"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-lg px-2 py-1 text-xs sm:flex",
                  online ? "text-success" : "bg-warning/10 text-warning"
                )}
              >
                {online ? (
                  <Wifi className="size-3.5" />
                ) : (
                  <WifiOff className="size-3.5" />
                )}
                {online ? "Online" : "Offline"}
              </span>
              <Button
                id="search-toggle-btn"
                size="icon"
                variant="ghost"
                aria-label="Search learning content"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Refresh learner data"
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: learnerKeys.all,
                  })
                }
              >
                <RefreshCw className="size-5" />
              </Button>
              <div className="relative hidden sm:block">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Open account menu"
                  onClick={() => setProfileOpen((value) => !value)}
                >
                  <CircleUserRound className="size-5" />
                </Button>
                {profileOpen && (
                  <div className="absolute right-0 top-11 w-64 rounded-lg border bg-popover p-2 shadow-lg">
                    <div className="border-b px-2 py-2">
                      <p className="truncate text-sm font-medium">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      href="/settings/"
                      className="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
                    >
                      <Settings className="size-4" /> Settings
                    </Link>
                    <button
                      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => void signOut()}
                    >
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
              <Button
                className="sm:hidden"
                size="icon"
                variant="ghost"
                aria-label="Open menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="size-5" />
              </Button>
            </div>
          </div>
        </header>

        {expiry && expiry.days >= 0 && expiry.days <= 7 && (
          <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
            Access expires{" "}
            {expiry.days === 0
              ? "today"
              : `in ${expiry.days} day${expiry.days === 1 ? "" : "s"}`}{" "}
            ({expiry.date}).
          </div>
        )}

        <main className="learner-content-safe mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <nav
        className="learner-bottom-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card px-2 pt-2 lg:hidden"
        aria-label="Primary learner navigation"
      >
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
              isActive(pathname, href)
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/45 sm:hidden">
          <button
            className="absolute inset-0"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="learner-bottom-safe absolute inset-x-0 bottom-0 rounded-t-lg bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <Link
              href="/settings/"
              className="mt-2 flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
            >
              <Settings className="size-5" /> Settings
            </Link>
            <button
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-destructive hover:bg-destructive/10"
              onClick={() => void signOut()}
            >
              <LogOut className="size-5" /> Sign out
            </button>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div
          id="search-overlay"
          className="fixed inset-0 z-[80] bg-background/95 p-4 pt-16 backdrop-blur sm:pt-24"
        >
          <button
            className="absolute inset-0"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Search learning content"
            className="relative mx-auto w-full max-w-2xl rounded-lg border bg-card shadow-xl"
          >
            <div className="flex items-center gap-2 border-b p-3">
              <Search className="size-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="global-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search quizzes and past papers"
                className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button
                id="search-close-btn"
                size="icon"
                variant="ghost"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div
              id="search-results"
              className="max-h-[65dvh] overflow-y-auto p-2"
            >
              {search.isLoading && (
                <p className="p-4 text-sm text-muted-foreground">
                  Searching...
                </p>
              )}
              {!query.trim() && recentSearches.length > 0 && (
                <div className="border-b p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Recent searches
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        className="min-h-11 rounded-lg border px-3 text-sm hover:bg-muted"
                        onClick={() => setQuery(term)}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {search.error && (
                <p role="alert" className="p-4 text-sm text-destructive">
                  Search is unavailable. Check your connection and try again.
                </p>
              )}
              {debouncedQuery.trim().length >= 2 &&
                !search.isLoading &&
                !search.error &&
                !results.length && (
                  <p className="p-4 text-sm text-muted-foreground">
                    No matching learning content.
                  </p>
                )}
              {debouncedQuery.trim().length < 2 && !recentSearches.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  Enter at least two characters to search learning content.
                </p>
              )}
              {results.map((result) => (
                <button
                  key={`${result.kind}:${result.id}`}
                  className="flex min-h-16 w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted"
                  onClick={() => openResult(result.kind, result.id)}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    {result.kind === "past_paper" ? (
                      <FileText className="size-5" />
                    ) : (
                      <BookOpen className="size-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {result.title}
                    </strong>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {[result.level, result.area, result.sub]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" /> {result.itemCount}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
