begin;

alter table public.user_preferences
  drop constraint if exists user_preferences_theme_check;

alter table public.user_preferences
  alter column theme set default 'system',
  add column if not exists text_size text not null default 'normal',
  add column if not exists reduced_motion boolean not null default false,
  add column if not exists default_mode text not null default 'study',
  add column if not exists default_duration_minutes integer,
  add column if not exists default_negative_marking boolean not null default false;

alter table public.user_preferences
  add constraint user_preferences_theme_check
    check (theme = any (array['system'::text, 'light'::text, 'dark'::text])),
  add constraint user_preferences_text_size_check
    check (text_size = any (array['normal'::text, 'large'::text])),
  add constraint user_preferences_default_mode_check
    check (default_mode = any (array['study'::text, 'exam'::text])),
  add constraint user_preferences_default_duration_check
    check (default_duration_minutes is null or default_duration_minutes = any (array[5, 10, 15, 20, 30, 45, 60]));

alter table public.quiz_attempts
  add column if not exists duration_minutes integer,
  add column if not exists negative_marking boolean not null default false,
  add column if not exists timed_out boolean not null default false,
  add column if not exists submission_id uuid;

alter table public.past_paper_attempts
  add column if not exists submission_id uuid;

create unique index if not exists quiz_attempts_user_submission_unique
  on public.quiz_attempts (user_id, submission_id)
  where submission_id is not null;

create unique index if not exists past_paper_attempts_user_submission_unique
  on public.past_paper_attempts (user_id, submission_id)
  where submission_id is not null;

create table if not exists public.quiz_attempt_answers (
  id bigint generated always as identity primary key,
  attempt_id bigint not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid,
  position integer not null check (position > 0),
  question_text text not null,
  question_type text not null check (question_type = any (array['tf'::text, 'sba'::text])),
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  image_url text,
  user_answer text,
  correct_answer text not null,
  explanation text,
  is_correct boolean not null default false,
  points integer not null default 0,
  answered_at timestamptz not null default now(),
  unique (attempt_id, position)
);

alter table public.quiz_attempt_answers enable row level security;

drop policy if exists quiz_attempt_answers_select_own_active_access
  on public.quiz_attempt_answers;
create policy quiz_attempt_answers_select_own_active_access
  on public.quiz_attempt_answers
  for select to authenticated
  using (
    public.app_current_user_has_access()
    and exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = quiz_attempt_answers.attempt_id
        and qa.user_id = auth.uid()
    )
  );

alter table public.past_paper_attempt_answers
  add column if not exists snapshot jsonb;

create or replace function public.app_shell_bootstrap_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_access jsonb;
  v_preferences jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  select public.app_my_access_status() into v_access;
  select jsonb_build_object(
    'theme', up.theme,
    'textSize', up.text_size,
    'reducedMotion', up.reduced_motion,
    'defaultMode', up.default_mode,
    'defaultDurationMinutes', up.default_duration_minutes,
    'defaultNegativeMarking', up.default_negative_marking
  )
  into v_preferences
  from public.user_preferences up
  where up.user_id = v_user_id;

  return jsonb_build_object(
    'schemaVersion', 2,
    'access', coalesce(v_access, '{}'::jsonb),
    'preferences', coalesce(v_preferences, jsonb_build_object(
      'theme', 'system',
      'textSize', 'normal',
      'reducedMotion', false,
      'defaultMode', 'study',
      'defaultDurationMinutes', null,
      'defaultNegativeMarking', false
    ))
  );
end;
$$;

