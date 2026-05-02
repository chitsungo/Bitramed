export async function loadUserThemePreference(supabase, userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_preferences")
    .select("theme")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.theme ?? null;
}

export async function saveUserThemePreference(supabase, userId, theme) {
  if (!userId) return;

  const { error } = await supabase
    .from("user_preferences")
    .upsert({
      user_id: userId,
      theme
    }, {
      onConflict: "user_id"
    });

  if (error) throw error;
}
