-- Applied to project ymomfylsgfkipdnohzgp on 2026-10-13.
-- One saved weekly plan per signed-in user.
create table public.plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

revoke all on public.plans from anon;
grant select, insert, update, delete on public.plans to authenticated;

create policy "Users can read their own plan"
  on public.plans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own plan"
  on public.plans for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own plan"
  on public.plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own plan"
  on public.plans for delete to authenticated
  using ((select auth.uid()) = user_id);
