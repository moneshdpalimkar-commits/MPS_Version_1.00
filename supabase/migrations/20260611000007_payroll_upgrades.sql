-- 1. RLS Policies for public.payroll table
drop policy if exists "Principals manage own school payroll" on public.payroll;

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

-- 2. RLS Policies for public.payslips table
drop policy if exists "Principals manage own school payslips" on public.payslips;
drop policy if exists "Staff view own payslips" on public.payslips;

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
