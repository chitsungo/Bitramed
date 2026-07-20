import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./legacy/core/favicon-boot.js";
import "./legacy/core/theme-boot.js";
import "./styles/app.css";
import { App } from "./App.jsx";

async function loadSupabaseTestStub() {
  if (import.meta.env.VITE_E2E !== "1" && window.__BITRAMED_E2E__ !== true) {
    return;
  }
  if (window.supabase?.createClient) return;

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Supabase test stub failed to load."));
    document.head.appendChild(script);
  });
}

await loadSupabaseTestStub();

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
