/*
 * Store staff notifications for Buy now / Order again.
 * Run in Supabase → SQL Editor (after notification table exists).
 *
 * STEP: Insert your store/admin Auth user UUID(s):
 *   insert into public.store_notify_recipients (users_id) values ('YOUR-STORE-UUID-HERE');
 *
 * Find UUID: Dashboard → Authentication → Users → copy user id.
 */

-- Who receives "new order" alerts
create table if not exists public.store_notify_recipients (
  users_id varchar primary key,
  created_at timestamptz not null default now()
);

alter table public.store_notify_recipients enable row level security;

drop policy if exists "store_recipients_select_auth" on public.store_notify_recipients;
create policy "store_recipients_select_auth"
on public.store_notify_recipients for select to authenticated
using (true);

-- Notify all store recipients (used by trigger)
create or replace function public.notify_store_staff(description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select users_id from public.store_notify_recipients loop
    insert into public.notification (users_id, description, status, created_at, updated_at)
    values (r.users_id, description, 'unread', now(), now());
  end loop;
end;
$$;

-- When a cart line is submitted (Buy now / Order again) → under_verification
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
    perform public.notify_store_staff(
      'New order: cart line #' || new.id::text
      || ' submitted for verification (customer ' || coalesce(new.users_id, '?') || ').'
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
