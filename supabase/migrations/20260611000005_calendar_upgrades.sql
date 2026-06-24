-- 1. Upgrade holidays table to support Indian/Custom classification
alter table public.holidays 
  add column if not exists holiday_type text not null default 'custom'
  check (holiday_type in ('indian', 'custom'));

alter table public.holidays alter column holiday_type drop default;

-- 2. Upgrade events table to support categories
alter table public.events 
  add column if not exists category text not null default 'meeting'
  check (category in ('exam', 'sports', 'meeting', 'ptm', 'annual_day'));

alter table public.events alter column category drop default;

-- 3. Trigger: Auto-Log 'holiday' in attendance table on holiday creation
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

-- 4. Trigger: Auto-Remove 'holiday' logs in attendance table on holiday deletion
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
