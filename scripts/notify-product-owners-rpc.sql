-- Run in Supabase SQL Editor if Order again / Buy now notifications fail.
-- Fixes customer apps that cannot read product.users_id via RLS.

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
