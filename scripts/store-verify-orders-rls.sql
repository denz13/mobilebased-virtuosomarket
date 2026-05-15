-- Run in Supabase SQL Editor — lahat ng payments ⋈ items_to_cart (walang product-owner filter)

create or replace function public.list_orders_for_store_verification()
returns table (
  cart_id bigint,
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
    c.id::bigint,
    pay.id::bigint,
    c.users_id::text,
    nullif(trim(
      coalesce(u.raw_user_meta_data->>'first_name', '') || ' ' ||
      coalesce(u.raw_user_meta_data->>'last_name', '')
    ), ''),
    u.email::text,
    p.id::bigint,
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
  inner join public.items_to_cart c on c.id::text = parts.cart_id_txt
  left join public.product p on p.id::text = trim(c.product_id::text)
  left join auth.users u on u.id::text = trim(c.users_id::text)
  where pay.deleted_at is null
    and c.deleted_at is null
  order by pay.updated_at desc;
end;
$fn$;

grant execute on function public.list_orders_for_store_verification() to authenticated;

create or replace function public.verify_cart_order(p_cart_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  st text := lower(trim(coalesce(p_status, '')));
begin
  if st not in ('approved', 'declined') then
    raise exception 'Status must be approved or declined';
  end if;

  update public.items_to_cart c
  set status = st, updated_at = now()
  where c.id = p_cart_id
    and c.deleted_at is null;

  if not found then
    raise exception 'Cart line not found';
  end if;

  update public.payments pay
  set status = st, updated_at = now()
  where pay.deleted_at is null
    and exists (
      select 1
      from unnest(string_to_array(coalesce(pay.items_to_cart, ''), ',')) as t(x)
      where trim(t.x) = p_cart_id::text
    );
end;
$fn$;

grant execute on function public.verify_cart_order(bigint, text) to authenticated;

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
create policy "items_cart_select_linked_payment"
on public.items_to_cart for select to authenticated
using (
  exists (
    select 1 from public.payments pay
    where pay.deleted_at is null
      and exists (
        select 1
        from unnest(string_to_array(coalesce(pay.items_to_cart, ''), ',')) as t(x)
        where trim(t.x) = items_to_cart.id::text
      )
  )
  or auth.uid()::text = trim(users_id::text)
);

notify pgrst, 'reload schema';
