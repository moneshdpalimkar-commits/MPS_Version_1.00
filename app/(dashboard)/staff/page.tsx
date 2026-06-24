import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserCheck, CalendarOff, CalendarClock, DollarSign, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";

export const dynamic = "force-dynamic";

export default async function StaffDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch staff profile details from Supabase using server client
  const { data: staff } = await supabase
    .from("staff")
    .select("school_id, face_registered, first_name, schools(name)")
    .eq("id", user.id)
    .single();

  if (!staff) {
    redirect("/auth/login");
  }

  const schoolName = (staff.schools as any)?.name || "MPS School";

  // Biometrics Redirection Check:
  // If face registration is not complete, redirect user to Setup Wizard!
  if (!staff.face_registered) {
    redirect("/staff/biometrics");
  }

  const today = new Date().toISOString().split("T")[0];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // --- REAL DATA QUERIES ---

  // 1. My Attendance (Month)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;

  const { data: attendanceThisMonth } = await supabase
    .from("attendance")
    .select("status")
    .eq("staff_id", user.id)
    .gte("date", startOfMonth);

  let presentCount = 0;
  let lateCount = 0;
  let totalCount = 0;

  (attendanceThisMonth || []).forEach((att) => {
    totalCount++;
    if (att.status === "present" || att.status === "on_time") {
      presentCount++;
    } else if (att.status === "late" || att.status === "super_late") {
      lateCount++;
      presentCount++;
    } else if (att.status === "half_day") {
      presentCount += 0.5;
    }
  });

  const attendanceRate = totalCount > 0
    ? `${Math.round((presentCount / totalCount) * 1000) / 10}%`
    : "100%";
  const attendanceChange = `${Math.floor(presentCount)} Present, ${lateCount} Late`;

  // 2. Leave Balance
  const { data: leaveBalances } = await supabase
    .from("leave_balances")
    .select("allocated, used, remaining")
    .eq("staff_id", user.id);

  const totalRemaining = (leaveBalances || []).reduce((sum, b) => sum + (b.remaining || 0), 0);
  const totalAllocated = (leaveBalances || []).reduce((sum, b) => sum + (b.allocated || 0), 0);

  const leaveValue = `${totalRemaining} Days`;
  const leaveChange = `${totalRemaining} of ${totalAllocated} remaining`;

  // 3. Next Holiday
  const { data: nextHoliday } = await supabase
    .from("holidays")
    .select("name, start_date")
    .eq("school_id", staff.school_id)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  let holidayValue = "No holidays";
  let holidayChange = "No upcoming holidays";

  if (nextHoliday) {
    const dateParts = nextHoliday.start_date.split("-");
    if (dateParts.length >= 3) {
      const monthName = monthNames[parseInt(dateParts[1], 10) - 1];
      const dayNum = parseInt(dateParts[2], 10);
      holidayValue = `${monthName} ${dayNum}`;
      holidayChange = nextHoliday.name;
    }
  }

  // 4. Last Month Pay
  const { data: latestPayslip } = await supabase
    .from("payslips")
    .select(`
      net_salary,
      payroll:payroll_id(month, year)
    `)
    .eq("staff_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let payValue = "₹0";
  let payChange = "No payslips generated yet";

  if (latestPayslip) {
    const payNet = Number(latestPayslip.net_salary || 0);
    const payrollObj = latestPayslip.payroll as any;
    payValue = `₹${payNet.toLocaleString()}`;
    if (payrollObj) {
      const payMonthName = monthNames[payrollObj.month - 1];
      payChange = `Paid for ${payMonthName} ${payrollObj.year}`;
    } else {
      payChange = "Paid recently";
    }
  }

  const stats = [
    { label: "My Attendance (Month)", value: attendanceRate, change: attendanceChange, icon: UserCheck },
    { label: "Leave Balance", value: leaveValue, change: leaveChange, icon: CalendarOff },
    { label: "Next Holiday", value: holidayValue, change: holidayChange, icon: CalendarClock },
    { label: "Last Month Pay", value: payValue, change: payChange, icon: DollarSign },
  ];

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <div className="space-y-6">
        {/* Title Header */}
        <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
            {schoolName}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {staff.first_name}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mark your GPS attendance, request leaves, and view payroll slips.
          </p>
        </div>

        {/* Widgets Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-5 bg-card border border-border rounded-xl shadow-xs flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  {stat.label}
                </span>
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {stat.value}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5 font-medium">
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Daily Check-in Portal Widget */}
        <div className="p-6 bg-card border border-border rounded-xl shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Biometric Check-in</h2>
              <p className="text-xs text-muted-foreground">Log your shift clock times using face recognition & geofencing verification.</p>
            </div>
          </div>
          <p className="text-sm text-foreground">
            Please make sure you are on campus before checking in. Your location coordinates and campus distance will be computed automatically.
          </p>
          <div className="flex justify-end">
            <Link href="/staff/attendance">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all cursor-pointer shadow-xs">
                Open Check-in Portal
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
