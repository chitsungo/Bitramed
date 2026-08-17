export async function fetchHomeBootstrap(supabase) {
  return supabase.rpc("app_home_bootstrap");
}

export async function fetchShellBootstrap(supabase) {
  return supabase.rpc("app_shell_bootstrap");
}
