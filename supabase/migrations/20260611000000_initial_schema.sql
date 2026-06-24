-- Enable Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. SCHOOLS
create table public.schools (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  phone text,
  email text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. ACADEMIC YEARS
create table public.academic_years (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint ck_academic_year_dates check (start_date < end_date)
);

-- 3. DEPARTMENTS
create table public.departments (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  description text,
  start_time time without time zone default '08:00:00'::time not null,
  end_time time without time zone default '14:00:00'::time not null,
  grace_period_mins integer default 15 not null,
  late_threshold_mins integer default 30 not null,
  gps_latitude numeric(9,6),
  gps_longitude numeric(9,6),
  gps_radius_meters integer default 150 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_school_department_name unique (school_id, name)
);

-- 4. PRINCIPALS
create table public.principals (
  id uuid references auth.users(id) on delete cascade primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  full_name text not null,
  email text unique not null,
  phone text,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. STAFF
create table public.staff (
  id uuid references auth.users(id) on delete cascade primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  department_id uuid references public.departments(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text unique not null,
  phone text,
  staff_role text not null check (staff_role in ('teaching', 'non-teaching', 'support')),
  join_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  base_salary numeric(12,2) not null default 0.00 check (base_salary >= 0),
  allowance numeric(12,2) not null default 0.00 check (allowance >= 0),
  pf_pct numeric(5,2) not null default 12.00 check (pf_pct between 0 and 100),
  professional_tax numeric(10,2) not null default 0.00 check (professional_tax >= 0),
  employee_id text unique,
  designation text,
  blood_group text,
  emergency_contact text,
  avatar_url text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. ATTENDANCE
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.staff(id) on delete cascade not null,
  date date not null default current_date,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  check_in_gps jsonb,
  check_out_gps jsonb,
  check_in_face_verified boolean default false,
  check_out_face_verified boolean default false,
  status text not null default 'absent' check (status in ('present', 'absent', 'late', 'half_day', 'on_leave')),
  suspicion_flags jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_staff_date_attendance unique (staff_id, date)
);

-- 7. ATTENDANCE CORRECTIONS
create table public.attendance_corrections (
  id uuid default gen_random_uuid() primary key,
  attendance_id uuid references public.attendance(id) on delete cascade not null,
  requested_by uuid references public.staff(id) on delete cascade not null,
  corrected_check_in timestamp with time zone,
  corrected_check_out timestamp with time zone,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. LEAVE REQUESTS
create table public.leave_requests (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.staff(id) on delete cascade not null,
  leave_type text not null check (leave_type in ('sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamp with time zone,
  certificate_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint ck_leave_dates check (start_date <= end_date)
);

-- 9. LEAVE BALANCES
create table public.leave_balances (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.staff(id) on delete cascade not null,
  academic_year_id uuid references public.academic_years(id) on delete cascade not null,
  leave_type text not null check (leave_type in ('sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid')),
  allocated integer not null check (allocated >= 0),
  used integer not null default 0 check (used >= 0),
  remaining integer generated always as (allocated - used) stored,
  constraint uq_staff_academic_leave unique (staff_id, academic_year_id, leave_type)
);

-- 10. HOLIDAYS
create table public.holidays (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  academic_year_id uuid references public.academic_years(id) on delete cascade not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_half_day boolean default false not null,
  holiday_type text not null check (holiday_type in ('indian', 'custom')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint ck_holiday_dates check (start_date <= end_date)
);

-- 11. EVENTS
create table public.events (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  description text,
  date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  audience text not null default 'all' check (audience in ('all', 'teaching', 'non-teaching', 'department')),
  department_id uuid references public.departments(id) on delete set null,
  category text not null check (category in ('exam', 'sports', 'meeting', 'ptm', 'annual_day')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint ck_event_times check (start_time < end_time)
);

-- 12. ANNOUNCEMENTS
create table public.announcements (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  title text not null,
  description text not null,
  type text not null check (type in ('general', 'holiday', 'meeting', 'exam', 'emergency')),
  attachment_url text,
  attachment_name text,
  audience text not null default 'all' check (audience in ('all', 'teaching', 'non-teaching', 'department')),
  department_id uuid references public.departments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 13. NOTIFICATIONS
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  read_at timestamp with time zone,
  type text not null check (type in ('attendance', 'leave', 'announcement', 'payroll')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 14. PAYROLL
create table public.payroll (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  academic_year_id uuid references public.academic_years(id) on delete cascade not null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year > 2000),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  approved_by uuid references public.principals(id) on delete set null,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_school_payroll_period unique (school_id, month, year)
);

-- 15. PAYSLIPS
create table public.payslips (
  id uuid default gen_random_uuid() primary key,
  payroll_id uuid references public.payroll(id) on delete cascade not null,
  staff_id uuid references public.staff(id) on delete cascade not null,
  basic_salary numeric(12,2) not null check (basic_salary >= 0),
  allowances numeric(12,2) not null check (allowances >= 0),
  pf_deduction numeric(12,2) not null check (pf_deduction >= 0),
  tax_deduction numeric(12,2) not null check (tax_deduction >= 0),
  attendance_deduction numeric(12,2) not null default 0.00 check (attendance_deduction >= 0),
  other_deductions numeric(12,2) not null default 0.00 check (other_deductions >= 0),
  net_salary numeric(12,2) not null check (net_salary >= 0),
  status text not null default 'draft' check (status in ('draft', 'generated', 'sent')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_payroll_staff_payslip unique (payroll_id, staff_id)
);

-- 16. AUDIT LOGS
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance & scaling
create index idx_academic_years_school on public.academic_years(school_id);
create index idx_departments_school on public.departments(school_id);
create index idx_principals_school on public.principals(school_id);
create index idx_staff_school on public.staff(school_id);
create index idx_staff_department on public.staff(department_id);

create index idx_attendance_staff_date on public.attendance(staff_id, date);
create index idx_attendance_date on public.attendance(date);

create index idx_leave_requests_staff on public.leave_requests(staff_id);
create index idx_leave_requests_status on public.leave_requests(status);
create index idx_leave_balances_staff_year on public.leave_balances(staff_id, academic_year_id);

create index idx_payroll_school_period on public.payroll(school_id, year, month);
create index idx_payslips_payroll on public.payslips(payroll_id);
create index idx_payslips_staff on public.payslips(staff_id);

create index idx_holidays_school_dates on public.holidays(school_id, start_date, end_date);
create index idx_events_school_date on public.events(school_id, date);
create index idx_announcements_school_audience on public.announcements(school_id, audience);
create index idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
create index idx_audit_logs_user_date on public.audit_logs(user_id, created_at desc);

-- Trigger: Handle updated_at timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security invoker;

create trigger tr_schools_updated_at before update on public.schools for each row execute procedure public.handle_updated_at();
create trigger tr_departments_updated_at before update on public.departments for each row execute procedure public.handle_updated_at();
create trigger tr_principals_updated_at before update on public.principals for each row execute procedure public.handle_updated_at();
create trigger tr_staff_updated_at before update on public.staff for each row execute procedure public.handle_updated_at();
create trigger tr_attendance_updated_at before update on public.attendance for each row execute procedure public.handle_updated_at();
create trigger tr_attendance_corrections_updated_at before update on public.attendance_corrections for each row execute procedure public.handle_updated_at();
create trigger tr_leave_requests_updated_at before update on public.leave_requests for each row execute procedure public.handle_updated_at();
create trigger tr_holidays_updated_at before update on public.holidays for each row execute procedure public.handle_updated_at();
create trigger tr_events_updated_at before update on public.events for each row execute procedure public.handle_updated_at();
create trigger tr_announcements_updated_at before update on public.announcements for each row execute procedure public.handle_updated_at();
create trigger tr_payroll_updated_at before update on public.payroll for each row execute procedure public.handle_updated_at();
create trigger tr_payslips_updated_at before update on public.payslips for each row execute procedure public.handle_updated_at();

-- Trigger: Auto-Update Leave Balance on Approval
create or replace function public.update_leave_balance_on_approval()
returns trigger as $$
declare
  days_count integer;
  active_acad_year uuid;
begin
  if (new.status = 'approved' and (old.status is null or old.status <> 'approved')) then
    days_count := (new.end_date - new.start_date) + 1;
    
    select id into active_acad_year 
    from public.academic_years 
    where school_id = (select school_id from public.staff where id = new.staff_id)
      and is_active = true 
    limit 1;

    -- Update balance
    if active_acad_year is not null then
      update public.leave_balances
      set used = used + days_count
      where staff_id = new.staff_id
        and academic_year_id = active_acad_year
        and leave_type = new.leave_type;
    end if;

    -- Upsert attendance logs as 'leave' for the duration
    insert into public.attendance (staff_id, date, status)
    select new.staff_id, d::date, 'leave'
    from generate_series(new.start_date::timestamp, new.end_date::timestamp, '1 day'::interval) d
    on conflict (staff_id, date) do update set status = 'leave';

  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger tr_leave_requests_balance_sync
  after update on public.leave_requests
  for each row
  execute procedure public.update_leave_balance_on_approval();

-- Views
create view public.staff_attendance_summary with (security_invoker = true) as
select
  a.staff_id,
  s.first_name || ' ' || s.last_name as staff_name,
  s.school_id,
  extract(month from a.date) as month,
  extract(year from a.date) as year,
  count(a.id) filter (where a.status = 'present') as present_days,
  count(a.id) filter (where a.status = 'late') as late_days,
  count(a.id) filter (where a.status = 'absent') as absent_days,
  count(a.id) filter (where a.status = 'half_day') as half_days,
  count(a.id) filter (where a.status = 'on_leave') as leave_days
from public.attendance a
join public.staff s on a.staff_id = s.id
group by a.staff_id, s.first_name, s.last_name, s.school_id, extract(month from a.date), extract(year from a.date);

-- Custom Function
create or replace function public.get_user_role(user_uuid uuid)
returns text as $$
begin
  if exists (select 1 from public.principals where id = user_uuid) then
    return 'principal';
  end if;
  
  if exists (select 1 from public.staff where id = user_uuid) then
    return 'staff';
  end if;

  return 'guest';
end;
$$ language plpgsql security definer;

-- Row-Level Security (RLS) Settings
alter table public.schools enable row level security;
alter table public.academic_years enable row level security;
alter table public.departments enable row level security;
alter table public.principals enable row level security;
alter table public.staff enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.holidays enable row level security;
alter table public.events enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.payroll enable row level security;
alter table public.payslips enable row level security;
alter table public.audit_logs enable row level security;

-- RLS Policies
create policy "Schools are viewable by authenticated users"
  on public.schools for select
  to authenticated
  using (true);

create policy "Departments are viewable by authenticated users in the same school"
  on public.departments for select
  to authenticated
  using (
    exists (
      select 1 from public.principals
      where principals.id = auth.uid()
        and principals.school_id = departments.school_id
    ) or exists (
      select 1 from public.staff
      where staff.id = auth.uid()
        and staff.school_id = departments.school_id
    )
  );

create policy "Departments are manageable by school principal"
  on public.departments for all
  to authenticated
  using (
    exists (
      select 1 from public.principals
      where principals.id = auth.uid()
        and principals.school_id = departments.school_id
    )
  );

create policy "Staff profiles visible to own user"
  on public.staff for select
  to authenticated
  using (auth.uid() = id);

create policy "Staff profiles viewable by school principal"
  on public.staff for select
  to authenticated
  using (
    exists (
      select 1 from public.principals
      where principals.id = auth.uid()
        and principals.school_id = staff.school_id
    )
  );

create policy "Staff profiles manageable by school principal"
  on public.staff for all
  to authenticated
  using (
    exists (
      select 1 from public.principals
      where principals.id = auth.uid()
        and principals.school_id = staff.school_id
    )
  );

create policy "Principals view own profile"
  on public.principals for select
  to authenticated
  using (id = auth.uid());

create policy "Staff view own attendance"
  on public.attendance for select
  to authenticated
  using (staff_id = auth.uid());

create policy "Staff record own attendance check-ins"
  on public.attendance for insert
  to authenticated
  with check (staff_id = auth.uid());

create policy "Principals view school attendance"
  on public.attendance for select
  to authenticated
  using (
    exists (
      select 1 from public.staff s
      join public.principals p on s.school_id = p.school_id
      where p.id = auth.uid() and s.id = attendance.staff_id
    )
  );

create policy "Principals update school attendance"
  on public.attendance for update
  to authenticated
  using (
    exists (
      select 1 from public.staff s
      join public.principals p on s.school_id = p.school_id
      where p.id = auth.uid() and s.id = attendance.staff_id
    )
  );

-- ===================================================
-- BIOMETRICS & ATTENDANCE UPGRADES PATCH (2026-06-11)
-- ===================================================

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

-- 6. Recreate Staff Summary View
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

-- ===================================================
-- ATTENDANCE CORRECTIONS PATCH (2026-06-11)
-- ===================================================

-- 1. Add Type Column to attendance_corrections
alter table public.attendance_corrections 
  add column if not exists correction_type text not null default 'other'
  check (correction_type in ('forgot_checkout', 'wrong_attendance', 'other'));

-- 2. Clean up default constraint
alter table public.attendance_corrections alter column correction_type drop default;

-- ===================================================
-- LEAVE MANAGEMENT MODULE (2026-06-11)
-- ===================================================

-- Create School Leave Settings Table
create table if not exists public.leave_settings (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  casual_default integer not null default 10 check (casual_default >= 0),
  sick_default integer not null default 8 check (sick_default >= 0),
  earned_default integer not null default 5 check (earned_default >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_school_leave_settings unique (school_id)
);

-- Enable RLS
alter table public.leave_settings enable row level security;

-- Policies for leave_settings
create policy "Leave settings are viewable by authenticated users in same school"
  on public.leave_settings for select to authenticated
  using (
    exists (
      select 1 from public.principals
      where principals.id = auth.uid() and principals.school_id = leave_settings.school_id
    ) or exists (
      select 1 from public.staff
      where staff.id = auth.uid() and staff.school_id = leave_settings.school_id
    )
  );

create policy "Leave settings are manageable by school principal"
  on public.leave_settings for all to authenticated
  using (
    exists (
      select 1 from public.principals
      where principals.id = auth.uid() and principals.school_id = leave_settings.school_id
    )
  );

-- Payroll and Payslip RLS Policies
create policy "Principals manage own school payroll"
  on public.payroll for all to authenticated
  using (
    exists (
      select 1 from public.principals p 
      where p.id = auth.uid() and p.school_id = payroll.school_id
    )
  )
  with check (
    exists (
      select 1 from public.principals p 
      where p.id = auth.uid() and p.school_id = payroll.school_id
    )
  );

create policy "Principals manage own school payslips"
  on public.payslips for all to authenticated
  using (
    exists (
      select 1 from public.payroll pr 
      join public.principals p on pr.school_id = p.school_id 
      where p.id = auth.uid() and pr.id = payslips.payroll_id
    )
  )
  with check (
    exists (
      select 1 from public.payroll pr 
      join public.principals p on pr.school_id = p.school_id 
      where p.id = auth.uid() and pr.id = payslips.payroll_id
    )
  );

create policy "Staff view own payslips"
  on public.payslips for select to authenticated
  using (staff_id = auth.uid());

-- Trigger: Auto-Log 'holiday' in attendance table on holiday creation
create or replace function public.sync_attendance_on_holiday_creation()
returns trigger as $$
declare
  active_staff_id uuid;
begin
  for active_staff_id in (
    select id from public.staff 
    where school_id = new.school_id and status = 'active'
  ) loop
    insert into public.attendance (staff_id, date, status)
    select active_staff_id, d::date, 'holiday'
    from generate_series(new.start_date::timestamp, new.end_date::timestamp, '1 day'::interval) d
    on conflict (staff_id, date) do update set status = 'holiday';
  end loop;
  return new;
end;
$$ language plpgsql security definer;

create trigger tr_holidays_attendance_sync
  after insert or update on public.holidays
  for each row
  execute procedure public.sync_attendance_on_holiday_creation();

-- Trigger: Auto-Remove 'holiday' logs in attendance table on holiday deletion
create or replace function public.cleanup_attendance_on_holiday_deletion()
returns trigger as $$
begin
  delete from public.attendance
  where status = 'holiday'
    and date >= old.start_date
    and date <= old.end_date
    and staff_id in (select id from public.staff where school_id = old.school_id);
  return old;
end;
$$ language plpgsql security definer;

create trigger tr_holidays_attendance_cleanup
  after delete on public.holidays
  for each row
  execute procedure public.cleanup_attendance_on_holiday_deletion();


-- Notifications RLS Policies
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



