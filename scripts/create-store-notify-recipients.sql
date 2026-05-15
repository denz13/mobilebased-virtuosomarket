/*
 * Run this FIRST in Supabase → SQL Editor (copy all, then Run).
 * Then run your INSERT with your store UUID.
 */

create table if not exists public.store_notify_recipients (
  users_id varchar primary key,
  created_at timestamptz not null default now()
);

alter table public.store_notify_recipients enable row level security;

drop policy if exists "store_recipients_select_auth" on public.store_notify_recipients;
create policy "store_recipients_select_auth"
on public.store_notify_recipients for select to authenticated
using (true);

-- Store account: auto-add own UUID when app calls this (SQL language — no BEGIN/END blocks)
create or replace function public.register_store_notifier()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.store_notify_recipients (users_id)
  select auth.uid()::text
  where auth.uid() is not null
  on conflict (users_id) do nothing;
$$;

grant execute on function public.register_store_notifier() to authenticated;

-- Example (replace UUID, then uncomment and run as a second query):
-- insert into public.store_notify_recipients (users_id)
-- values ('YOUR-STORE-AUTH-UUID-HERE')
-- on conflict (users_id) do nothing;
