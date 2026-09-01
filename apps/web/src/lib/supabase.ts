import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const fallbackUrl = "https://frlujqujvpqwvtavofdq.supabase.co";
const fallbackAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybHVqcXVqdnBxd3Z0YXZvZmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ2MjgsImV4cCI6MjA4ODg0MDYyOH0.doxi3B9llGw9_z90A23AZDucStRSVvCaxWXXqeJKHXE";

let client: SupabaseClient<Database> | undefined;

type BrowserSupabaseFactory = {
  createClient: typeof createClient;
};

declare global {
  interface Window {
    supabase?: BrowserSupabaseFactory;
  }
}

export function getSupabase() {
  if (!client) {
    const factory =
      typeof window !== "undefined" && window.supabase?.createClient
        ? window.supabase.createClient
        : createClient;
    const options = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    };
    client =
      factory === createClient
        ? createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackAnonKey,
            options
          )
        : (factory(
            process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackAnonKey,
            options
          ) as unknown as SupabaseClient<Database>);
  }
  return client;
}
