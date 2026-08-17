begin;

create or replace function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (select 1 from public.owner_accounts where user_id = coalesce(p_user_id, auth.uid()))
    or exists (
      select 1
      from auth.users u
      join public.admin_allowlist a on lower(a.email) = lower(coalesce(u.email, ''))
      where u.id = coalesce(p_user_id, auth.uid())
    );
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$ select auth.uid() is not null and public.is_admin_user(auth.uid()); $$;

create or replace function public.require_current_user_admin()
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_list_user_access()
returns table(user_id uuid, email text, display_name text, access_starts_at timestamptz, access_expires_at timestamptz, blocked_at timestamptz, block_reason text, notes text, status text, granted_by uuid, updated_at timestamptz)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  perform public.require_current_user_admin();
  return query
  select u.id, u.email::text,
    coalesce(nullif(u.raw_user_meta_data ->> 'display_name',''), nullif(u.raw_user_meta_data ->> 'full_name',''), u.email::text),
    aa.access_starts_at, aa.access_expires_at, aa.blocked_at, aa.block_reason, aa.notes,
    case when aa.user_id is null then 'no_access' when aa.blocked_at is not null then 'blocked' when aa.access_expires_at <= now() then 'expired' else 'active' end,
    aa.granted_by, aa.updated_at
  from auth.users u left join public.account_access aa on aa.user_id=u.id
  where not public.is_admin_user(u.id)
  order by case when aa.user_id is null then 3 when aa.blocked_at is not null then 4 when aa.access_expires_at <= now() then 2 else 1 end,
    coalesce(aa.updated_at,u.created_at) desc, u.email;
end;
$$;

create or replace function public.admin_overview_stats()
returns table(total_users bigint, active_users bigint, total_attempts bigint, total_quizzes_done bigint, average_percentage numeric)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  perform public.require_current_user_admin();
  return query select
    (select count(*) from auth.users u where not public.is_admin_user(u.id)),
    (select count(distinct qa.user_id) from public.quiz_attempts qa where not public.is_admin_user(qa.user_id)),
    (select count(*) from public.quiz_attempts qa where not public.is_admin_user(qa.user_id)),
    (select count(distinct concat(qa.quiz_id::text,':',qa.user_id::text)) from public.quiz_attempts qa where not public.is_admin_user(qa.user_id)),
    coalesce((select round(avg(qa.percentage)::numeric,1) from public.quiz_attempts qa where not public.is_admin_user(qa.user_id)),0);
end;
$$;

create or replace function public.admin_user_summaries()
returns table(user_id uuid, email text, display_name text, total_attempts bigint, quizzes_done bigint, average_percentage numeric, best_percentage integer, latest_activity timestamptz, strongest_area text, weakest_area text)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  perform public.require_current_user_admin();
  return query
  with base as (
    select au.id, au.email::text, coalesce(nullif(au.raw_user_meta_data->>'display_name',''),nullif(au.raw_user_meta_data->>'full_name',''),split_part(coalesce(au.email,''),'@',1)) name
    from auth.users au where not public.is_admin_user(au.id)
  ), attempts as (
    select qa.user_id,count(*) total,count(distinct qa.quiz_id) quizzes,round(avg(qa.percentage)::numeric,1) avg_pct,max(qa.percentage) best,max(qa.completed_at) latest
    from public.quiz_attempts qa where not public.is_admin_user(qa.user_id) group by qa.user_id
  ), area_avg as (
    select qa.user_id,m.name area,avg(qa.percentage)::numeric avg_pct from public.quiz_attempts qa
    join public.quizzes q on q.id=qa.quiz_id join public.subtopics s on s.id=q.subtopic_id join public.modules m on m.id=s.module_id
    where not public.is_admin_user(qa.user_id) group by qa.user_id,m.name
  ), strongest as (select distinct on (user_id) user_id,area from area_avg order by user_id,avg_pct desc,area),
  weakest as (select distinct on (user_id) user_id,area from area_avg order by user_id,avg_pct,area)
  select b.id,b.email,b.name,coalesce(a.total,0),coalesce(a.quizzes,0),coalesce(a.avg_pct,0),coalesce(a.best,0),a.latest,coalesce(s.area,'No data'),coalesce(w.area,'No data')
  from base b left join attempts a on a.user_id=b.id left join strongest s on s.user_id=b.id left join weakest w on w.user_id=b.id
  order by a.latest desc nulls last,b.email;
