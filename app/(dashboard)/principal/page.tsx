import React from "react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { PrincipalDashboardClient } from "./principal-dashboard-client";
import { syncOnDemandAbsentees } from "@/app/actions/attendance-actions";

export const dynamic = "force-dynamic";

export default async function PrincipalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let schoolId: string | null = null;
  let schoolName = "MPS School Sandbox";

  if (user) {
    const { data: principal } = await supabase
      .from("principals")
      .select("school_id, schools(name)")
      .eq("id", user.id)
      .single();

    if (principal) {
      schoolId = principal.school_id;
      schoolName = (principal.schools as any)?.name || "MPS School";
    }
  }

  const today = new Date().toISOString().split("T")[0];

  let present = 0;
  let absent = 0;
  let late = 0;
  let superLate = 0;
  let halfDay = 0;
  let leave = 0;

  let weeklyAttendance: Array<{ day: string; Rate: number }> = [];
  let arrivalTimes: Array<{ time: string; Staff: number }> = [];
  let departmentPerformance: Array<{ name: string; Present: number }> = [];

  if (schoolId) {
    // Trigger on-demand sync of absentees for all active staff in this school
    await syncOnDemandAbsentees({ schoolId });

    // 1. Query attendance records for staff members in this school for today
    const { data: todayAttendance } = await supabase
      .from("attendance")
      .select("status, check_in_time, staff!inner(school_id)")
      .eq("date", today)
      .eq("staff.school_id", schoolId);

    if (todayAttendance) {
      todayAttendance.forEach((record: any) => {
        if (record.status === "present" || record.status === "on_time") present++;
        else if (record.status === "absent") absent++;
        else if (record.status === "late" || record.status === "super_late") {
          late++;
          // Evaluate "Super Late" (check in time > 09:30 AM assuming standard 08:00 AM shift)
          if (record.check_in_time) {
            const checkInDate = new Date(record.check_in_time);
            const checkInHour = checkInDate.getHours();
            const checkInMin = checkInDate.getMinutes();
            if (checkInHour > 9 || (checkInHour === 9 && checkInMin >= 30)) {
              superLate++;
            }
          }
        } else if (record.status === "half_day") halfDay++;
        else if (record.status === "on_leave" || record.status === "leave") leave++;
      });
    }

    // Default staff count as absent fallback if no attendance has been marked today
    if (!todayAttendance || todayAttendance.length === 0) {
      const { count } = await supabase
        .from("staff")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);
      absent = count || 0;
    }

    // 2. Query weekly attendance rates (past 7 days)
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weeklyAttendanceMap: { [key: string]: { total: number; attended: number } } = {};

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: weeklyLogs } = await supabase
      .from("attendance")
      .select("date, status, staff!inner(school_id)")
      .eq("staff.school_id", schoolId)
      .gte("date", sevenDaysAgo);

    (weeklyLogs || []).forEach((log: any) => {
      if (!log.date) return;
      const parts = log.date.split("-");
      if (parts.length < 3) return;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      const dayName = daysOfWeek[dateObj.getDay()];

      if (!weeklyAttendanceMap[dayName]) {
        weeklyAttendanceMap[dayName] = { total: 0, attended: 0 };
      }
      weeklyAttendanceMap[dayName].total += 1;
      if (["present", "on_time", "late", "super_late", "half_day"].includes(log.status)) {
        weeklyAttendanceMap[dayName].attended += 1;
      }
    });

    weeklyAttendance = dayOrder
      .filter((day) => weeklyAttendanceMap[day])
      .map((day) => ({
        day,
        Rate: Math.round((weeklyAttendanceMap[day].attended / weeklyAttendanceMap[day].total) * 1000) / 10,
      }));

    // 3. Query arrival times distribution
    const { data: checkInLogs } = await supabase
      .from("attendance")
      .select("check_in_time, staff!inner(school_id)")
      .eq("staff.school_id", schoolId)
      .not("check_in_time", "is", null);

    const timeBuckets = {
      "07:30 AM": 0,
      "08:00 AM": 0,
      "08:30 AM": 0,
      "09:00 AM": 0,
      "09:30 AM+": 0,
    };

    (checkInLogs || []).forEach((log: any) => {
      if (!log.check_in_time) return;
      const time = new Date(log.check_in_time);
      const hours = time.getHours();
      const minutes = time.getMinutes();
      const minutesSinceMidnight = hours * 60 + minutes;

      if (minutesSinceMidnight <= 450) {
        timeBuckets["07:30 AM"] += 1;
      } else if (minutesSinceMidnight <= 480) {
        timeBuckets["08:00 AM"] += 1;
      } else if (minutesSinceMidnight <= 510) {
        timeBuckets["08:30 AM"] += 1;
      } else if (minutesSinceMidnight <= 540) {
        timeBuckets["09:00 AM"] += 1;
      } else {
        timeBuckets["09:30 AM+"] += 1;
      }
    });

    arrivalTimes = Object.keys(timeBuckets).map((time) => ({
      time,
      Staff: timeBuckets[time as keyof typeof timeBuckets],
    }));

    // 4. Query attendance by department
    const { data: depts } = await supabase
      .from("departments")
      .select("name")
      .eq("school_id", schoolId);

    const { data: deptAttendanceLogs } = await supabase
      .from("attendance")
      .select(`
        status,
        staff!inner(
          department_id,
          departments(name)
        )
      `)
      .eq("staff.school_id", schoolId)
      .not("staff.department_id", "is", null);

    const deptAttendanceMap: { [key: string]: { total: number; attended: number } } = {};
    (deptAttendanceLogs || []).forEach((log: any) => {
      const deptName = log.staff?.departments?.name;
      if (!deptName) return;

      if (!deptAttendanceMap[deptName]) {
        deptAttendanceMap[deptName] = { total: 0, attended: 0 };
      }
      deptAttendanceMap[deptName].total += 1;
      if (["present", "on_time", "late", "super_late", "half_day"].includes(log.status)) {
        deptAttendanceMap[deptName].attended += 1;
      }
    });

    departmentPerformance = (depts || []).map((d: any) => {
      const stats = deptAttendanceMap[d.name];
      return {
        name: d.name,
        Present: stats && stats.total > 0
          ? Math.round((stats.attended / stats.total) * 1000) / 10
          : 100, // Default to 100% if no logs yet
      };
    });
  }

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <PrincipalDashboardClient
        schoolName={schoolName}
        stats={{
          present,
          absent,
          late,
          superLate,
          halfDay,
          leave,
        }}
        weeklyAttendance={weeklyAttendance}
        arrivalTimes={arrivalTimes}
        departmentPerformance={departmentPerformance}
      />
    </RoleGuard>
  );
}
