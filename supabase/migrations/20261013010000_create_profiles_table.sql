-- Applied to project ymomfylsgfkipdnohzgp on 2026-10-13.
-- One profile per user. Users create and edit their own; nobody else can see it.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 50),
  household_size smallint not null default 4
    check (household_size between 1 and 12),
  carb_goal text not null default 'standard'
    check (carb_goal in ('standard', 'moderate', 'lower')),
  diet text[] not null default '{}'
    check (diet <@ array['vegetarian', 'gluten-free', 'high-protein', 'high-fiber', 'lower-carb']::text[]),
  preferred_store text
    check (preferred_store in ('aldi', 'walmart', 'publix')),
  zip_code text
    check (zip_code ~ '^[0-9]{5}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Basketwise user profiles: name and planner defaults.';

-- Keep updated_at current on every edit.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