end;
$$;

create or replace function public.admin_course_summaries()
returns table(area text,total_attempts bigint,unique_users bigint,average_percentage numeric,best_user_average numeric)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  perform public.require_current_user_admin();
  return query
  with ca as (
    select m.name area,qa.user_id,qa.percentage from public.quiz_attempts qa join public.quizzes q on q.id=qa.quiz_id join public.subtopics s on s.id=q.subtopic_id join public.modules m on m.id=s.module_id
    where not public.is_admin_user(qa.user_id)
  ), ua as (select ca.area,ca.user_id,avg(ca.percentage)::numeric user_average from ca group by ca.area,ca.user_id)
  select ca.area,count(*),count(distinct ca.user_id),round(avg(ca.percentage)::numeric,1),round(max(ua.user_average),1)
  from ca join ua on ua.area=ca.area and ua.user_id=ca.user_id group by ca.area order by 4 desc,ca.area;
end;
$$;

create or replace function public.admin_recent_attempts()
returns table(user_id uuid,email text,display_name text,area text,quiz_title text,mode text,score integer,total_questions integer,percentage integer,completed_at timestamptz)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  perform public.require_current_user_admin();
  return query select qa.user_id,au.email::text,
    coalesce(nullif(au.raw_user_meta_data->>'display_name',''),nullif(au.raw_user_meta_data->>'full_name',''),split_part(coalesce(au.email,''),'@',1)),
    m.name,q.title,qa.mode,qa.score,qa.total_questions,qa.percentage,qa.completed_at
  from public.quiz_attempts qa join auth.users au on au.id=qa.user_id join public.quizzes q on q.id=qa.quiz_id join public.subtopics s on s.id=q.subtopic_id join public.modules m on m.id=s.module_id
  where not public.is_admin_user(qa.user_id) order by qa.completed_at desc limit 25;
end;
$$;

create or replace function public.admin_past_paper_attempts()
returns table(attempt_id bigint,user_id uuid,set_id uuid,quiz_title text,area text,level text,mode text,assessment_kind text,score integer,total_questions integer,correct_count integer,wrong_count integer,unanswered_count integer,percentage integer,duration_minutes integer,negative_marking boolean,timed_out boolean,completed_at timestamptz)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  perform public.require_current_user_admin();
  return query select pa.id,pa.user_id,pa.set_id,ps.title,ps.topic_label,ps.year_label,'exam'::text,'past_paper'::text,pa.score,pa.total_marks,pa.correct_count,pa.wrong_count,pa.unanswered_count,pa.percentage,pa.duration_minutes,pa.negative_marking,pa.timed_out,pa.completed_at
  from public.past_paper_attempts pa join public.past_paper_sets ps on ps.id=pa.set_id
  where not public.is_admin_user(pa.user_id) order by pa.completed_at desc,pa.id desc;
end;
$$;

create or replace function public.admin_set_user_access(p_user_id uuid,p_days integer default 30,p_notes text default null)
returns public.account_access language plpgsql security definer set search_path='public'
as $$ declare v_row public.account_access; begin
  perform public.require_current_user_admin();
  if p_user_id is null then raise exception 'User id is required.'; end if;
  if public.is_admin_user(p_user_id) then raise exception 'Administrative accounts are protected.' using errcode='42501'; end if;
  if p_days <= 0 then raise exception 'Days must be greater than zero.'; end if;
  insert into public.account_access(user_id,access_starts_at,access_expires_at,blocked_at,block_reason,notes,granted_by)
  values(p_user_id,now(),now()+make_interval(days=>p_days),null,null,p_notes,auth.uid())
  on conflict(user_id) do update set access_starts_at=now(),access_expires_at=now()+make_interval(days=>p_days),blocked_at=null,block_reason=null,notes=excluded.notes,granted_by=auth.uid()
  returning * into v_row; return v_row;
