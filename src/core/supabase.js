const SUPABASE_URL = "https://frlujqujvpqwvtavofdq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybHVqcXVqdnBxd3Z0YXZvZmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ2MjgsImV4cCI6MjA4ODg0MDYyOH0.doxi3B9llGw9_z90A23AZDucStRSVvCaxWXXqeJKHXE";
const BITRAMED_THEME_STORAGE_KEY = "bitramed:theme-preference";
const BITRAMED_SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export function createSupabaseClient() {
  const url = String(SUPABASE_URL || "").trim();
  const key = String(SUPABASE_KEY || "").trim();

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Library did not load.");
  }

  return window.supabase.createClient(url, key);
}

export function normalizeThemePreference(value) {
  return value === "dark" ? "dark" : "light";
}

export function readSystemThemePreference() {
  try {
    if (window.matchMedia && window.matchMedia(BITRAMED_SYSTEM_THEME_QUERY).matches) {
      return "dark";
    }
  } catch (error) {
    console.error("System theme preference read failed:", error);
  }

  return "light";
}

export function hasStoredThemePreference() {
  try {
    const value = window.localStorage.getItem(BITRAMED_THEME_STORAGE_KEY);
    return value === "dark" || value === "light";
  } catch (error) {
    console.error("Theme preference availability check failed:", error);
    return false;
  }
}

export function readStoredThemePreference() {
  try {
    const storedValue = window.localStorage.getItem(BITRAMED_THEME_STORAGE_KEY);
    if (storedValue === "dark" || storedValue === "light") {
      return storedValue;
    }
  } catch (error) {
    console.error("Theme preference read failed:", error);
  }

  return readSystemThemePreference();
}

export function writeStoredThemePreference(mode) {
  const safeMode = normalizeThemePreference(mode);
  try {
    window.localStorage.setItem(BITRAMED_THEME_STORAGE_KEY, safeMode);
  } catch (error) {
    console.error("Theme preference write failed:", error);
  }
  return safeMode;
}

export function applyDocumentThemePreference(mode) {
  const safeMode = normalizeThemePreference(mode);
  document.documentElement.classList.toggle("dark-mode", safeMode === "dark");
  if (document.body) {
    document.body.classList.toggle("dark-mode", safeMode === "dark");
  }
  document.documentElement.style.colorScheme = safeMode;
  return safeMode;
}

export function bootstrapThemePreference() {
  const applyStoredMode = () => {
    applyDocumentThemePreference(readStoredThemePreference());
  };

  const syncSystemMode = () => {
    if (hasStoredThemePreference()) return;
    applyDocumentThemePreference(readSystemThemePreference());
  };

  if (document.body) {
    applyStoredMode();
  } else {
    document.addEventListener("DOMContentLoaded", applyStoredMode, { once: true });
  }

  try {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia(BITRAMED_SYSTEM_THEME_QUERY);
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncSystemMode);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(syncSystemMode);
      }
    }
  } catch (error) {
    console.error("System theme preference watch failed:", error);
  }
}

bootstrapThemePreference();