create or replace function public.app_home_bootstrap_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_base jsonb;
  v_shell jsonb;
  v_account jsonb := '{}'::jsonb;
  v_drafts jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  select public.app_home_bootstrap() into v_base;
  select public.app_shell_bootstrap_v2() into v_shell;

  if coalesce((v_shell -> 'access' ->> 'hasAccess')::boolean, false) then
    select public.app_account_page(5) into v_account;
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind', p.assessment_kind,
      'assessmentId', p.assessment_id,
      'progressKey', p.progress_key,
      'mode', p.mode,
      'durationMinutes', p.duration_minutes,
      'negativeMarking', p.negative_marking,
      'context', p.context,
      'answeredCount', (
        select count(*)::integer
        from jsonb_object_keys(coalesce(p.progress_data -> 'answers', '{}'::jsonb))
      ),
      'currentIndex', coalesce((p.progress_data ->> 'currentIndex')::integer, 0),
      'timerExpiresAt', p.timer_expires_at,
      'updatedAt', p.updated_at
    ) order by p.updated_at desc), '[]'::jsonb)
    into v_drafts
    from public.user_assessment_progress p
    where p.user_id = v_user_id;
  end if;

  return v_base || jsonb_build_object(
    'schemaVersion', 2,
    'dashboard', coalesce(v_base -> 'dashboard', '{}'::jsonb) || jsonb_build_object(
      'attemptCount', coalesce((v_account ->> 'attemptsCount')::integer, 0),
      'completedCount', coalesce((v_account ->> 'quizzesDoneCount')::integer, 0),
      'pastPaperYears', coalesce((
        select jsonb_agg(jsonb_build_object(
          'year', item ->> 'year_label',
          'examCount', coalesce((item ->> 'exam_count')::integer, 0),
          'totalMarks', coalesce((item ->> 'total_marks')::integer, 0),
          'bestPercentage', coalesce((item ->> 'best_percentage')::integer, 0)
        ))
        from jsonb_array_elements(coalesce(v_base -> 'dashboard' -> 'pastPaperYears', '[]'::jsonb)) item
      ), '[]'::jsonb)
    ),
    'preferences', v_shell -> 'preferences',
    'drafts', v_drafts,
    'recentAttempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', item ->> 'assessmentKind',
        'attemptId', item ->> 'id',
        'quizId', item -> 'quizId',
        'setId', item -> 'setId',
        'level', coalesce(item ->> 'level', ''),
        'area', coalesce(item ->> 'area', ''),
        'sub', coalesce(item ->> 'sub', ''),
        'title', coalesce(item ->> 'quizTitle', 'Assessment'),
        'mode', coalesce(item ->> 'mode', 'exam'),
        'score', coalesce((item ->> 'score')::integer, 0),
        'total', coalesce((item ->> 'totalQuestions')::integer, 0),
        'correct', coalesce((item ->> 'correctCount')::integer, 0),
        'wrong', coalesce((item ->> 'wrongCount')::integer, 0),
        'unanswered', coalesce((item ->> 'unansweredCount')::integer, 0),
        'percentage', coalesce((item ->> 'percentage')::integer, 0),
        'completedAt', item ->> 'completedAt'
      ))
      from jsonb_array_elements(coalesce(v_account -> 'recentAttempts', '[]'::jsonb)) item
    ), '[]'::jsonb),
    'bestAttempt', v_account -> 'bestAttempt'
  );
end;
$$;

create or replace function public.app_quiz_session_v2(
  p_quiz_id uuid,
  p_progress_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_progress_key text := nullif(trim(p_progress_key), '');
  v_context jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_quiz_id is null then
    raise exception using errcode = '22023', message = 'Quiz is required.';
  end if;
  if v_progress_key is not null and length(v_progress_key) > 100 then
    raise exception using errcode = '22023', message = 'Progress key is invalid.';
  end if;

  perform public.app_require_active_access();
  v_context := public.app_quiz_context(p_quiz_id);

  with question_rows as materialized (
    select
      q.id,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.option_e,
      q.image_url,
      row_number() over (order by q.id)::integer as position
    from public.questions q
    where q.quiz_id = p_quiz_id
  ), progress as (
    select p.*
    from public.user_assessment_progress p
    where v_progress_key is not null
      and p.user_id = v_user_id
      and p.assessment_kind = 'quiz'
      and p.assessment_id = p_quiz_id::text
      and p.progress_key = v_progress_key
    limit 1
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'descriptor', v_context -> 'descriptor',
    'siblings', coalesce(v_context -> 'siblings', '[]'::jsonb),
    'questions', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', q.id,
      'position', q.position,
      'questionText', q.question_text,
      'optionA', q.option_a,
      'optionB', q.option_b,
      'optionC', q.option_c,
      'optionD', q.option_d,
      'optionE', q.option_e,
      'imageUrl', q.image_url
    )) order by q.position) filter (where q.id is not null), '[]'::jsonb),
    'progress', (select to_jsonb(p) from progress p)
  ) into v_result
  from question_rows q;

  return v_result;
