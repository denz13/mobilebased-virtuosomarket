/*
 * NOTIFICATIONS — run this ENTIRE file in Supabase → SQL Editor → Run once.
 * (Select ALL lines in this file and Run — NOT the filename.)
 *
 * Then run STEP B at the bottom (insert your store UUID).
 */

-- -----------------------------------------------------------------------------
-- 0) Store recipients table (run before any INSERT into store_notify_recipients)
-- -----------------------------------------------------------------------------
create table if not exists public.store_notify_recipients (
  users_id varchar primary key,
  created_at timestamptz not null default now()
);

alter table public.store_notify_recipients enable row level security;

drop policy if exists "store_recipients_select_auth" on public.store_notify_recipients;
create policy "store_recipients_select_auth"
on public.store_notify_recipients for select to authenticated
using (true);

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

-- -----------------------------------------------------------------------------
-- 1) RLS on notification
-- -----------------------------------------------------------------------------
alter table public.notification enable row level security;

drop policy if exists "notification_select_own" on public.notification;
create policy "notification_select_own"
on public.notification for select to authenticated
using (auth.uid()::text = users_id);

drop policy if exists "notification_insert_authenticated" on public.notification;
create policy "notification_insert_authenticated"
on public.notification for insert to authenticated
with check (true);

drop policy if exists "notification_update_own" on public.notification;
create policy "notification_update_own"
on public.notification for update to authenticated
using (auth.uid()::text = users_id)
with check (auth.uid()::text = users_id);

-- -----------------------------------------------------------------------------
-- 2) RPC: app calls this (bypasses RLS on insert) — returns number of rows created
-- -----------------------------------------------------------------------------
create or replace function public.create_notifications_for_users(
  p_user_ids text[],
  p_description text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.create_notifications_for_users(text[], text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) RPC: notify everyone in store_notify_recipients (used by DB trigger)
-- -----------------------------------------------------------------------------
create or replace function public.notify_store_staff_from_table(p_description text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
$$;

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
-- 4) Trigger: new order → notify store (when status → under_verification)
-- -----------------------------------------------------------------------------
create or replace function public.tf_items_cart_notify_store_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'under_verification'
     and coalesce(old.status, '') is distinct from new.status then
    perform public.notify_store_staff_from_table(
      'New order: cart line #' || new.id::text
      || ' submitted for verification.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_items_cart_notify_store_submitted on public.items_to_cart;
create trigger tr_items_cart_notify_store_submitted
after update on public.items_to_cart
for each row
execute procedure public.tf_items_cart_notify_store_submitted();

-- -----------------------------------------------------------------------------
-- 5) Trigger: approved / declined → notify customer
-- -----------------------------------------------------------------------------
create or replace function public.tf_items_cart_notify_customer_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.users_id is not null then
    if new.status = 'approved' and coalesce(old.status, '') is distinct from new.status then
      insert into public.notification (users_id, description, status, created_at, updated_at)
      values (
        new.users_id,
        'Your order (cart #' || new.id::text || ') has been approved.',
        'unread',
        now(),
        now()
      );
    elsif new.status = 'declined' and coalesce(old.status, '') is distinct from new.status then
      insert into public.notification (users_id, description, status, created_at, updated_at)
      values (
        new.users_id,
        'Your order (cart #' || new.id::text || ') was declined.',
        'unread',
        now(),
        now()
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_items_cart_customer_status_notify on public.items_to_cart;
create trigger tr_items_cart_customer_status_notify
after update on public.items_to_cart
for each row
execute procedure public.tf_items_cart_notify_customer_status();

-- =============================================================================
-- STEP B — Run in a NEW query AFTER the script above succeeds (replace UUID):
-- =============================================================================
-- insert into public.store_notify_recipients (users_id)
-- values ('PASTE-STORE-AUTH-UUID-HERE')
-- on conflict (users_id) do nothing;
--
-- Test:
-- select public.notify_store_staff_from_table('Test from SQL');
