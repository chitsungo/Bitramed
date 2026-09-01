import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-7">
      <p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      )}
    </header>
  );
}

export function StatStrip({
  items,
  className = "",
}: {
  items: Array<[string, string | number]>;
  className?: string;
}) {
  return (
    <dl
      className={`grid grid-cols-3 divide-x rounded-lg border bg-card ${className}`}
    >
      {items.map(([label, value]) => (
        <div className="min-w-0 p-3 text-center sm:p-4" key={label}>
          <dd className="truncate text-xl font-semibold tabular-nums sm:text-2xl">
            {value}
          </dd>
          <dt className="mt-1 truncate text-[10px] uppercase text-muted-foreground sm:text-xs">
            {label}
          </dt>
        </div>
      ))}
    </dl>
  );
}

export function BrowseCard({
  href,
  title,
  meta,
  progress,
  badge,
  onClick,
  className = "",
}: {
  href?: string;
  title: string;
  meta?: string;
  progress?: number;
  badge?: string;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <Card
      className={`browse-card h-full transition-colors hover:border-primary/40 ${className}`}
    >
      <CardContent className="flex min-h-36 items-center gap-4 p-5">
        <div className="browse-card-content min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <BookOpen className="size-4" />
            {badge || "Revision"}
          </div>
          <h2 className="mt-3 text-lg font-semibold">{title}</h2>
          {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
          {progress !== undefined && (
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {progress}% complete
              </p>
            </div>
          )}
        </div>
        <ArrowRight className="browse-card-chevron size-5 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
  if (href)
    return (
      <Link className="browse-card-button block min-w-0" href={href}>
        {content}
      </Link>
    );
  return (
    <button
      className="browse-card-button block w-full min-w-0 text-left"
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export function Empty({
  children = "Nothing is available here yet.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      <CheckCircle2 className="mx-auto mb-3 size-5" />
      {children}
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive"
    >
      {error instanceof Error
        ? error.message
        : "This page could not be loaded."}
    </div>
  );
}
