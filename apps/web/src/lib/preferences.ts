import { getSupabase } from "@/lib/supabase";

export async function saveThemePreference(
  userId: string,
  theme: "light" | "dark"
) {
  const { error } = await getSupabase()
    .from("user_preferences")
    .upsert({ user_id: userId, theme }, { onConflict: "user_id" });
  if (error) throw error;
}
