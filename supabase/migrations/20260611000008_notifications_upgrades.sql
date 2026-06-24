-- 1. Enable RLS and define owner policies on public.notifications
drop policy if exists "Users view own notifications" on public.notifications;
drop policy if exists "Users manage own notifications" on public.notifications;
drop policy if exists "Users delete own notifications" on public.notifications;

create policy "Users view own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Users manage own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- 2. Enable Supabase Realtime for notifications table
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on pr.prpubid = p.oid
    join pg_class c on pr.prrelid = c.oid
    where p.pubname = 'supabase_realtime' and c.relname = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
