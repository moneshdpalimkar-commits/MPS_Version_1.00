"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification-actions";

// Instantiate the service role admin client to bypass RLS for administrative actions
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

// Helper: Haversine distance in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function parseInTimezone(timeStr: string, dateObj: Date, timezone: string = "Asia/Kolkata"): Date {
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const parts = formatter.formatToParts(dateObj);
  const map = new Map(parts.map(p => [p.type, p.value]));
  const year = Number(map.get("year"));
  const month = Number(map.get("month"));
  const day = Number(map.get("day"));

  const candidate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds || 0));
  
  const getParts = (d: Date, tz: string) => {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const pts = f.formatToParts(d);
    const m = new Map(pts.map(p => [p.type, p.value]));
    const hr = Number(m.get("hour"));
    return Date.UTC(
      Number(m.get("year")),
      Number(m.get("month")) - 1,
      Number(m.get("day")),
      hr === 24 ? 0 : hr,
      Number(m.get("minute")),
      Number(m.get("second"))
    );
  };

  const utcMs = getParts(candidate, "UTC");
  const tzMs = getParts(candidate, timezone);
  const offsetMs = tzMs - utcMs;
  
  return new Date(candidate.getTime() - offsetMs);
}

interface CheckInInput {
  base64Image: string;
  latitude?: number;
  longitude?: number;
}

