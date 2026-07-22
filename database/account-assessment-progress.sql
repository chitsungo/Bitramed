-- Cross-device assessment progress for signed-in learners.
-- Run this migration once in Supabase before deploying the matching frontend.

create table if not exists public.user_assessment_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_kind text not null,
  assessment_id text not null,
  progress_key text not null,
  mode text not null default 'study',
  duration_minutes integer,
  negative_marking boolean not null default false,
  context jsonb not null default '{}'::jsonb,
  progress_data jsonb not null default '{}'::jsonb,
  timer_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, assessment_kind, assessment_id, progress_key),
  constraint user_assessment_progress_kind_check
    check (assessment_kind in ('quiz', 'past_paper')),
  constraint user_assessment_progress_mode_check
    check (mode in ('study', 'exam')),
  constraint user_assessment_progress_id_check
    check (length(trim(assessment_id)) between 1 and 200),
  constraint user_assessment_progress_key_check
    check (length(trim(progress_key)) between 1 and 100),
  constraint user_assessment_progress_duration_check
    check (duration_minutes is null or duration_minutes between 1 and 1440),
  constraint user_assessment_progress_context_check
    check (jsonb_typeof(context) = 'object'),
  constraint user_assessment_progress_data_check
    check (jsonb_typeof(progress_data) = 'object')
);

create index if not exists user_assessment_progress_updated_idx
  on public.user_assessment_progress (user_id, updated_at desc);

create or replace function public.set_user_assessment_progress_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_user_assessment_progress_updated_at
  on public.user_assessment_progress;

create trigger set_user_assessment_progress_updated_at
before update on public.user_assessment_progress
for each row execute function public.set_user_assessment_progress_updated_at();

alter table public.user_assessment_progress enable row level security;

drop policy if exists "Learners can read their assessment progress"
  on public.user_assessment_progress;
create policy "Learners can read their assessment progress"
  on public.user_assessment_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Learners can create their assessment progress"
  on public.user_assessment_progress;
create policy "Learners can create their assessment progress"
  on public.user_assessment_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Learners can update their assessment progress"
  on public.user_assessment_progress;
create policy "Learners can update their assessment progress"
  on public.user_assessment_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Learners can delete their assessment progress"
  on public.user_assessment_progress;
create policy "Learners can delete their assessment progress"
  on public.user_assessment_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_assessment_progress from anon;
grant select, insert, update, delete on public.user_assessment_progress
  to authenticated, service_role;
