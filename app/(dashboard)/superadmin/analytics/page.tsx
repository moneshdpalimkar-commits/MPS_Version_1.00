import React from "react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // 1. Fetch schools and their associated staff profiles
  const { data: schoolsData } = await supabase
    .from("schools")
    .select("name, staff(id)");

  // 2. Fetch all attendance records
  const { data: attendanceLogs } = await supabase
    .from("attendance")
    .select("date, status");

  // 3. Fetch all approved payroll and corresponding payslips
  const { data: payrollLogs } = await supabase
    .from("payroll")
    .select("month, year, status, payslips(net_salary)")
    .eq("status", "approved");

  // --- DATA TRANSFORMATIONS ---

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // A. Staff Profiles per School
  const tenantStaffData = (schoolsData || []).map((school: any) => ({
    name: school.name,
    Staff: school.staff ? school.staff.length : 0,
  }));

  // B. Attendance Rates
  const attendanceByMonth: { [key: string]: { total: number; attended: number } } = {};
  (attendanceLogs || []).forEach((log: any) => {
    if (!log.date) return;
    const parts = log.date.split("-");
    if (parts.length < 2) return;
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex < 0 || monthIndex > 11) return;
    const monthName = monthNames[monthIndex];

    if (!attendanceByMonth[monthName]) {
      attendanceByMonth[monthName] = { total: 0, attended: 0 };
    }
    attendanceByMonth[monthName].total += 1;
    if (["present", "on_time", "late", "super_late", "half_day"].includes(log.status)) {
      attendanceByMonth[monthName].attended += 1;
    }
  });

  const attendanceData = Object.keys(attendanceByMonth)
    .map((name) => ({
      name,
      Rate: attendanceByMonth[name].total > 0
        ? Math.round((attendanceByMonth[name].attended / attendanceByMonth[name].total) * 1000) / 10
        : 100,
    }))
    .sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));

  // C. Monthly System-wide Payroll
  const payrollByMonth: { [key: string]: number } = {};
  (payrollLogs || []).forEach((pay: any) => {
    if (pay.month < 1 || pay.month > 12) return;
    const monthName = monthNames[pay.month - 1];

    if (!payrollByMonth[monthName]) {
      payrollByMonth[monthName] = 0;
    }
    const totalNet = pay.payslips
      ? pay.payslips.reduce((sum: number, slip: any) => sum + Number(slip.net_salary || 0), 0)
      : 0;
    payrollByMonth[monthName] += totalNet;
  });

  const payrollData = Object.keys(payrollByMonth)
    .map((name) => ({
      name,
      Budget: payrollByMonth[name],
    }))
    .sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            System Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            System-wide aggregation profiles for attendance rates, school sizes, and payroll budgets.
          </p>
        </div>

        {/* Client Charts */}
        <AnalyticsClient
          attendanceData={attendanceData}
          tenantStaffData={tenantStaffData}
          payrollData={payrollData}
        />
      </div>
    </RoleGuard>
  );
}
