-- Run once in Supabase SQL Editor.
-- Records which store user added each product; checkout notifies product.users_id.

alter table public.product
  add column if not exists users_id uuid references auth.users (id);

comment on column public.product.users_id is
  'Auth user (store) who created the listing; used for order notifications.';

-- Optional: backfill existing products to your store account (replace UUID):
-- update public.product set users_id = '0ca05fac-5479-4dc9-b818-1c9a14862f77' where users_id is null;

create index if not exists product_users_id_idx on public.product (users_id);
