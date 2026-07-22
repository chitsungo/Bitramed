-- Include Past Papers in the protected admin analytics workspace.
-- Run after the core admin functions and the Past Papers schema.

alter table public.past_paper_attempts
  add column if not exists duration_minutes integer,
  add column if not exists negative_marking boolean not null default false,
  add column if not exists timed_out boolean not null default false;

create index if not exists past_paper_attempts_completed_user_idx
  on public.past_paper_attempts (completed_at desc, user_id);

create or replace function public.app_submit_past_paper_attempt(
  p_set_id uuid,
  p_answers jsonb,
  p_duration_minutes integer,
  p_negative_marking boolean,
  p_timed_out boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_attempt_id bigint;
  v_score integer := 0;
  v_total integer := 0;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_unanswered integer := 0;
  v_percentage integer := 0;
  v_branch record;
  v_answer_text text;
  v_user_answer boolean;
  v_is_correct boolean;
  v_points integer;
begin
  perform public.app_require_active_access();

  if p_set_id is null then
    raise exception 'Set id is required.';
  end if;

  if p_duration_minutes is not null and p_duration_minutes <= 0 then
    raise exception 'Duration must be a positive number of minutes.';
  end if;

  if not exists (
    select 1
    from public.past_paper_sets
    where id = p_set_id
      and is_active
  ) then
    raise exception 'Past paper set not found.';
  end if;

  insert into public.past_paper_attempts (
    user_id,
    set_id,
    duration_minutes,
    negative_marking,
    timed_out
  )
  values (
    auth.uid(),
    p_set_id,
    p_duration_minutes,
    coalesce(p_negative_marking, false),
    coalesce(p_timed_out, false)
  )
  returning id into v_attempt_id;

  for v_branch in
    select
      pu.id as unit_id,
      pb.id as branch_id,
      pb.correct_answer
    from public.past_paper_units pu
    join public.past_paper_branches pb on pb.unit_id = pu.id
    where pu.set_id = p_set_id
      and pu.is_active
    order by pu.display_order, pb.branch_order
  loop
    v_total := v_total + 1;
    v_answer_text := coalesce(p_answers, '{}'::jsonb) ->> v_branch.branch_id::text;

    if v_answer_text is null then
      v_user_answer := null;
      v_is_correct := false;
      v_points := 0;
      v_unanswered := v_unanswered + 1;
    else
      v_user_answer := public.normalize_past_paper_answer(v_answer_text);
      v_is_correct := v_user_answer = v_branch.correct_answer;

      if v_is_correct then
        v_points := 1;
        v_correct := v_correct + 1;
      else
        v_points := case when coalesce(p_negative_marking, false) then -1 else 0 end;
        v_wrong := v_wrong + 1;
      end if;

      v_score := v_score + v_points;
    end if;

    insert into public.past_paper_attempt_answers (
      attempt_id,
      unit_id,
      branch_id,
      user_answer,
      correct_answer,
      is_correct,
      points
    )
    values (
      v_attempt_id,
      v_branch.unit_id,
      v_branch.branch_id,
      v_user_answer,
      v_branch.correct_answer,
      v_is_correct,
      v_points
    );
  end loop;

  v_percentage := case
    when v_total > 0
      then round((greatest(v_score, 0)::numeric / v_total::numeric) * 100)::integer
    else 0
  end;

  update public.past_paper_attempts
  set
    score = v_score,
    total_marks = v_total,
    correct_count = v_correct,
    wrong_count = v_wrong,
    unanswered_count = v_unanswered,
    percentage = v_percentage
  where id = v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'setId', p_set_id,
    'score', v_score,
    'totalMarks', v_total,
    'correct', v_correct,
    'wrong', v_wrong,
    'unanswered', v_unanswered,
    'percentage', v_percentage,
    'durationMinutes', p_duration_minutes,
    'negativeMarking', coalesce(p_negative_marking, false),
    'timedOut', coalesce(p_timed_out, false)
  );
end;
$$;

create or replace function public.app_submit_past_paper_attempt(
  p_set_id uuid,
  p_answers jsonb
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.app_submit_past_paper_attempt(
    p_set_id,
    p_answers,
    null,
    false,
    false
  );
$$;

create or replace function public.app_past_paper_attempt_review(
  p_attempt_id bigint
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with guard as (
    select public.app_require_active_access() as ok
  ),
  attempt as (
    select *
    from public.past_paper_attempts
    where id = p_attempt_id
      and user_id = auth.uid()
  ),
  units as (
    select
      pu.id as unit_id,
      pu.stem,
      pu.image_url,
      pu.display_order,
      jsonb_agg(
        jsonb_build_object(
          'branchId', pb.id,
          'order', pb.branch_order,
          'prompt', pb.prompt,
          'userAnswer', paa.user_answer,
          'correctAnswer', paa.correct_answer,
          'isCorrect', paa.is_correct,
          'points', paa.points,
          'explanation', pb.explanation
        )
        order by pb.branch_order
      ) as branches
    from attempt a
    join public.past_paper_units pu on pu.set_id = a.set_id
    join public.past_paper_branches pb on pb.unit_id = pu.id
    left join public.past_paper_attempt_answers paa
      on paa.attempt_id = a.id
     and paa.branch_id = pb.id
    group by pu.id
  )
  select jsonb_build_object(
    'attempt', jsonb_build_object(
      'attemptId', a.id,
      'setId', a.set_id,
      'score', a.score,
      'totalMarks', a.total_marks,
      'correct', a.correct_count,
      'wrong', a.wrong_count,
      'unanswered', a.unanswered_count,
      'percentage', a.percentage,
      'durationMinutes', a.duration_minutes,
      'negativeMarking', a.negative_marking,
      'timedOut', a.timed_out,
      'completedAt', a.completed_at
    ),
    'units', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'unitId', u.unit_id,
          'stem', u.stem,
          'imageUrl', u.image_url,
          'branches', u.branches
        )
        order by u.display_order, u.unit_id
      ),
      '[]'::jsonb
    )
  )
  from guard
  cross join attempt a
  left join units u on true
  group by
    a.id,
    a.set_id,
    a.score,
    a.total_marks,
    a.correct_count,
    a.wrong_count,
    a.unanswered_count,
    a.percentage,
    a.duration_minutes,
    a.negative_marking,
    a.timed_out,
    a.completed_at;
