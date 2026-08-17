begin;

create or replace function public.admin_user_summaries()
returns table(
  user_id uuid,
  email text,
  display_name text,
  total_attempts bigint,
  quizzes_done bigint,
  average_percentage numeric,
  best_percentage integer,
  latest_activity timestamptz,
  strongest_area text,
  weakest_area text
)
language plpgsql
stable
security definer
set search_path = 'public'
as $$
begin
  perform public.require_current_user_admin();

  return query
  with base as (
    select
      au.id,
      au.email::text,
      coalesce(
        nullif(au.raw_user_meta_data ->> 'display_name', ''),
        nullif(au.raw_user_meta_data ->> 'full_name', ''),
        split_part(coalesce(au.email, ''), '@', 1)
      ) as name
    from auth.users as au
    where not public.is_admin_user(au.id)
  ),
  attempts as (
    select
      qa.user_id,
      count(*) as total,
      count(distinct qa.quiz_id) as quizzes,
      round(avg(qa.percentage)::numeric, 1) as avg_pct,
      max(qa.percentage) as best,
      max(qa.completed_at) as latest
    from public.quiz_attempts as qa
    where not public.is_admin_user(qa.user_id)
    group by qa.user_id
  ),
  area_avg as (
    select
      qa.user_id,
      m.name as area,
      avg(qa.percentage)::numeric as avg_pct
    from public.quiz_attempts as qa
    join public.quizzes as q on q.id = qa.quiz_id
    join public.subtopics as s on s.id = q.subtopic_id
    join public.modules as m on m.id = s.module_id
    where not public.is_admin_user(qa.user_id)
    group by qa.user_id, m.name
  ),
  strongest as (
    select distinct on (area_row.user_id)
      area_row.user_id,
      area_row.area
    from area_avg as area_row
    order by area_row.user_id, area_row.avg_pct desc, area_row.area
  ),
  weakest as (
    select distinct on (area_row.user_id)
      area_row.user_id,
      area_row.area
    from area_avg as area_row
    order by area_row.user_id, area_row.avg_pct, area_row.area
  )
  select
    b.id,
    b.email,
    b.name,
    coalesce(a.total, 0),
    coalesce(a.quizzes, 0),
    coalesce(a.avg_pct, 0),
    coalesce(a.best, 0),
    a.latest,
    coalesce(s.area, 'No data'),
    coalesce(w.area, 'No data')
  from base as b
  left join attempts as a on a.user_id = b.id
  left join strongest as s on s.user_id = b.id
  left join weakest as w on w.user_id = b.id
  order by a.latest desc nulls last, b.email;
end;
$$;

revoke all on function public.admin_user_summaries() from public, anon;
grant execute on function public.admin_user_summaries() to authenticated, service_role;

commit;

