import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://frlujqujvpqwvtavofdq.supabase.co";
const fallbackAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybHVqcXVqdnBxd3Z0YXZvZmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ2MjgsImV4cCI6MjA4ODg0MDYyOH0.doxi3B9llGw9_z90A23AZDucStRSVvCaxWXXqeJKHXE";

let client: ReturnType<typeof createClient> | undefined;

export function getSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return client;
}