export async function checkInAction(formData: CheckInInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // 1. Fetch staff profile and their department settings
        const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("id, school_id, first_name, last_name, department_id, face_registered, status")
      .eq("id", user.id)
      .single();

    if (staffError || !staff) {
      return { success: false, error: "Staff profile not found." };
    }

    if (staff.status !== "active") {
      return { success: false, error: "Your staff account is currently inactive." };
    }

    if (!staff.face_registered) {
      return { success: false, error: "You must complete face registration before checking in." };
    }

    if (!staff.department_id) {
      return { success: false, error: "No department assigned. Please contact the Principal." };
    }

    const { data: dept, error: deptError } = await supabaseAdmin
      .from("departments")
      .select("*")
      .eq("id", staff.department_id)
      .single();

    if (deptError || !dept) {
      return { success: false, error: "Assigned department configuration not found." };
    }

    // 2. Geofence validation
    let distance = 0;
    const hasGeofence = dept.gps_latitude !== null && dept.gps_longitude !== null;

    if (hasGeofence) {
      if (formData.latitude === undefined || formData.longitude === undefined) {
        return { success: false, error: "GPS coordinates are required to verify geofence rules." };
      }

      distance = calculateDistanceMeters(
        formData.latitude,
        formData.longitude,
        Number(dept.gps_latitude),
        Number(dept.gps_longitude)
      );

      if (distance > dept.gps_radius_meters) {
        // Trigger notification to the principal of this school
        const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "Staff member";
        const { data: principals } = await supabaseAdmin
          .from("principals")
          .select("id")
          .eq("school_id", staff.school_id);

        if (principals && principals.length > 0) {
          for (const principal of principals) {
            await createNotification(
              principal.id,
              "Geofence Violation Attempt",
              `${staffName} attempted to check in outside the campus geofence boundary (Distance: ${Math.round(distance)}m).`,
              "attendance"
            );
          }
        }

        return {
          success: false,
          error: `Geofence validation failed: You are outside the school boundary by ${Math.round(
            distance - dept.gps_radius_meters
          )} meters (Distance: ${Math.round(distance)}m, Allowed Radius: ${dept.gps_radius_meters}m).`,
        };
      }
    }

    // 3. Timing and status check-in calculation
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // Check if check-in already recorded for today
    const { data: existingAttendance } = await supabaseAdmin
      .from("attendance")
      .select("id")
      .eq("staff_id", user.id)
      .eq("date", dateStr)
      .single();

    if (existingAttendance) {
      return { success: false, error: "You have already checked in for today." };
    }

    // Parse shift timings relative to today's date in target timezone
    const shiftStart = parseInTimezone(dept.start_time, now);
    const shiftEnd = parseInTimezone(dept.end_time, now);
    if (shiftEnd < shiftStart) {
      shiftEnd.setTime(shiftEnd.getTime() + 24 * 60 * 60 * 1000); // Overnight shifts
    }

    const shiftDurationMs = shiftEnd.getTime() - shiftStart.getTime();

    // Validate morning check-in window
    const windowOffsetMins = dept.attendance_window_mins ?? 120;
    const checkInStart = new Date(shiftStart.getTime() - windowOffsetMins * 60 * 1000);
    let checkInEnd = new Date(shiftStart.getTime() + windowOffsetMins * 60 * 1000);

    const midShift = new Date(shiftStart.getTime() + shiftDurationMs / 2);
    if (checkInEnd > midShift) {
      checkInEnd = midShift;
    }

    if (now < checkInStart || now > checkInEnd) {
      const formatTime = (d: Date) => 
        d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      return {
        success: false,
        error: `Check-in rejected: Outside the allowed check-in window (${formatTime(checkInStart)} - ${formatTime(checkInEnd)}).`
      };
    }

    // Limits
    const graceLimit = new Date(shiftStart.getTime() + dept.grace_period_mins * 60 * 1000);
    const lateLimit = new Date(shiftStart.getTime() + dept.late_threshold_mins * 60 * 1000);
    const midShiftLimit = new Date(shiftStart.getTime() + shiftDurationMs / 2);

    let status: "on_time" | "late" | "super_late" | "half_day" = "on_time";

    if (now <= graceLimit) {
      status = "on_time";
    } else if (now <= lateLimit) {
      status = "late";
    } else if (now <= midShiftLimit) {
      status = "super_late";
    } else {
      status = "half_day";
    }

    // 4. Upload photo to Supabase storage
    const base64Data = formData.base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const filePath = `snapshots/${user.id}/${dateStr}_checkin.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("attendance-snapshots")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Photo upload failed: ${uploadError.message}` };
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attendance-snapshots/${filePath}`;

    // 5. Write to Database
    const gpsJson = {
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
      distance_meters: Math.round(distance),
    };

    const { error: dbError } = await supabaseAdmin.from("attendance").insert({
      staff_id: user.id,
      date: dateStr,
      check_in_time: now.toISOString(),
      check_in_gps: gpsJson,
      check_in_face_verified: true,
      check_in_face_url: publicUrl,
      status: status,
    });

    if (dbError) {
      return { success: false, error: `Failed to record attendance: ${dbError.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: `attendance_checkin_${status}`,
      table_name: "attendance",
      new_data: { date: dateStr, distance_meters: Math.round(distance) },
    
      category: "attendance",});

    revalidatePath("/staff/attendance");
    revalidatePath("/staff");
    return { success: true, status, checkInTime: now.toLocaleTimeString() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function checkOutAction(formData: CheckInInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // 1. Fetch staff profile & active check-in log
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("id, school_id, first_name, last_name, department_id, status")
      .eq("id", user.id)
      .single();

    if (staffError || !staff) {
      return { success: false, error: "Staff profile not found." };
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const { data: log, error: logError } = await supabaseAdmin
      .from("attendance")
      .select("*")
      .eq("staff_id", user.id)
      .eq("date", dateStr)
      .single();

    if (logError || !log) {
      return { success: false, error: "No check-in record found for today." };
    }

    if (!log.check_in_time) {
      return { success: false, error: "You cannot check out because you did not check in today." };
    }

    if (log.check_out_time) {
      return { success: false, error: "You have already checked out for today." };
    }

    // 2. Fetch department details for geofencing check
    const { data: dept } = await supabaseAdmin
      .from("departments")
      .select("*")
      .eq("id", staff.department_id)
      .single();

    if (!dept) {
      return { success: false, error: "Assigned department configuration not found." };
    }

    // Parse shift timings relative to today's date in target timezone
    const shiftStart_co = parseInTimezone(dept.start_time, now);
    const shiftEnd_co = parseInTimezone(dept.end_time, now);
    if (shiftEnd_co < shiftStart_co) {
      shiftEnd_co.setTime(shiftEnd_co.getTime() + 24 * 60 * 60 * 1000); // Overnight shifts
    }

    const shiftDurationMs_co = shiftEnd_co.getTime() - shiftStart_co.getTime();

    // Check-out window limits
    const windowOffsetMins_co = dept.attendance_window_mins ?? 120;
    let checkOutStart_co = new Date(shiftEnd_co.getTime() - windowOffsetMins_co * 60 * 1000);
    const checkOutEnd_co = new Date(shiftEnd_co.getTime() + windowOffsetMins_co * 60 * 1000);

    // Short shift overlap protection
    const midShift_co = new Date(shiftStart_co.getTime() + shiftDurationMs_co / 2);
    if (checkOutStart_co < midShift_co) {
      checkOutStart_co = midShift_co;
    }

    if (now < checkOutStart_co || now > checkOutEnd_co) {
      const formatTime = (d: Date) => 
        d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      return {
        success: false,
        error: `Check-out rejected: Outside the allowed check-out window (${formatTime(checkOutStart_co)} - ${formatTime(checkOutEnd_co)}).`
      };
    }

    let distance = 0;
    if (dept && dept.gps_latitude !== null && dept.gps_longitude !== null) {
      if (formData.latitude === undefined || formData.longitude === undefined) {
        return { success: false, error: "GPS coordinates are required to verify geofence rules." };
      }

      distance = calculateDistanceMeters(
        formData.latitude,
        formData.longitude,
        Number(dept.gps_latitude),
        Number(dept.gps_longitude)
      );

      if (distance > dept.gps_radius_meters) {
        // Trigger notification to the principal of this school
        const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "Staff member";
        const { data: principals } = await supabaseAdmin
          .from("principals")
          .select("id")
          .eq("school_id", staff.school_id);

        if (principals && principals.length > 0) {
          for (const principal of principals) {
            await createNotification(
              principal.id,
              "Geofence Violation Attempt",
              `${staffName} attempted to check out outside the campus geofence boundary (Distance: ${Math.round(distance)}m).`,
              "attendance"
            );
          }
        }

        return {
          success: false,
          error: `Geofence validation failed: You are outside the school boundary by ${Math.round(
            distance - dept.gps_radius_meters
          )} meters (Distance: ${Math.round(distance)}m, Allowed Radius: ${dept.gps_radius_meters}m).`,
        };
      }
    }

    // 3. Early check-out / working duration policy check
    // If working hours < 4 hours, set attendance status to half_day
    const checkInTime = new Date(log.check_in_time);
    const durationMs = now.getTime() - checkInTime.getTime();
    const workingHours = durationMs / (1000 * 60 * 60);

    let updatedStatus = log.status;
    if (workingHours < 4 && log.status !== "half_day") {
      updatedStatus = "half_day"; // Downgrade to half day due to early checkout
    }

    // 4. Upload photo
    const base64Data = formData.base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const filePath = `snapshots/${user.id}/${dateStr}_checkout.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("attendance-snapshots")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Photo upload failed: ${uploadError.message}` };
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attendance-snapshots/${filePath}`;

    // 5. Update Database Record
    const gpsJson = {
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
      distance_meters: Math.round(distance),
    };

    const { error: dbError } = await supabaseAdmin
      .from("attendance")
      .update({
        check_out_time: now.toISOString(),
        check_out_gps: gpsJson,
        check_out_face_verified: true,
        check_out_face_url: publicUrl,
        status: updatedStatus,
        updated_at: now.toISOString(),
      })
      .eq("id", log.id);

    if (dbError) {
      return { success: false, error: `Checkout save failed: ${dbError.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "attendance_checkout",
      table_name: "attendance",
      record_id: log.id,
      new_data: { working_hours: parseFloat(workingHours.toFixed(2)), status: updatedStatus },
    
      category: "attendance",});

    revalidatePath("/staff/attendance");
    revalidatePath("/staff");
    return { success: true, status: updatedStatus, checkOutTime: now.toLocaleTimeString() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getStaffAttendanceLogsAction(month: number, year: number) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    // Get last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: logs, error } = await supabaseAdmin
      .from("attendance")
      .select("*")
      .eq("staff_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logs: logs || [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getSchoolAttendanceLogsAction(dateStr: string, departmentId?: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify Principal role
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    let query = supabaseAdmin
      .from("attendance")
      .select(`
        *,
        staff:staff_id (
          id,
          first_name,
          last_name,
          email,
          department_id,
          designation,
          avatar_url,
          departments:department_id (
            name
          )
        )
      `)
      .eq("staff.school_id", principal.school_id)
      .eq("date", dateStr);

    if (departmentId && departmentId !== "all") {
      query = query.eq("staff.department_id", departmentId);
    }

    const { data: logs, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // Clean null staff associations due to RLS/joins filtering
    const filteredLogs = (logs || []).filter((l) => l.staff !== null);

    return { success: true, logs: filteredLogs };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function syncOnDemandAbsentees({
  schoolId,
  staffId,
}: {
  schoolId?: string | null;
  staffId?: string | null;
}) {
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // 1. Fetch active staff
    let query = supabaseAdmin
      .from("staff")
      .select("id, school_id, department_id, status, departments(*)")
      .eq("status", "active");

    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }
    if (staffId) {
      query = query.eq("id", staffId);
    }

    const { data: staffList, error: staffError } = await query;
    if (staffError || !staffList || staffList.length === 0) return { success: true };

    // 2. Fetch existing attendance entries for today
    let attendanceQuery = supabaseAdmin
      .from("attendance")
      .select("staff_id, status")
      .eq("date", dateStr);

    if (schoolId) {
      attendanceQuery = attendanceQuery.in("staff_id", staffList.map((s) => s.id));
    }
    if (staffId) {
      attendanceQuery = attendanceQuery.eq("staff_id", staffId);
    }

    const { data: attendanceLogs } = await attendanceQuery;
    const markedStaffIds = new Set(attendanceLogs?.map((a) => a.staff_id) || []);

    // 3. Fetch approved leave requests for today
    let leaveQuery = supabaseAdmin
      .from("leave_requests")
      .select("staff_id")
      .eq("status", "approved")
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);

    if (schoolId) {
      leaveQuery = leaveQuery.in("staff_id", staffList.map((s) => s.id));
    }
    if (staffId) {
      leaveQuery = leaveQuery.eq("staff_id", staffId);
    }

    const { data: leaveRequests } = await leaveQuery;
    const staffOnLeaveIds = new Set(leaveRequests?.map((l) => l.staff_id) || []);

    // 4. Fetch holidays covering today
    const schoolIds = Array.from(new Set(staffList.map((s) => s.school_id)));
    const { data: holidays } = await supabaseAdmin
      .from("holidays")
      .select("school_id")
      .lte("start_date", dateStr)
      .gte("end_date", dateStr)
      .in("school_id", schoolIds);
    const holidaySchoolIds = new Set(holidays?.map((h) => h.school_id) || []);

    // 5. Determine which staff members have passed their check-in windows
    const attendanceInserts: Array<{ staff_id: string; date: string; status: string }> = [];

    for (const staff of staffList) {
      if (markedStaffIds.has(staff.id)) {
        continue;
      }

      let dept = staff.departments as unknown as {
        start_time: string;
        end_time: string;
        attendance_window_mins: number | null;
      } | null;

      if (Array.isArray(staff.departments)) {
        dept = (staff.departments as unknown[])[0] as {
          start_time: string;
          end_time: string;
          attendance_window_mins: number | null;
        } | null;
      }

      if (!dept || !dept.start_time) {
        continue;
      }

      const shiftStart = parseInTimezone(dept.start_time, now);
      const shiftEnd = parseInTimezone(dept.end_time, now);
      if (shiftEnd < shiftStart) {
        shiftEnd.setTime(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      const shiftDurationMs = shiftEnd.getTime() - shiftStart.getTime();
      const windowOffsetMins = dept.attendance_window_mins ?? 120;
      let checkInEnd = new Date(shiftStart.getTime() + windowOffsetMins * 60 * 1000);

      const midShift = new Date(shiftStart.getTime() + shiftDurationMs / 2);
      if (checkInEnd > midShift) {
        checkInEnd = midShift;
      }

      if (now > checkInEnd) {
        if (holidaySchoolIds.has(staff.school_id)) {
          attendanceInserts.push({
            staff_id: staff.id,
            date: dateStr,
            status: "holiday",
          });
        } else if (staffOnLeaveIds.has(staff.id)) {
          attendanceInserts.push({
            staff_id: staff.id,
            date: dateStr,
            status: "on_leave",
          });
        } else {
          attendanceInserts.push({
            staff_id: staff.id,
            date: dateStr,
            status: "absent",
          });
        }
      }
    }

    if (attendanceInserts.length > 0) {
      await supabaseAdmin
        .from("attendance")
        .upsert(attendanceInserts, { onConflict: "staff_id,date" });

      await supabaseAdmin.from("audit_logs").insert({
        action: "on_demand_mark_absent",
        table_name: "attendance",
        new_data: {
          date: dateStr,
          records_inserted: attendanceInserts.length,
          trigger: schoolId ? `school_${schoolId}` : `staff_${staffId}`,
        },
        category: "attendance",
      });
    }

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("Error in syncOnDemandAbsentees:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