end;
$$;

create or replace function public.app_check_quiz_answer(
  p_quiz_id uuid,
  p_question_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_expected text;
  v_explanation text;
  v_answer text;
begin
  perform public.app_require_active_access();

  select qz.question_type, upper(trim(q.correct_answer)), q.explanation
  into v_type, v_expected, v_explanation
  from public.questions q
  join public.quizzes qz on qz.id = q.quiz_id
  where q.id = p_question_id and q.quiz_id = p_quiz_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Question was not found in this assessment.';
  end if;

  v_answer := upper(trim(coalesce(p_answer, '')));
  if v_type = 'tf' then
    v_answer := case
      when v_answer = any (array['TRUE', 'T', '1', 'YES']) then 'TRUE'
      when v_answer = any (array['FALSE', 'F', '0', 'NO']) then 'FALSE'
      else ''
    end;
  end if;

  if v_answer = '' then
    raise exception using errcode = '22023', message = 'Answer is invalid.';
  end if;

  return jsonb_build_object(
    'questionId', p_question_id,
    'isCorrect', v_answer = v_expected,
    'correctAnswer', v_expected,
    'explanation', coalesce(v_explanation, '')
  );
end;
$$;

create or replace function public.app_submit_quiz_attempt(
  p_quiz_id uuid,
  p_submission_id uuid,
  p_answers jsonb,
  p_mode text,
  p_duration_minutes integer default null,
  p_negative_marking boolean default false,
  p_timed_out boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id bigint;
  v_question record;
  v_answer text;
  v_expected text;
  v_is_correct boolean;
  v_points integer;
  v_score integer := 0;
  v_total integer := 0;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_unanswered integer := 0;
  v_percentage integer := 0;
begin
  perform public.app_require_active_access();
  if p_quiz_id is null or p_submission_id is null then
    raise exception using errcode = '22023', message = 'Quiz and submission references are required.';
  end if;
  if p_mode not in ('study', 'exam') then
    raise exception using errcode = '22023', message = 'Assessment mode is invalid.';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'Answers must be an object.';
  end if;
  if p_duration_minutes is not null and p_duration_minutes not in (5, 10, 15, 20, 30, 45, 60) then
    raise exception using errcode = '22023', message = 'Duration is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_submission_id::text, 0)
  );

  select qa.id into v_attempt_id
  from public.quiz_attempts qa
  where qa.user_id = v_user_id and qa.submission_id = p_submission_id;

  if v_attempt_id is not null then
    return (
      select jsonb_build_object(
        'attemptId', qa.id,
        'quizId', qa.quiz_id,
        'submissionId', qa.submission_id,
        'mode', qa.mode,
        'score', qa.score,
        'totalQuestions', qa.total_questions,
        'correct', qa.correct_count,
        'wrong', qa.wrong_count,
        'unanswered', qa.unanswered_count,
        'percentage', qa.percentage,
        'durationMinutes', qa.duration_minutes,
        'negativeMarking', qa.negative_marking,
        'timedOut', qa.timed_out
      )
      from public.quiz_attempts qa
      where qa.id = v_attempt_id
    );
  end if;

  for v_question in
    select q.*, qz.question_type,
      row_number() over (order by q.id)::integer as position
    from public.questions q
    join public.quizzes qz on qz.id = q.quiz_id
    where q.quiz_id = p_quiz_id
    order by q.id
  loop
    v_total := v_total + 1;
    v_answer := upper(trim(coalesce(p_answers ->> v_question.id::text, '')));
    v_expected := upper(trim(v_question.correct_answer));
    if v_question.question_type = 'tf' then
      v_answer := case
        when v_answer = any (array['TRUE', 'T', '1', 'YES']) then 'TRUE'
        when v_answer = any (array['FALSE', 'F', '0', 'NO']) then 'FALSE'
        else ''
      end;
    end if;

    v_is_correct := v_answer <> '' and v_answer = v_expected;
    if v_answer = '' then
      v_points := 0;
      v_unanswered := v_unanswered + 1;
    elsif v_is_correct then
      v_points := 1;
      v_correct := v_correct + 1;
    else
      v_points := case when coalesce(p_negative_marking, false) then -1 else 0 end;
      v_wrong := v_wrong + 1;
    end if;
    v_score := v_score + v_points;
  end loop;

  if v_total = 0 then
    raise exception using errcode = 'P0002', message = 'Assessment has no published questions.';
  end if;
  v_percentage := round((greatest(v_score, 0)::numeric / v_total::numeric) * 100)::integer;

  insert into public.quiz_attempts (
    user_id, quiz_id, mode, score, total_questions, correct_count,
    wrong_count, unanswered_count, percentage, duration_minutes,
    negative_marking, timed_out, submission_id
  ) values (
    v_user_id, p_quiz_id, p_mode, v_score, v_total, v_correct,
    v_wrong, v_unanswered, v_percentage, p_duration_minutes,
    coalesce(p_negative_marking, false), coalesce(p_timed_out, false), p_submission_id
  ) returning id into v_attempt_id;

  with snapshot_rows as materialized (
    select
      q.*,
      qz.question_type,
      row_number() over (order by q.id)::integer as position,
      upper(trim(q.correct_answer)) as expected_answer,
      case
        when qz.question_type = 'tf' then case
          when upper(trim(coalesce(p_answers ->> q.id::text, ''))) = any (array['TRUE', 'T', '1', 'YES']) then 'TRUE'
          when upper(trim(coalesce(p_answers ->> q.id::text, ''))) = any (array['FALSE', 'F', '0', 'NO']) then 'FALSE'
          else ''
        end
        else upper(trim(coalesce(p_answers ->> q.id::text, '')))
      end as normalized_answer
    from public.questions q
    join public.quizzes qz on qz.id = q.quiz_id
    where q.quiz_id = p_quiz_id
  )
  insert into public.quiz_attempt_answers (
    attempt_id, question_id, position, question_text, question_type, options,
    image_url, user_answer, correct_answer, explanation, is_correct, points
  )
  select
    v_attempt_id,
    q.id,
    q.position,
    q.question_text,
    q.question_type,
    jsonb_strip_nulls(jsonb_build_object(
      'A', q.option_a, 'B', q.option_b, 'C', q.option_c,
      'D', q.option_d, 'E', q.option_e
    )),
    q.image_url,
    nullif(q.normalized_answer, ''),
    q.expected_answer,
    coalesce(q.explanation, ''),
    q.normalized_answer <> '' and q.normalized_answer = q.expected_answer,
    case
      when q.normalized_answer = '' then 0
      when q.normalized_answer = q.expected_answer then 1
      when coalesce(p_negative_marking, false) then -1
      else 0
    end
  from snapshot_rows q
  order by q.position;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'quizId', p_quiz_id,
    'submissionId', p_submission_id,
    'mode', p_mode,
    'score', v_score,
    'totalQuestions', v_total,
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

create or replace function public.app_quiz_attempt_review(p_attempt_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.app_require_active_access();

  select jsonb_build_object(
    'schemaVersion', 2,
    'detailAvailable', exists (
      select 1 from public.quiz_attempt_answers aa where aa.attempt_id = a.id
    ),
    'attempt', jsonb_build_object(
      'attemptId', a.id,
      'quizId', a.quiz_id,
      'title', q.title,
      'level', coalesce(l.name, ''),
      'area', m.name,
      'sub', s.name,
      'mode', a.mode,
      'score', a.score,
      'totalQuestions', a.total_questions,
      'correct', a.correct_count,
      'wrong', a.wrong_count,
      'unanswered', a.unanswered_count,
      'percentage', a.percentage,
      'durationMinutes', a.duration_minutes,
      'negativeMarking', a.negative_marking,
      'timedOut', a.timed_out,
      'completedAt', a.completed_at
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', aa.question_id,
        'position', aa.position,
        'questionText', aa.question_text,
        'questionType', aa.question_type,
        'options', aa.options,
        'imageUrl', aa.image_url,
        'userAnswer', aa.user_answer,
        'correctAnswer', aa.correct_answer,
        'explanation', aa.explanation,
        'isCorrect', aa.is_correct,
        'points', aa.points
      ) order by aa.position)
      from public.quiz_attempt_answers aa
      where aa.attempt_id = a.id
    ), '[]'::jsonb)
  ) into v_result
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  join public.subtopics s on s.id = q.subtopic_id
  join public.modules m on m.id = s.module_id
  left join public.levels l on l.id = m.level_id
  where a.id = p_attempt_id and a.user_id = auth.uid();

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Attempt was not found.';
  end if;
  return v_result;
