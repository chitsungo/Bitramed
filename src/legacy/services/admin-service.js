export async function loadAdminDashboardData(supabase) {
  const [overviewRes, usersRes, coursesRes, recentRes, accessRes] = await Promise.all([
    supabase.rpc("admin_overview_stats"),
    supabase.rpc("admin_user_summaries"),
    supabase.rpc("admin_course_summaries"),
    supabase.rpc("admin_recent_attempts"),
    supabase.rpc("admin_list_user_access")
  ]);

  if (overviewRes.error) throw overviewRes.error;
  if (usersRes.error) throw usersRes.error;
  if (coursesRes.error) throw coursesRes.error;
  if (recentRes.error) throw recentRes.error;
  if (accessRes.error) throw accessRes.error;

  return {
    overview: Array.isArray(overviewRes.data) ? overviewRes.data[0] || {} : (overviewRes.data || {}),
    users: usersRes.data || [],
    courses: coursesRes.data || [],
    recent: recentRes.data || [],
    accessRows: accessRes.data || []
  };
}

export async function grantUserAccess(supabase, userId, days, notes) {
  return supabase.rpc("admin_set_user_access", {
    p_user_id: userId,
    p_days: days,
    p_notes: notes
  });
}

export async function extendUserAccess(supabase, userId, days, notes) {
  return supabase.rpc("admin_extend_user_access", {
    p_user_id: userId,
    p_days: days,
    p_notes: notes
  });
}

export async function blockUserAccess(supabase, userId, reason) {
  return supabase.rpc("admin_block_user_access", {
    p_user_id: userId,
    p_reason: reason
  });
}

export async function unblockUserAccess(supabase, userId, notes) {
  return supabase.rpc("admin_unblock_user_access", {
    p_user_id: userId,
    p_notes: notes
  });
}
