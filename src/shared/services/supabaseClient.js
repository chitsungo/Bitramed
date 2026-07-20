import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://frlujqujvpqwvtavofdq.supabase.co";
export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybHVqcXVqdnBxd3Z0YXZvZmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ2MjgsImV4cCI6MjA4ODg0MDYyOH0.doxi3B9llGw9_z90A23AZDucStRSVvCaxWXXqeJKHXE";

export function createBitramedSupabaseClient() {
  const testOrLegacyFactory = window.supabase?.createClient;
  if (typeof testOrLegacyFactory === "function") {
    return testOrLegacyFactory(SUPABASE_URL, SUPABASE_KEY);
  }

  return createClient(SUPABASE_URL, SUPABASE_KEY);
}
