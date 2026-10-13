-- Applied to project ymomfylsgfkipdnohzgp on 2026-10-13.
-- Roles: admin, employee, customer. One row per user; no row means customer.
create type public.app_role as enum ('admin', 'employee', 'customer');

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.user_roles is 'Basketwise access roles. Changed only by the admin edge function (service role).';

alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

create policy "Users can read their own role"
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

-- Every new account starts as a customer.
create function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user_role() from public, anon, authenticated;

create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- Existing accounts: customers, except the site owner who becomes the first admin.
insert into public.user_roles (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
update public.user_roles set role = 'admin'
  where user_id = (select id from auth.users where email = 'aroney2022@fau.edu');

-- Audit log of every action taken in the admin console. Service role only.
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  target_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

-- Sign a user out of every device by deleting their sessions. Service role only.
create function public.admin_revoke_sessions(target uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from auth.sessions where user_id = target;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke execute on function public.admin_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_sessions(uuid) to service_role;

-- Database health and usage numbers for the admin console. Service role only.
create function public.admin_system_status()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'server_time', now(),
    'postgres_version', current_setting('server_version'),
    'database_size_bytes', pg_database_size(current_database()),
    'connections', (select count(*) from pg_stat_activity where datname = current_database()),
    'max_connections', current_setting('max_connections')::int,
    'started_at', pg_postmaster_start_time(),
    'active_sessions', (select count(*) from auth.sessions where not_after is null or not_after > now()),
    'tables', jsonb_build_object(
      'profiles', (select count(*) from public.profiles),
      'plans', (select count(*) from public.plans),
      'user_roles', (select count(*) from public.user_roles),
      'admin_audit_log', (select count(*) from public.admin_audit_log)
    ),
    'popular_recipes', coalesce((
      select jsonb_agg(jsonb_build_object('recipe', recipe, 'count', n) order by n desc)
      from (
        select item ->> 'recipe' as recipe, count(*) as n
        from public.plans, jsonb_array_elements(coalesce(data -> 'plan', '[]'::jsonb)) as item
        group by 1 order by 2 desc limit 8
      ) t
    ), '[]'::jsonb),
    'diets', coalesce((
      select jsonb_object_agg(d, n) from (
        select unnest(diet) as d, count(*) as n from public.profiles group by 1
      ) t
    ), '{}'::jsonb),
    'stores', coalesce((
      select jsonb_object_agg(coalesce(preferred_store, 'cheapest'), n) from (
        select preferred_store, count(*) as n from public.profiles group by 1
      ) t
    ), '{}'::jsonb),
    'planned_meals', (select coalesce(sum(jsonb_array_length(coalesce(data -> 'plan', '[]'::jsonb))), 0) from public.plans)
  );
$$;
revoke execute on function public.admin_system_status() from public, anon, authenticated;
grant execute on function public.admin_system_status() to service_role;
