do $$
declare
  v_user uuid;
begin
  select u.id into v_user from auth.users u where not public.is_admin_user(u.id) limit 1;
  if v_user is null then raise exception 'No non-admin fixture available'; end if;
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  begin
    perform public.admin_list_user_access();
    raise exception 'RPC unexpectedly allowed non-admin';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

do $$
declare
  v_owner uuid;
  v_count integer;
begin
  select user_id into v_owner from public.owner_accounts limit 1;
  if v_owner is null then raise exception 'No owner configured'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select count(*) into v_count from public.admin_list_user_access();
  select count(*) into v_count from public.admin_overview_stats();
  select count(*) into v_count from public.admin_user_summaries();
  select count(*) into v_count from public.admin_course_summaries();
  select count(*) into v_count from public.admin_recent_attempts();
  select count(*) into v_count from public.admin_past_paper_attempts();
end
$$;