end $$;

create or replace function public.admin_extend_user_access(p_user_id uuid,p_days integer default 30,p_notes text default null)
returns public.account_access language plpgsql security definer set search_path='public'
as $$ declare v_row public.account_access; begin
  perform public.require_current_user_admin();
  if p_user_id is null then raise exception 'User id is required.'; end if;
  if public.is_admin_user(p_user_id) then raise exception 'Administrative accounts are protected.' using errcode='42501'; end if;
  if p_days <= 0 then raise exception 'Days must be greater than zero.'; end if;
  insert into public.account_access(user_id,access_starts_at,access_expires_at,blocked_at,block_reason,notes,granted_by)
  values(p_user_id,now(),now()+make_interval(days=>p_days),null,null,p_notes,auth.uid())
  on conflict(user_id) do update set access_expires_at=greatest(public.account_access.access_expires_at,now())+make_interval(days=>p_days),blocked_at=null,block_reason=null,notes=coalesce(excluded.notes,public.account_access.notes),granted_by=auth.uid()
  returning * into v_row; return v_row;
end $$;

create or replace function public.admin_block_user_access(p_user_id uuid,p_reason text default null)
returns public.account_access language plpgsql security definer set search_path='public'
as $$ declare v_row public.account_access; begin
  perform public.require_current_user_admin();
  if p_user_id is null then raise exception 'User id is required.'; end if;
  if public.is_admin_user(p_user_id) then raise exception 'Administrative accounts are protected.' using errcode='42501'; end if;
  insert into public.account_access(user_id,access_starts_at,access_expires_at,blocked_at,block_reason,granted_by)
  values(p_user_id,now(),now(),now(),coalesce(p_reason,'Blocked by admin.'),auth.uid())
  on conflict(user_id) do update set blocked_at=now(),block_reason=coalesce(p_reason,'Blocked by admin.'),granted_by=auth.uid()
  returning * into v_row; return v_row;
end $$;

create or replace function public.admin_unblock_user_access(p_user_id uuid,p_notes text default null)
returns public.account_access language plpgsql security definer set search_path='public'
as $$ declare v_row public.account_access; begin
  perform public.require_current_user_admin();
  if p_user_id is null then raise exception 'User id is required.'; end if;
  if public.is_admin_user(p_user_id) then raise exception 'Administrative accounts are protected.' using errcode='42501'; end if;
  update public.account_access set blocked_at=null,block_reason=null,notes=coalesce(p_notes,notes),granted_by=auth.uid() where user_id=p_user_id returning * into v_row;
  if not found then raise exception 'No access record exists for this user.'; end if;
  return v_row;
end $$;

revoke all on function public.is_admin_user(uuid) from public, anon;
revoke all on function public.is_current_user_admin() from public, anon;
revoke all on function public.require_current_user_admin() from public, anon;
grant execute on function public.is_admin_user(uuid), public.is_current_user_admin(), public.require_current_user_admin() to authenticated, service_role;

revoke all on function public.admin_overview_stats(), public.admin_user_summaries(), public.admin_course_summaries(), public.admin_recent_attempts(), public.admin_list_user_access(), public.admin_past_paper_attempts() from public, anon;
grant execute on function public.admin_overview_stats(), public.admin_user_summaries(), public.admin_course_summaries(), public.admin_recent_attempts(), public.admin_list_user_access(), public.admin_past_paper_attempts() to authenticated, service_role;

revoke all on function public.admin_set_user_access(uuid,integer,text), public.admin_extend_user_access(uuid,integer,text), public.admin_block_user_access(uuid,text), public.admin_unblock_user_access(uuid,text) from public, anon;
grant execute on function public.admin_set_user_access(uuid,integer,text), public.admin_extend_user_access(uuid,integer,text), public.admin_block_user_access(uuid,text), public.admin_unblock_user_access(uuid,text) to authenticated, service_role;

commit;
