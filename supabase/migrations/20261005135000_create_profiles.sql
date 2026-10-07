-- Profiles for Quiett accounts (Apple / Google via Supabase Auth).
-- Camera/motion stay on-device; this is identity only.
-- Applied to project saplbvmhcbdflgkzbnvt via MCP; kept here for local/CLI use.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by owner"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger-only: do not expose SECURITY DEFINER via PostgREST RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, service_role;
