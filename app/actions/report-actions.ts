"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Instantiate the service role admin client
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function getAnalyticsDashboardDataAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // 1. Get 30 Days Attendance Trend
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const trendStartDate = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: trendLogs, error: trendError } = await supabaseAdmin
      .from("attendance")
      .select(`
        date,
        status,
        staff!inner (
          school_id
        )
      `)
      .eq("staff.school_id", principal.school_id)
      .gte("date", trendStartDate);

    if (trendError) {
      return { success: false, error: `Trend calculation failed: ${trendError.message}` };
    }

    const trendGroups: Record<string, { total: number; present: number }> = {};
    for (const log of trendLogs || []) {
      const d = log.date;
      if (!trendGroups[d]) {
        trendGroups[d] = { total: 0, present: 0 };
      }
      trendGroups[d].total++;
      if (["present", "on_time", "late", "super_late", "half_day"].includes(log.status)) {
        trendGroups[d].present += log.status === "half_day" ? 0.5 : 1.0;
      }
    }

    const attendanceTrend = Object.keys(trendGroups)
      .sort()
      .map((date) => {
        const grp = trendGroups[date];
        const rate = grp.total > 0 ? (grp.present / grp.total) * 100 : 100;
        return {
          date: new Date(date).toLocaleDateString([], { month: "short", day: "numeric" }),
          rate: Number(rate.toFixed(1)),
          total: grp.total,
        };
      });

    // 2. Get Month Distribution of Statuses
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const monthStartDate = firstDayOfMonth.toISOString().split("T")[0];

    const { data: monthLogs } = await supabaseAdmin
      .from("attendance")
      .select(`
        status,
        staff!inner (
          school_id
        )
      `)
      .eq("staff.school_id", principal.school_id)
      .gte("date", monthStartDate);

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    for (const log of monthLogs || []) {
      if (["present", "on_time"].includes(log.status)) presentCount++;
      else if (["late", "super_late", "half_day"].includes(log.status)) lateCount++;
      else if (log.status === "absent") absentCount++;
      else if (["leave", "on_leave"].includes(log.status)) leaveCount++;
    }

    const statusDistribution = [
      { name: "Present", value: presentCount, fill: "var(--color-present, #10b981)" },
      { name: "Late / Partial", value: lateCount, fill: "var(--color-late, #6366f1)" },
      { name: "Absent", value: absentCount, fill: "var(--color-absent, #f43f5e)" },
      { name: "Leave", value: leaveCount, fill: "var(--color-leave, #f59e0b)" },
    ];

    const totalLogs = monthLogs?.length || 0;
    const eligibleLogs = presentCount + lateCount + absentCount;
    const avgAttendanceRate = eligibleLogs > 0 ? ((presentCount + lateCount * 0.8) / eligibleLogs) * 100 : 100;

    // 3. Leaderboards: Most Punctual & Most Absent
    const { data: summaryList } = await supabaseAdmin
      .from("staff_attendance_summary")
      .select("*")
      .eq("school_id", principal.school_id)
      .eq("month", currentMonth)
      .eq("year", currentYear);

    const mappedLeaderboard = (summaryList || []).map((s) => {
      const totalDays = Number(s.present_days) + Number(s.late_days) + Number(s.absent_days) + Number(s.half_days);
      const score = Number(s.present_days) + Number(s.late_days) + Number(s.half_days) * 0.5;
      const rate = totalDays > 0 ? (score / totalDays) * 100 : 100;
      return {
        id: s.staff_id,
        name: s.staff_name,
        absentDays: Number(s.absent_days),
        lateDays: Number(s.late_days),
        rate: Number(rate.toFixed(1)),
      };
    });

    const mostPunctual = [...mappedLeaderboard]
      .sort((a, b) => b.rate - a.rate || a.lateDays - b.lateDays)
      .slice(0, 5);

    const mostAbsent = [...mappedLeaderboard]
      .filter((s) => s.absentDays > 0)
      .sort((a, b) => b.absentDays - a.absentDays)
      .slice(0, 5);

    return {
      success: true,
      data: {
        avgAttendanceRate: Number(avgAttendanceRate.toFixed(1)),
        totalLogs,
        lateCount,
        attendanceTrend,
        statusDistribution,
        mostPunctual,
        mostAbsent,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getReportsDataAction(month: number, year: number) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    // 1. Fetch Attendance Report
    const { data: attSummary } = await supabaseAdmin
      .from("staff_attendance_summary")
      .select("*")
      .eq("school_id", principal.school_id)
      .eq("month", month)
      .eq("year", year);

    const attendanceReport = (attSummary || []).map((s) => {
      const total = Number(s.present_days) + Number(s.late_days) + Number(s.absent_days) + Number(s.half_days);
      const score = Number(s.present_days) + Number(s.late_days) + Number(s.half_days) * 0.5;
      const rate = total > 0 ? (score / total) * 100 : 100;
      return {
        staffName: s.staff_name,
        presentDays: Number(s.present_days),
        lateDays: Number(s.late_days),
        absentDays: Number(s.absent_days),
        halfDays: Number(s.half_days),
        leaveDays: Number(s.leave_days),
        rate: Number(rate.toFixed(1)),
      };
    });

    // 2. Fetch Leave Report
    const { data: staffLeaves } = await supabaseAdmin
      .from("staff")
      .select(`
        first_name,
        last_name,
        employee_id,
        designation,
        leave_balances (
          leave_type,
          allocated,
          used,
          remaining
        ),
        leave_requests (
          id,
          status
        )
      `)
      .eq("school_id", principal.school_id)
      .neq("status", "archived");

    const leaveReport = (staffLeaves || []).map((sl) => {
      const balances = sl.leave_balances || [];
      const requests = sl.leave_requests || [];
      const pendingCount = requests.filter((r: any) => r.status === "pending").length;

      const getBalance = (type: string) => {
        const bal = balances.find((b: any) => b.leave_type === type);
        return bal ? { allocated: bal.allocated, used: bal.used, remaining: bal.remaining } : { allocated: 0, used: 0, remaining: 0 };
      };

      const cl = getBalance("casual");
      const slBal = getBalance("sick");
      const el = getBalance("earned");

      return {
        staffName: `${sl.first_name} ${sl.last_name}`,
        employeeId: sl.employee_id || "N/A",
        designation: sl.designation || "Staff",
        casualAllocated: cl.allocated,
        casualUsed: cl.used,
        sickAllocated: slBal.allocated,
        sickUsed: slBal.used,
        earnedAllocated: el.allocated,
        earnedUsed: el.used,
        pendingRequests: pendingCount,
      };
    });

    // 3. Fetch Payroll Report
    const { data: payslips } = await supabaseAdmin
      .from("payslips")
      .select(`
        basic_salary,
        allowances,
        pf_deduction,
        tax_deduction,
        attendance_deduction,
        other_deductions,
        net_salary,
        payroll!inner (
          month,
          year,
          status
        ),
        staff:staff_id (
          first_name,
          last_name,
          employee_id
        )
      `)
      .eq("payroll.month", month)
      .eq("payroll.year", year)
      .eq("payroll.school_id", principal.school_id);

    const payrollReport = (payslips || []).map((p) => {
      const staffMember: any = Array.isArray(p.staff) ? p.staff[0] : p.staff;
      return {
        staffName: staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : "Unknown Staff",
        employeeId: staffMember?.employee_id || "N/A",
        basicSalary: Number(p.basic_salary),
        allowances: Number(p.allowances),
        pfDeduction: Number(p.pf_deduction),
        taxDeduction: Number(p.tax_deduction),
        attendanceDeduction: Number(p.attendance_deduction),
        otherDeductions: Number(p.other_deductions),
        netSalary: Number(p.net_salary),
      };
    });

    // 4. Fetch Department Report
    const { data: departments } = await supabaseAdmin
      .from("departments")
      .select(`
        id,
        name,
        start_time,
        end_time,
        staff (
          id
        )
      `)
      .eq("school_id", principal.school_id);

    // Fetch average attendance rates for all active staff in the school for this month
    const { data: monthlySummary } = await supabaseAdmin
      .from("staff_attendance_summary")
      .select("staff_id, present_days, late_days, absent_days, half_days")
      .eq("school_id", principal.school_id)
      .eq("month", month)
      .eq("year", year);

    // Create staff_id -> attendance_rate lookup
    const attendanceLookup: Record<string, number> = {};
    for (const s of monthlySummary || []) {
      const total = Number(s.present_days) + Number(s.late_days) + Number(s.absent_days) + Number(s.half_days);
      const score = Number(s.present_days) + Number(s.late_days) + Number(s.half_days) * 0.5;
      attendanceLookup[s.staff_id] = total > 0 ? (score / total) * 100 : 100;
    }

    // Now map departments
    const departmentReport = [];
    for (const d of departments || []) {
      const staffIds = (d.staff || []).map((s: any) => s.id);
      
      // Calculate average attendance rate for this department's staff
      let sumRates = 0;
      let countRates = 0;
      for (const sid of staffIds) {
        const rate = attendanceLookup[sid];
        if (rate !== undefined) {
          sumRates += rate;
          countRates++;
        }
      }
      const avgRate = countRates > 0 ? sumRates / countRates : 100.0;

      departmentReport.push({
        name: d.name,
        startTime: d.start_time,
        endTime: d.end_time,
        staffCount: staffIds.length,
        avgAttendance: Number(avgRate.toFixed(1)),
      });
    }

    // 5. Fetch Academic Year Report
    const { data: activeYear } = await supabaseAdmin
      .from("academic_years")
      .select("*")
      .eq("school_id", principal.school_id)
      .eq("is_active", true)
      .maybeSingle();

    const { count: totalHolidays } = await supabaseAdmin
      .from("holidays")
      .select("*", { count: "exact", head: true })
      .eq("school_id", principal.school_id);

    const { count: totalEvents } = await supabaseAdmin
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("school_id", principal.school_id);

    const academicYearReport = activeYear
      ? [
          {
            name: activeYear.name,
            startDate: activeYear.start_date,
            endDate: activeYear.end_date,
            totalHolidays: totalHolidays || 0,
            totalEvents: totalEvents || 0,
          },
        ]
      : [];

    return {
      success: true,
      reports: {
        attendance: attendanceReport,
        leave: leaveReport,
        payroll: payrollReport,
        department: departmentReport,
        academicYear: academicYearReport,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
