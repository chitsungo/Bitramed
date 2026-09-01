"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PwaRegistration() {
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    let disposed = false;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (disposed) return;
        const announceUpdate = () => {
          window.dispatchEvent(new Event("bitramed:pwa-update"));
          toast("Bitramed update available", {
            description: "Reload to use the latest version.",
            action: {
              label: "Reload",
              onClick: () => window.location.reload(),
            },
            duration: Infinity,
          });
        };
        if (registration.waiting) announceUpdate();
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              announceUpdate();
            }
          });
        });
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);
  return null;
}
