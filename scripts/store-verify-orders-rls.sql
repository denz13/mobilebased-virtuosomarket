-- Run in Supabase SQL Editor — lahat ng payments ⋈ items_to_cart (walang product-owner filter)
-- Pagkatapos: Settings → API → Reload schema (o hint na notify pgrst sa dulo)

-- Drop old versions (return type / args changed — required before CREATE OR REPLACE)
drop function if exists public.list_orders_for_store_verification();
drop function if exists public.verify_cart_order(bigint, text);
drop function if exists public.verify_cart_order(text, text);

-- Helper: security definer = hindi na-block ng RLS ang payment lookup sa policy
create or replace function public.cart_linked_to_any_payment(p_cart_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payments pay
    where pay.items_to_cart is not null
      and trim(p_cart_id) <> ''
      and trim(p_cart_id) = any (
        select trim(x)
        from unnest(string_to_array(pay.items_to_cart, ',')) as t(x)
        where trim(x) <> ''
      )
      and pay.deleted_at is null
  )
$$;

grant execute on function public.cart_linked_to_any_payment(text) to authenticated;

create or replace function public.list_orders_for_store_verification()
returns table (
  cart_id text,
  payment_id bigint,
  customer_users_id text,
  customer_name text,
  customer_email text,
  product_id bigint,
  product_name text,
  product_image text,
  qty text,
  total_amount text,
  cart_updated_at timestamptz,
  receipt_url text,
  payment_status text,
  cart_status text
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  return query
  select
    c.id::text,
    pay.id::bigint,
    c.users_id::text,
    nullif(trim(
      coalesce(u.raw_user_meta_data->>'first_name', '') || ' ' ||
      coalesce(u.raw_user_meta_data->>'last_name', '')
    ), ''),
    u.email::text,
    nullif(regexp_replace(trim(c.product_id::text), '[^0-9]', '', 'g'), '')::bigint,
    coalesce(p.product_name, 'Product #' || trim(c.product_id::text)),
    p.product_image,
    c.qty::text,
    c.total_amount::text,
    coalesce(pay.updated_at, c.updated_at),
    pay.receipt,
    pay.status::text,
    c.status::text
  from public.payments pay
  inner join lateral (
    select trim(x) as cart_id_txt
    from unnest(string_to_array(coalesce(pay.items_to_cart, ''), ',')) as t(x)
    where trim(x) <> ''
  ) parts on true
  inner join public.items_to_cart c on trim(c.id::text) = parts.cart_id_txt
  left join public.product p on trim(p.id::text) = trim(c.product_id::text)
  left join auth.users u on u.id::text = trim(c.users_id::text)
  where (pay.deleted_at is null or pay.deleted_at is not distinct from null)
    and (c.deleted_at is null or c.deleted_at is not distinct from null)
  order by pay.updated_at desc nulls last;
end;
$fn$;

grant execute on function public.list_orders_for_store_verification() to authenticated;

create or replace function public.verify_cart_order(p_cart_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  st text := lower(trim(coalesce(p_status, '')));
  cid text := trim(p_cart_id);
begin
  if st not in ('approved', 'declined') then
    raise exception 'Status must be approved or declined';
  end if;
  if cid = '' then
    raise exception 'Cart id required';
  end if;

  update public.items_to_cart c
  set status = st, updated_at = now()
  where trim(c.id::text) = cid
    and (c.deleted_at is null or c.deleted_at is not distinct from null);

  if not found then
    raise exception 'Cart line not found';
  end if;

  update public.payments pay
  set status = st, updated_at = now()
  where (pay.deleted_at is null or pay.deleted_at is not distinct from null)
    and exists (
      select 1
      from unnest(string_to_array(coalesce(pay.items_to_cart, ''), ',')) as t(x)
      where trim(t.x) = cid
    );
end;
$fn$;

grant execute on function public.verify_cart_order(text, text) to authenticated;

alter table public.payments enable row level security;

drop policy if exists "payments_select_under_verification" on public.payments;
drop policy if exists "payments_select_authenticated" on public.payments;
create policy "payments_select_authenticated"
on public.payments for select to authenticated
using (true);

drop policy if exists "payments_update_authenticated" on public.payments;
create policy "payments_update_authenticated"
on public.payments for update to authenticated
using (true)
with check (true);

alter table public.items_to_cart enable row level security;

drop policy if exists "items_cart_select_store_products" on public.items_to_cart;
drop policy if exists "items_cart_select_linked_payment" on public.items_to_cart;
drop policy if exists "items_cart_select_payment_link" on public.items_to_cart;

create policy "items_cart_select_payment_link"
on public.items_to_cart for select to authenticated
using (
  public.cart_linked_to_any_payment(trim(id::text))
  or auth.uid()::text = trim(users_id::text)
);

drop policy if exists "items_cart_update_linked_payment" on public.items_to_cart;
create policy "items_cart_update_linked_payment"
on public.items_to_cart for update to authenticated
using (
  public.cart_linked_to_any_payment(trim(id::text))
  or auth.uid()::text = trim(users_id::text)
)
with check (true);

notify pgrst, 'reload schema';
