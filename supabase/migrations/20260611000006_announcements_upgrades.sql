-- 1. Upgrade announcements table with type and attachment name columns
alter table public.announcements 
  add column if not exists type text not null default 'general'
  check (type in ('general', 'holiday', 'meeting', 'exam', 'emergency')),
  add column if not exists attachment_name text;

alter table public.announcements alter column type drop default;

-- 2. Drop existing default policies if they exist, and create secure RLS policies
drop policy if exists "Principals manage own school announcements" on public.announcements;
drop policy if exists "Staff view targeted announcements" on public.announcements;

-- Principal management policy: full access to school announcements
create policy "Principals manage own school announcements"
  on public.announcements for all to authenticated
  using (
    exists (
      select 1 from public.principals p 
      where p.id = auth.uid() and p.school_id = announcements.school_id
    )
  )
  with check (
    exists (
      select 1 from public.principals p 
      where p.id = auth.uid() and p.school_id = announcements.school_id
    )
  );

-- Staff select policy: view only targeted school announcements
create policy "Staff view targeted announcements"
  on public.announcements for select to authenticated
  using (
    exists (
      select 1 from public.staff s
      where s.id = auth.uid() 
        and s.school_id = announcements.school_id
        and (
          announcements.audience = 'all'
          or (announcements.audience = 'teaching' and s.staff_role = 'teaching')
          or (announcements.audience = 'non-teaching' and s.staff_role in ('non-teaching', 'support'))
          or (announcements.audience = 'department' and announcements.department_id = s.department_id)
        )
    )
  );

-- 3. Create Storage Bucket for Announcements
insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true)
on conflict (id) do nothing;

-- Delete old policies to prevent collision
drop policy if exists "Allow authenticated uploads to announcements" on storage.objects;
drop policy if exists "Allow authenticated select from announcements" on storage.objects;
drop policy if exists "Allow authenticated deletes from announcements" on storage.objects;

-- Storage policies: authenticated users can insert and read
create policy "Allow authenticated uploads to announcements"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'announcements');

create policy "Allow authenticated select from announcements"
  on storage.objects for select to authenticated
  using (bucket_id = 'announcements');

create policy "Allow authenticated deletes from announcements"
  on storage.objects for delete to authenticated
  using (bucket_id = 'announcements');

-- 4. Enable Supabase Realtime for announcements
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on pr.prpubid = p.oid
    join pg_class c on pr.prrelid = c.oid
    where p.pubname = 'supabase_realtime' and c.relname = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end;
$$;
