-- 1. Add Type Column to attendance_corrections
alter table public.attendance_corrections 
  add column if not exists correction_type text not null default 'other'
  check (correction_type in ('forgot_checkout', 'wrong_attendance', 'other'));

-- 2. Clean up default constraint (optional but clean for standard operations)
alter table public.attendance_corrections alter column correction_type drop default;