end;
$$;

create or replace function public.app_submit_past_paper_attempt_v2(
  p_set_id uuid,
  p_submission_id uuid,
  p_answers jsonb,
  p_duration_minutes integer default null,
  p_negative_marking boolean default false,
  p_timed_out boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id bigint;
  v_branch record;
  v_answer_text text;
  v_user_answer boolean;
  v_is_correct boolean;
  v_points integer;
  v_score integer := 0;
  v_total integer := 0;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_unanswered integer := 0;
  v_percentage integer := 0;
begin
  perform public.app_require_active_access();
  if p_set_id is null or p_submission_id is null then
    raise exception using errcode = '22023', message = 'Paper and submission references are required.';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'Answers must be an object.';
  end if;
  if p_duration_minutes is not null and p_duration_minutes not in (5, 10, 15, 20, 30, 45, 60) then
    raise exception using errcode = '22023', message = 'Duration is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_submission_id::text, 0)
  );

  select pa.id into v_attempt_id
  from public.past_paper_attempts pa
  where pa.user_id = v_user_id and pa.submission_id = p_submission_id;
  if v_attempt_id is not null then
    return (
      select jsonb_build_object(
        'attemptId', pa.id,
        'setId', pa.set_id,
        'submissionId', pa.submission_id,
        'mode', 'exam',
        'score', pa.score,
        'totalQuestions', pa.total_marks,
        'correct', pa.correct_count,
        'wrong', pa.wrong_count,
        'unanswered', pa.unanswered_count,
        'percentage', pa.percentage,
        'durationMinutes', pa.duration_minutes,
        'negativeMarking', pa.negative_marking,
        'timedOut', pa.timed_out
      )
      from public.past_paper_attempts pa
      where pa.id = v_attempt_id
    );
  end if;

  if not exists (select 1 from public.past_paper_sets ps where ps.id = p_set_id and ps.is_active) then
    raise exception using errcode = 'P0002', message = 'Past paper was not found.';
  end if;

  insert into public.past_paper_attempts (
    user_id, set_id, duration_minutes, negative_marking, timed_out, submission_id
  ) values (
    v_user_id, p_set_id, p_duration_minutes, coalesce(p_negative_marking, false),
    coalesce(p_timed_out, false), p_submission_id
  ) returning id into v_attempt_id;

  for v_branch in
    select
      pu.id as unit_id,
      pu.stem,
      pu.image_url as unit_image_url,
      pu.display_order as unit_order,
      pb.id as branch_id,
      pb.branch_order,
      pb.prompt,
      pb.image_url as branch_image_url,
      pb.correct_answer,
      pb.explanation
    from public.past_paper_units pu
    join public.past_paper_branches pb on pb.unit_id = pu.id
    where pu.set_id = p_set_id and pu.is_active
    order by pu.display_order, pb.branch_order
  loop
    v_total := v_total + 1;
    v_answer_text := lower(trim(coalesce(p_answers ->> v_branch.branch_id::text, '')));
    if v_answer_text = '' then
      v_user_answer := null;
      v_is_correct := false;
      v_points := 0;
      v_unanswered := v_unanswered + 1;
    else
      v_user_answer := case
        when v_answer_text = any (array['true', 't', '1', 'yes']) then true
        when v_answer_text = any (array['false', 'f', '0', 'no']) then false
        else null
      end;
      if v_user_answer is null then
        v_is_correct := false;
        v_points := 0;
        v_unanswered := v_unanswered + 1;
      else
        v_is_correct := v_user_answer = v_branch.correct_answer;
        if v_is_correct then
          v_points := 1;
          v_correct := v_correct + 1;
        else
          v_points := case when coalesce(p_negative_marking, false) then -1 else 0 end;
          v_wrong := v_wrong + 1;
        end if;
      end if;
    end if;
    v_score := v_score + v_points;

    insert into public.past_paper_attempt_answers (
      attempt_id, unit_id, branch_id, user_answer, correct_answer,
      is_correct, points, snapshot
    ) values (
      v_attempt_id, v_branch.unit_id, v_branch.branch_id, v_user_answer,
      v_branch.correct_answer, v_is_correct, v_points,
      jsonb_build_object(
        'unitId', v_branch.unit_id,
        'unitOrder', v_branch.unit_order,
        'stem', v_branch.stem,
        'unitImageUrl', v_branch.unit_image_url,
        'branchId', v_branch.branch_id,
        'branchOrder', v_branch.branch_order,
        'prompt', v_branch.prompt,
        'branchImageUrl', v_branch.branch_image_url,
        'correctAnswer', v_branch.correct_answer,
        'explanation', coalesce(v_branch.explanation, '')
      )
    );
  end loop;

  if v_total = 0 then
    raise exception using errcode = 'P0002', message = 'Past paper has no published questions.';
  end if;
  v_percentage := round((greatest(v_score, 0)::numeric / v_total::numeric) * 100)::integer;

  update public.past_paper_attempts
  set score = v_score,
      total_marks = v_total,
      correct_count = v_correct,
      wrong_count = v_wrong,
      unanswered_count = v_unanswered,
      percentage = v_percentage
  where id = v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'setId', p_set_id,
    'submissionId', p_submission_id,
    'mode', 'exam',
    'score', v_score,
    'totalQuestions', v_total,
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

