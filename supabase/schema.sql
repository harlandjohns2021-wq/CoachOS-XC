-- CoachOS XC production cloud data foundation
-- Run this in a Supabase project SQL editor after enabling email/password auth.

create table if not exists public.coach_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_data enable row level security;

create policy "Authenticated coaches can read their own data"
on public.coach_data
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Authenticated coaches can create their own data"
on public.coach_data
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Authenticated coaches can update their own data"
on public.coach_data
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Authenticated coaches can delete their own data"
on public.coach_data
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.set_coach_data_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_data_updated_at on public.coach_data;
create trigger coach_data_updated_at
before update on public.coach_data
for each row execute function public.set_coach_data_updated_at();
