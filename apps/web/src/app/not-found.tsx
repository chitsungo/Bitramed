import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <section className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page may have moved during the Bitramed upgrade.
        </p>
        <Link
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          href="/home/"
        >
          <ArrowLeft className="size-4" />
          Return home
        </Link>
      </section>
    </main>
  );
}