$$;

create or replace function public.app_past_paper_attempts_enriched()
returns table (
  id text,
  user_id uuid,
  set_id uuid,
  level text,
  area text,
  quiz_title text,
  assessment_kind text,
  section text,
  mode text,
  score integer,
  total_questions integer,
  correct_count integer,
  wrong_count integer,
  unanswered_count integer,
  percentage integer,
  duration_minutes integer,
  negative_marking boolean,
  timed_out boolean,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with guard as (
    select public.app_require_active_access() as ok
  )
  select
    'past_paper:' || pa.id::text as id,
    pa.user_id,
    pa.set_id,
    ps.year_label as level,
    ps.topic_label as area,
    ps.title as quiz_title,
    'past_paper'::text as assessment_kind,
    'exam'::text as section,
    'exam'::text as mode,
    pa.score,
    pa.total_marks as total_questions,
    pa.correct_count,
    pa.wrong_count,
    pa.unanswered_count,
    pa.percentage,
    pa.duration_minutes,
    pa.negative_marking,
    pa.timed_out,
    pa.completed_at
  from guard
  cross join public.past_paper_attempts pa
  join public.past_paper_sets ps on ps.id = pa.set_id
  where pa.user_id = auth.uid()
  order by pa.completed_at desc, pa.id desc;
$$;

create or replace function public.app_reset_account_history()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz_attempts integer := 0;
  v_exam_attempts integer := 0;
  v_drafts integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  delete from public.quiz_attempts where user_id = v_user_id;
  get diagnostics v_quiz_attempts = row_count;

  delete from public.past_paper_attempts where user_id = v_user_id;
  get diagnostics v_exam_attempts = row_count;

  delete from public.user_assessment_progress where user_id = v_user_id;
  get diagnostics v_drafts = row_count;

  return jsonb_build_object(
    'quizAttempts', v_quiz_attempts,
    'examAttempts', v_exam_attempts,
    'drafts', v_drafts
  );
end;
$$;

create or replace function public.admin_past_paper_attempts()
returns table (
  attempt_id bigint,
  user_id uuid,
  set_id uuid,
  quiz_title text,
  area text,
  level text,
  mode text,
  assessment_kind text,
  score integer,
  total_questions integer,
  correct_count integer,
  wrong_count integer,
  unanswered_count integer,
  percentage integer,
  duration_minutes integer,
  negative_marking boolean,
  timed_out boolean,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform public.require_current_user_admin();

  return query
  select
    pa.id as attempt_id,
    pa.user_id,
    pa.set_id,
    ps.title as quiz_title,
    ps.topic_label as area,
    ps.year_label as level,
    'exam'::text as mode,
    'past_paper'::text as assessment_kind,
    pa.score,
    pa.total_marks as total_questions,
    pa.correct_count,
    pa.wrong_count,
    pa.unanswered_count,
    pa.percentage,
    pa.duration_minutes,
    pa.negative_marking,
    pa.timed_out,
    pa.completed_at
  from public.past_paper_attempts pa
  join public.past_paper_sets ps on ps.id = pa.set_id
  order by pa.completed_at desc, pa.id desc;
end;
$$;

revoke all on function public.admin_past_paper_attempts()
  from public, anon;

grant execute on function public.admin_past_paper_attempts()
  to authenticated, service_role;

revoke all on function public.app_submit_past_paper_attempt(
  uuid,
  jsonb,
  integer,
  boolean,
  boolean
) from public, anon;
revoke all on function public.app_submit_past_paper_attempt(uuid, jsonb)
  from public, anon;
revoke all on function public.app_past_paper_attempt_review(bigint)
  from public, anon;
revoke all on function public.app_past_paper_attempts_enriched()
  from public, anon;
revoke all on function public.app_reset_account_history()
  from public, anon;

grant execute on function public.app_submit_past_paper_attempt(
  uuid,
  jsonb,
  integer,
  boolean,
  boolean
) to authenticated, service_role;
grant execute on function public.app_submit_past_paper_attempt(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.app_past_paper_attempt_review(bigint)
  to authenticated, service_role;
grant execute on function public.app_past_paper_attempts_enriched()
  to authenticated, service_role;
grant execute on function public.app_reset_account_history()
  to authenticated, service_role;
