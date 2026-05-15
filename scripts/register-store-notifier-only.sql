-- Run this single block in Supabase SQL Editor (no IF/RETURN — avoids syntax errors).

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
