"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Home,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  User,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSearch, asRows, text } from "@/lib/learner-api";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLearnerSession } from "@/components/learner/learner-gate";

const nav = [
  ["/home/", "Home", Home],
  ["/account/", "Account", User],
  ["/settings/", "Settings", Settings],
] as const;

export function LearnerShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useLearnerSession();
  const displayName = String(
    user.user_metadata?.display_name || user.email?.split("@")[0] || "Learner"
  );
  const search = useQuery({
    queryKey: ["learner", "search", query.trim().toLowerCase()],
    queryFn: () => fetchSearch(query),
    enabled: searchOpen,
    staleTime: 60_000,
  });
  const results = useMemo(() => asRows(search.data?.results), [search.data]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/home/"
            className="flex min-w-0 items-center gap-2 font-semibold"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              B
            </span>
            <span className="truncate">Bitramed</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Button
              id="refresh-db-btn"
              size="icon"
              variant="ghost"
              aria-label="Refresh learner data"
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: ["learner"] })
              }
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              id="search-toggle-btn"
              size="icon"
              variant="ghost"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </Button>
            <Button
              id="menu-toggle-btn"
              size="icon"
              variant="ghost"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      {menuOpen && (
        <div
          id="topbar-menu"
          className="is-open fixed inset-0 z-50 flex justify-end"
        >
          <button
            id="menu-backdrop"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="menu-sheet-body relative flex h-dvh w-full max-w-sm flex-col bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="min-w-0">
                <p id="topbar-user-name" className="truncate font-semibold">
                  {displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <nav
              className="flex-1 space-y-1 py-4"
              aria-label="Learner navigation"
            >
              {nav.map(([href, label, Icon]) => (
                <Link
                  id={`menu-${label.toLowerCase()}-btn`}
                  key={href}
                  href={href}
                  className="flex h-11 items-center gap-3 rounded-md px-3 text-sm hover:bg-muted"
                >
                  <Icon className="size-4" /> {label}
                </Link>
              ))}
            </nav>
            <div className="space-y-2 border-t pt-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}{" "}
                Toggle theme
              </Button>
              <Button
                id="signout-btn"
                variant="ghost"
                className="w-full justify-start"
                onClick={async () => {
                  await getSupabase().auth.signOut();
                  window.location.assign("/");
                }}
              >
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div
          id="search-overlay"
          className="is-open fixed inset-0 z-50 grid content-start bg-background/95 p-4 pt-20 backdrop-blur sm:pt-28"
        >
          <button
            id="search-backdrop"
            aria-label="Close search"
            className="absolute inset-0"
            onClick={() => setSearchOpen(false)}
          />
          <section className="relative mx-auto w-full max-w-2xl rounded-lg border bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                id="global-search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search years, courses, and assessments"
              />
              <Button
                id="search-close-btn"
                size="icon"
                variant="ghost"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div
              id="search-results"
              className="mt-3 max-h-[60dvh] overflow-y-auto"
            >
              {search.isLoading && (
                <p className="p-3 text-sm text-muted-foreground">
                  Searching...
                </p>
              )}
              {!search.isLoading && !results.length && (
                <p className="p-3 text-sm text-muted-foreground">
                  No matching assessments.
                </p>
              )}
              {results.map((row) => {
                const quizId = text(row, "quizId", "quiz_id");
                return (
                  <button
                    key={quizId}
                    className="flex w-full items-center gap-3 rounded-md p-3 text-left hover:bg-muted"
                    onClick={() =>
                      router.push(
                        `/quiz/?quizId=${encodeURIComponent(quizId)}&mode=study&negative=0`
                      )
                    }
                  >
                    <BookOpen className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">
                        {text(row, "title", "quiz_title")}
                      </strong>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          text(row, "level"),
                          text(row, "area"),
                          text(row, "sub"),
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