create or replace function public.app_past_paper_attempt_review_v2(p_attempt_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.app_require_active_access();

  with attempt as (
    select pa.*, ps.title, ps.year_label, ps.topic_label
    from public.past_paper_attempts pa
    join public.past_paper_sets ps on ps.id = pa.set_id
    where pa.id = p_attempt_id and pa.user_id = auth.uid()
  ), answers as (
    select
      paa.*,
      coalesce(paa.snapshot, jsonb_build_object(
        'unitId', pu.id,
        'unitOrder', pu.display_order,
        'stem', pu.stem,
        'unitImageUrl', pu.image_url,
        'branchId', pb.id,
        'branchOrder', pb.branch_order,
        'prompt', pb.prompt,
        'branchImageUrl', pb.image_url,
        'correctAnswer', paa.correct_answer,
        'explanation', coalesce(pb.explanation, '')
      )) as snap
    from attempt a
    join public.past_paper_attempt_answers paa on paa.attempt_id = a.id
    left join public.past_paper_units pu on pu.id = paa.unit_id
    left join public.past_paper_branches pb on pb.id = paa.branch_id
  ), units as (
    select
      snap ->> 'unitId' as unit_id,
      min(coalesce((snap ->> 'unitOrder')::integer, 0)) as unit_order,
      min(snap ->> 'stem') as stem,
      min(snap ->> 'unitImageUrl') as image_url,
      jsonb_agg(jsonb_build_object(
        'branchId', snap ->> 'branchId',
        'order', coalesce((snap ->> 'branchOrder')::integer, 0),
        'prompt', snap ->> 'prompt',
        'imageUrl', snap ->> 'branchImageUrl',
        'userAnswer', user_answer,
        'correctAnswer', correct_answer,
        'isCorrect', is_correct,
        'points', points,
        'explanation', snap ->> 'explanation'
      ) order by coalesce((snap ->> 'branchOrder')::integer, 0)) as branches
    from answers
    group by snap ->> 'unitId'
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'detailAvailable', exists (select 1 from answers),
    'attempt', jsonb_build_object(
      'attemptId', a.id,
      'setId', a.set_id,
      'title', a.title,
      'level', a.year_label,
      'area', a.topic_label,
      'sub', 'Past Paper Exam',
      'mode', 'exam',
      'score', a.score,
      'totalQuestions', a.total_marks,
      'correct', a.correct_count,
      'wrong', a.wrong_count,
      'unanswered', a.unanswered_count,
      'percentage', a.percentage,
      'durationMinutes', a.duration_minutes,
      'negativeMarking', a.negative_marking,
      'timedOut', a.timed_out,
      'completedAt', a.completed_at
    ),
    'units', coalesce((select jsonb_agg(jsonb_build_object(
      'unitId', u.unit_id,
      'stem', u.stem,
      'imageUrl', u.image_url,
      'branches', u.branches
    ) order by u.unit_order, u.unit_id) from units u), '[]'::jsonb)
  ) into v_result
  from attempt a;

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Attempt was not found.';
  end if;
  return v_result;
end;
$$;

create or replace function public.app_attempt_history(
  p_limit integer default 20,
  p_cursor_completed_at timestamptz default null,
  p_cursor_key text default null,
  p_kind text default null,
  p_mode text default null,
  p_level text default null,
  p_area text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(50, greatest(1, coalesce(p_limit, 20)));
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  perform public.app_require_active_access();
  if p_kind is not null and p_kind not in ('quiz', 'past_paper') then
    raise exception using errcode = '22023', message = 'History kind is invalid.';
  end if;
  if p_mode is not null and p_mode not in ('study', 'exam') then
    raise exception using errcode = '22023', message = 'History mode is invalid.';
  end if;

  with attempts as materialized (
    select
      'quiz'::text as kind,
      'quiz:' || a.id::text as cursor_key,
      a.id::text as attempt_id,
      a.quiz_id,
      null::uuid as set_id,
      a.level,
      a.area,
      a.sub,
      a.quiz_title as title,
      a.mode,
      a.score,
      a.total_questions as total,
      a.correct_count as correct,
      a.wrong_count as wrong,
      a.unanswered_count as unanswered,
      a.percentage,
      a.completed_at
    from public.app_user_attempts_enriched() a
    where a.user_id = v_user_id
    union all
    select
      'past_paper',
      a.id,
      replace(a.id, 'past_paper:', ''),
      null::uuid,
      a.set_id,
      a.level,
      a.area,
      'Past Paper Exam',
      a.quiz_title,
      'exam',
      a.score,
      a.total_questions,
      a.correct_count,
      a.wrong_count,
      a.unanswered_count,
      a.percentage,
      a.completed_at
    from public.app_past_paper_attempts_enriched() a
    where a.user_id = v_user_id
  ), filtered as materialized (
    select * from attempts a
    where (p_kind is null or a.kind = p_kind)
      and (p_mode is null or a.mode = p_mode)
      and (p_level is null or lower(a.level) = lower(p_level))
      and (p_area is null or lower(a.area) = lower(p_area))
      and (p_from is null or a.completed_at >= p_from)
      and (p_to is null or a.completed_at <= p_to)
  ), page as materialized (
    select * from filtered a
    where p_cursor_completed_at is null
      or a.completed_at < p_cursor_completed_at
      or (a.completed_at = p_cursor_completed_at and a.cursor_key < coalesce(p_cursor_key, ''))
    order by a.completed_at desc, a.cursor_key desc
    limit v_limit + 1
  ), visible as materialized (
    select * from page order by completed_at desc, cursor_key desc limit v_limit
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'summary', jsonb_build_object(
      'attempts', (select count(*) from filtered),
      'averagePercentage', coalesce((select round(avg(percentage))::integer from filtered), 0),
      'bestPercentage', coalesce((select max(percentage) from filtered), 0)
    ),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'kind', v.kind,
      'attemptId', v.attempt_id,
      'quizId', v.quiz_id,
      'setId', v.set_id,
      'level', v.level,
      'area', v.area,
      'sub', v.sub,
      'title', v.title,
      'mode', v.mode,
      'score', v.score,
      'total', v.total,
      'correct', v.correct,
      'wrong', v.wrong,
      'unanswered', v.unanswered,
      'percentage', v.percentage,
      'completedAt', v.completed_at
    ) order by v.completed_at desc, v.cursor_key desc) from visible v), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page) > v_limit then (
      select jsonb_build_object('completedAt', v.completed_at, 'key', v.cursor_key)
      from visible v order by v.completed_at, v.cursor_key limit 1
    ) else null end
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.app_learning_search(
  p_query text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit integer := least(40, greatest(1, coalesce(p_limit, 20)));
  v_result jsonb;
begin
  perform public.app_require_active_access();

  with candidates as materialized (
    select
      'quiz'::text as kind,
      c.quiz_id::text as id,
      c.level,
      c.area,
      c.sub,
      c.quiz_title as title,
      c.question_type as type,
      c.question_count as item_count,
      case
        when lower(c.quiz_title) = v_query then 300
        when lower(c.quiz_title) like v_query || '%' then 220
        when lower(concat_ws(' ', c.quiz_title, c.sub, c.area, c.level)) like '%' || v_query || '%' then 120
        else 0
      end as rank
    from public.app_quiz_catalog_rows() c
    where v_query = '' or lower(concat_ws(' ', c.quiz_title, c.sub, c.area, c.level)) like '%' || v_query || '%'
    union all
    select
      'past_paper',
      ps.id::text,
      ps.year_label,
      ps.topic_label,
      'Past Paper',
      ps.title,
      'past_paper',
      (select count(*)::integer from public.past_paper_units pu where pu.set_id = ps.id and pu.is_active),
      case
        when lower(ps.title) = v_query then 300
        when lower(ps.title) like v_query || '%' then 220
        when lower(concat_ws(' ', ps.title, ps.year_label, ps.topic_label)) like '%' || v_query || '%' then 120
        else 0
      end
    from public.past_paper_sets ps
    where ps.is_active
      and (v_query = '' or lower(concat_ws(' ', ps.title, ps.year_label, ps.topic_label)) like '%' || v_query || '%')
  ), ranked as (
    select * from candidates order by rank desc, lower(title), id limit v_limit
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'query', v_query,
    'results', coalesce(jsonb_agg(jsonb_build_object(
      'kind', r.kind,
      'id', r.id,
      'level', r.level,
      'area', r.area,
      'sub', r.sub,
      'title', r.title,
      'type', r.type,
      'itemCount', r.item_count
    ) order by r.rank desc, lower(r.title), r.id), '[]'::jsonb)
  ) into v_result
  from ranked r;

  return v_result;
end;
$$;

create or replace function public.app_clear_assessment_drafts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  delete from public.user_assessment_progress where user_id = auth.uid();
  get diagnostics v_count = row_count;
  return jsonb_build_object('drafts', v_count);
end;
$$;

drop policy if exists questions_read_active_access on public.questions;
drop policy if exists quiz_attempts_insert_own_active_access on public.quiz_attempts;
revoke select on table public.questions from authenticated;
revoke insert on table public.quiz_attempts from authenticated;
revoke usage, select on sequence public.quiz_attempts_id_seq from authenticated, anon;
revoke execute on function public.app_quiz_questions(uuid) from public, anon, authenticated;
revoke execute on function public.app_quiz_session(uuid, text) from public, anon, authenticated;

revoke all on table public.quiz_attempt_answers from public, anon, authenticated;
grant select on table public.quiz_attempt_answers to authenticated;
grant all on table public.quiz_attempt_answers to service_role;

revoke all on function public.app_shell_bootstrap_v2() from public;
revoke all on function public.app_home_bootstrap_v2() from public;
revoke all on function public.app_quiz_session_v2(uuid, text) from public;
revoke all on function public.app_check_quiz_answer(uuid, uuid, text) from public;
revoke all on function public.app_submit_quiz_attempt(uuid, uuid, jsonb, text, integer, boolean, boolean) from public;
revoke all on function public.app_quiz_attempt_review(bigint) from public;
revoke all on function public.app_submit_past_paper_attempt_v2(uuid, uuid, jsonb, integer, boolean, boolean) from public;
revoke all on function public.app_past_paper_attempt_review_v2(bigint) from public;
revoke all on function public.app_attempt_history(integer, timestamptz, text, text, text, text, text, timestamptz, timestamptz) from public;
revoke all on function public.app_learning_search(text, integer) from public;
revoke all on function public.app_clear_assessment_drafts() from public;

grant execute on function public.app_shell_bootstrap_v2() to authenticated, service_role;
grant execute on function public.app_home_bootstrap_v2() to authenticated, service_role;
grant execute on function public.app_quiz_session_v2(uuid, text) to authenticated, service_role;
grant execute on function public.app_check_quiz_answer(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.app_submit_quiz_attempt(uuid, uuid, jsonb, text, integer, boolean, boolean) to authenticated, service_role;
grant execute on function public.app_quiz_attempt_review(bigint) to authenticated, service_role;
grant execute on function public.app_submit_past_paper_attempt_v2(uuid, uuid, jsonb, integer, boolean, boolean) to authenticated, service_role;
grant execute on function public.app_past_paper_attempt_review_v2(bigint) to authenticated, service_role;
grant execute on function public.app_attempt_history(integer, timestamptz, text, text, text, text, text, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.app_learning_search(text, integer) to authenticated, service_role;
grant execute on function public.app_clear_assessment_drafts() to authenticated, service_role;

commit;
