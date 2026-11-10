-- ParkSmart: minimal Supabase table for the first connected prototype.
-- Run this entire script in Supabase Dashboard → SQL Editor → New query.

create table if not exists public.app_state (
    id text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Anonymous users are signed in (role: authenticated) by the frontend.
-- This is for a controlled single-admin college demo only.
drop policy if exists "Demo users can read ParkSmart state" on public.app_state;
create policy "Demo users can read ParkSmart state"
on public.app_state for select
to authenticated
using (true);

drop policy if exists "Demo users can insert ParkSmart state" on public.app_state;
create policy "Demo users can insert ParkSmart state"
on public.app_state for insert
to authenticated
with check (true);

drop policy if exists "Demo users can update ParkSmart state" on public.app_state;
create policy "Demo users can update ParkSmart state"
on public.app_state for update
to authenticated
using (true)
with check (true);
