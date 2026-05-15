-- =============================================================================
-- COPY THIS ENTIRE FILE into Supabase → SQL Editor → Run
-- Do NOT run a single line like: using (auth.uid()::text = users_id);
-- That causes: syntax error at or near "using"
-- =============================================================================

-- Optional: product owner column (for Order again / Buy now seller notify)
alter table public.product
  add column if not exists users_id text;

-- -----------------------------------------------------------------------------
-- STEP 1 — RLS policies (complete statements)
-- -----------------------------------------------------------------------------
alter table public.notification enable row level security;

drop policy if exists "notification_select_own" on public.notification;
create policy "notification_select_own"
  on public.notification
  for select
  to authenticated
  using ((auth.uid())::text = (users_id)::text);

drop policy if exists "notification_insert_authenticated" on public.notification;
drop policy if exists "notification_insert_own" on public.notification;
drop policy if exists "Users can insert own notifications" on public.notification;
create policy "notification_insert_authenticated"
  on public.notification
  for insert
  to authenticated
  with check (true);

drop policy if exists "notification_update_own" on public.notification;
create policy "notification_update_own"
  on public.notification
  for update
  to authenticated
  using ((auth.uid())::text = (users_id)::text)
  with check ((auth.uid())::text = (users_id)::text);

-- -----------------------------------------------------------------------------
-- STEP 2 — RPC functions (customers can notify stores; bypasses RLS)
-- -----------------------------------------------------------------------------
create or replace function public.create_notifications_for_users(
  p_user_ids text[],
  p_description text
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid text;
  n integer := 0;
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return 0;
  end if;
  foreach uid in array p_user_ids loop
    if uid is not null and length(trim(uid)) > 0 then
      insert into public.notification (users_id, description, status, created_at, updated_at)
      values (trim(uid), p_description, 'unread', now(), now());
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$fn$;

grant execute on function public.create_notifications_for_users(text[], text) to authenticated;

create or replace function public.notify_store_staff_from_table(p_description text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  n integer := 0;
begin
  for r in select users_id from public.store_notify_recipients loop
    insert into public.notification (users_id, description, status, created_at, updated_at)
    values (r.users_id, p_description, 'unread', now(), now());
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

grant execute on function public.notify_store_staff_from_table(text) to authenticated;

create or replace function public.notify_product_owners(
  p_product_ids bigint[],
  p_description text
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid text;
  n integer := 0;
begin
  if p_product_ids is not null and array_length(p_product_ids, 1) is not null then
    for uid in
      select distinct trim(p.users_id::text)
      from public.product p
      where p.id = any(p_product_ids)
        and p.users_id is not null
        and length(trim(p.users_id::text)) > 0
    loop
      insert into public.notification (users_id, description, status, created_at, updated_at)
      values (uid, p_description, 'unread', now(), now());
      n := n + 1;
    end loop;
  end if;
  if n = 0 then
    return public.notify_store_staff_from_table(p_description);
  end if;
  return n;
end;
$fn$;

grant execute on function public.notify_product_owners(bigint[], text) to authenticated;

-- -----------------------------------------------------------------------------
-- STEP 3 — Reload API schema + test (run after Step 1–2 succeed)
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- Optional test (creates rows — skip if you do not want test notifications):
-- select public.notify_store_staff_from_table('Test notification from SQL');
