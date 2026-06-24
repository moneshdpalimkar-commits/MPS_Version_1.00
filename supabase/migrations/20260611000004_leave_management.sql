-- 1. Upgrade check constraints for leave types to allow 'earned'
alter table public.leave_requests drop constraint if exists leave_requests_leave_type_check;
alter table public.leave_requests add constraint leave_requests_leave_type_check 
  check (leave_type in ('sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid'));

alter table public.leave_balances drop constraint if exists leave_balances_leave_type_check;
alter table public.leave_balances add constraint leave_balances_leave_type_check 
  check (leave_type in ('sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid'));

-- 2. Create School Leave Settings Table
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

-- 3. Upgrade trigger function to sync leave approval to attendance logs
create or replace function public.update_leave_balance_on_approval()
returns trigger as $$
declare
  days_count integer;
  active_acad_year uuid;
begin
  if (new.status = 'approved' and (old.status is null or old.status <> 'approved')) then
    days_count := (new.end_date - new.start_date) + 1;
    
    -- Fetch active academic year
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
