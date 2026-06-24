-- 1. Create school_payroll_settings table
create table if not exists public.school_payroll_settings (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  standard_working_days integer not null default 30 check (standard_working_days > 0),
  late_penalty_type text not null default 'flat' check (late_penalty_type in ('flat', 'hourly')),
  late_penalty_amount numeric(12,2) not null default 0.00 check (late_penalty_amount >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_school_payroll_settings unique (school_id)
);

-- Enable RLS
alter table public.school_payroll_settings enable row level security;

-- RLS Policies for school_payroll_settings
create policy "Allow read school_payroll_settings for authenticated"
  on public.school_payroll_settings for select to authenticated
  using (true);

create policy "Allow write school_payroll_settings for principals"
  on public.school_payroll_settings for all to authenticated
  using (
    exists (
      select 1 from public.principals p
      where p.id = auth.uid() and p.school_id = school_payroll_settings.school_id
    )
  );

-- 2. Add fixed_monthly_salary to staff table
alter table public.staff 
  add column if not exists fixed_monthly_salary numeric(12,2) not null default 0.00 check (fixed_monthly_salary >= 0);

-- Sync any existing base_salary to fixed_monthly_salary if needed
update public.staff 
set fixed_monthly_salary = base_salary 
where fixed_monthly_salary = 0.00 and base_salary > 0;

-- 3. Add simple gross pay calculation fields to payslips
alter table public.payslips
  add column if not exists unpaid_leaves_count integer default 0,
  add column if not exists unpaid_leaves_deduction numeric(12,2) default 0.00 check (unpaid_leaves_deduction >= 0),
  add column if not exists late_penalties_count integer default 0,
  add column if not exists late_penalties_deduction numeric(12,2) default 0.00 check (late_penalties_deduction >= 0);
