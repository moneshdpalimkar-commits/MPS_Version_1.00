-- 1. Alter staff table for registration tracking
alter table public.staff 
  add column if not exists face_registered boolean default false not null,
  add column if not exists face_registration_attempts integer default 0 not null;

-- 2. Create Face Templates Table
create table if not exists public.face_templates (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.staff(id) on delete cascade not null,
  pose text not null check (pose in ('front', 'left', 'right', 'up', 'down')),
  image_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_staff_pose unique (staff_id, pose)
);

-- 3. Enable RLS on face_templates
alter table public.face_templates enable row level security;

-- 4. Create RLS Policies for face_templates
create policy "Staff view own templates"
  on public.face_templates for select to authenticated
  using (staff_id = auth.uid());

create policy "Staff manage own templates"
  on public.face_templates for all to authenticated
  using (staff_id = auth.uid());

create policy "Principals view school staff templates"
  on public.face_templates for select to authenticated
  using (
    exists (
      select 1 from public.staff s
      join public.principals p on s.school_id = p.school_id
      where p.id = auth.uid() and s.id = face_templates.staff_id
    )
  );

create policy "Principals manage school staff templates"
  on public.face_templates for delete to authenticated
  using (
    exists (
      select 1 from public.staff s
      join public.principals p on s.school_id = p.school_id
      where p.id = auth.uid() and s.id = face_templates.staff_id
    )
  );

-- 5. Alter attendance table status constraint & URL columns
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check 
  check (status in ('on_time', 'late', 'super_late', 'half_day', 'absent', 'leave', 'holiday', 'present', 'on_leave'));

alter table public.attendance 
  add column if not exists check_in_face_url text,
  add column if not exists check_out_face_url text;

-- 6. Provision Storage Buckets
insert into storage.buckets (id, name, public)
values 
  ('face-templates', 'face-templates', true),
  ('attendance-snapshots', 'attendance-snapshots', true)
on conflict (id) do nothing;

-- 7. Enable storage security policies
create policy "Allow authenticated uploads to face-templates"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'face-templates');

create policy "Allow authenticated select from face-templates"
  on storage.objects for select to authenticated
  using (bucket_id = 'face-templates');

create policy "Allow authenticated uploads to attendance-snapshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance-snapshots');

create policy "Allow public read access to attendance-snapshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'attendance-snapshots');

-- 8. Recreate Staff Summary View
drop view if exists public.staff_attendance_summary;
create view public.staff_attendance_summary with (security_invoker = true) as
select
  a.staff_id,
  s.first_name || ' ' || s.last_name as staff_name,
  s.school_id,
  extract(month from a.date) as month,
  extract(year from a.date) as year,
  count(a.id) filter (where a.status in ('present', 'on_time')) as present_days,
  count(a.id) filter (where a.status in ('late', 'super_late')) as late_days,
  count(a.id) filter (where a.status = 'absent') as absent_days,
  count(a.id) filter (where a.status = 'half_day') as half_days,
  count(a.id) filter (where a.status in ('on_leave', 'leave')) as leave_days
from public.attendance a
join public.staff s on a.staff_id = s.id
group by a.staff_id, s.first_name, s.last_name, s.school_id, extract(month from a.date), extract(year from a.date);
