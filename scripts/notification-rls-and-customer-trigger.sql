/*
 * Run in Supabase → SQL Editor.
 *
 * 1) RLS: users read their own rows; authenticated users can insert rows (needed so customers
 *    can create notifications for store UUIDs from the app). Tighten insert policies in production
 *    (e.g. only allow targeting IDs listed in a store_recipients table).
 *
 * 2) Trigger: when items_to_cart.status becomes approved or declined, notify the customer (users_id on the row).
 */

-- RLS
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

-- Customer alert when staff updates order status (approved / declined)
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
