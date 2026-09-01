"use client";

import { useEffect } from "react";

export function RedirectPage({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <main className="grid min-h-dvh place-items-center p-5 text-sm text-muted-foreground">
      <a className="underline" href={to}>
        Continue to Bitramed
      </a>
    </main>
  );
}
