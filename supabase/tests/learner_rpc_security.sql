do $$
declare
  v_can_insert boolean;
  v_can_read_answers boolean;
begin
  select has_table_privilege('authenticated', 'public.quiz_attempts', 'insert')
    into v_can_insert;
  if v_can_insert then
    raise exception 'authenticated can still insert self-scored quiz attempts';
  end if;

  select has_table_privilege('authenticated', 'public.questions', 'select')
    into v_can_read_answers;
  if v_can_read_answers then
    raise exception 'authenticated can still read raw question answer keys';
  end if;
end
$$;

do $$
declare
  v_owner uuid;
  v_quiz uuid;
  v_payload jsonb;
begin
  select user_id into v_owner from public.owner_accounts limit 1;
  select id into v_quiz from public.quizzes limit 1;
  if v_owner is null or v_quiz is null then
    raise notice 'Owner or quiz fixture unavailable; payload assertion skipped';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select public.app_quiz_session_v2(v_quiz, null) into v_payload;
  if v_payload::text ~* 'correct_answer|correctAnswer|explanation' then
    raise exception 'quiz session v2 leaked answer material';
  end if;
end
$$;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.app_submit_quiz_attempt(uuid,uuid,jsonb,text,integer,boolean,boolean)',
    'execute'
  ) then
    raise exception 'authenticated cannot execute secure quiz submission';
  end if;
end
$$;

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'app_shell_bootstrap_v2',
        'app_home_bootstrap_v2',
        'app_quiz_session_v2',
        'app_check_quiz_answer',
        'app_submit_quiz_attempt',
        'app_quiz_attempt_review',
        'app_submit_past_paper_attempt_v2',
        'app_past_paper_attempt_review_v2',
        'app_attempt_history',
        'app_learning_search',
        'app_clear_assessment_drafts'
      ])
  loop
    if not v_function.prosecdef then
      raise exception '% is not security definer', v_function.signature;
    end if;
    if not exists (
      select 1 from unnest(coalesce(v_function.proconfig, array[]::text[])) setting
      where setting like 'search_path=%'
    ) then
      raise exception '% has no fixed search path', v_function.signature;
    end if;
    if has_function_privilege('anon', v_function.signature, 'execute') then
      raise exception 'anon can execute %', v_function.signature;
    end if;
  end loop;
end
$$;

do $$
declare
  v_attempt_id bigint;
  v_attempt_user uuid;
  v_other_user uuid;
begin
  select qa.id, qa.user_id
  into v_attempt_id, v_attempt_user
  from public.quiz_attempts qa
  order by qa.id
  limit 1;

  select aa.user_id
  into v_other_user
  from public.account_access aa
  where aa.user_id <> v_attempt_user
    and aa.blocked_at is null
    and aa.access_expires_at > now()
  limit 1;

  if v_attempt_id is null or v_other_user is null then
    raise notice 'Cross-user quiz review fixture unavailable; assertion skipped';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_other_user::text, true);
  begin
    perform public.app_quiz_attempt_review(v_attempt_id);
    raise exception 'cross-user quiz review was exposed';
  exception
    when sqlstate 'P0002' then null;
  end;
end
$$;

do $$
declare
  v_attempt_id bigint;
  v_attempt_user uuid;
  v_other_user uuid;
begin
  select pa.id, pa.user_id
  into v_attempt_id, v_attempt_user
  from public.past_paper_attempts pa
  order by pa.id
  limit 1;

  select aa.user_id
  into v_other_user
  from public.account_access aa
  where aa.user_id <> v_attempt_user
    and aa.blocked_at is null
    and aa.access_expires_at > now()
  limit 1;

  if v_attempt_id is null or v_other_user is null then
    raise notice 'Cross-user past-paper review fixture unavailable; assertion skipped';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_other_user::text, true);
  begin
    perform public.app_past_paper_attempt_review_v2(v_attempt_id);
    raise exception 'cross-user past-paper review was exposed';
  exception
    when sqlstate 'P0002' then null;
  end;
end
$$;
