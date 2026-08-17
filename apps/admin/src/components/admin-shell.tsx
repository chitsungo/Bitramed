"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

const nav = [
  ["/", "Overview", LayoutDashboard],
  ["/learners", "Learners", Users],
  ["/access", "Access", KeyRound],
  ["/analytics", "Analytics", BarChart3],
  ["/activity", "Activity", Activity],
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const pageTitle =
    nav.find(([href]) =>
      href === "/" ? path === href : path.startsWith(href)
    )?.[1] ?? "Admin";
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      {mobile && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-card transition-transform lg:translate-x-0",
          mobile && "translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              B
            </span>
            <span>
              Bitramed <span className="text-muted-foreground">Admin</span>
            </span>
          </Link>
          <Button
            className="lg:hidden"
            size="icon"
            variant="ghost"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Admin navigation">
          {nav.map(([href, label, Icon]) => {
            const current =
              href === "/" ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobile(false)}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  current && "bg-muted font-medium text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={async () => {
              queryClient.clear();
              await getSupabase().auth.signOut();
              window.location.assign("/");
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <Button
            className="lg:hidden"
            size="icon"
            variant="ghost"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu className="size-4" />
          </Button>
          <p className="text-sm font-semibold tracking-tight">{pageTitle}</p>
          <div className="ml-auto">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Toggle colour theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[1500px] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
