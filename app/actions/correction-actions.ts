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

interface CreateRequestInput {
  attendanceId: string;
  correctionType: "forgot_checkout" | "wrong_attendance" | "other";
  correctedCheckIn?: string; // HH:MM format
  correctedCheckOut?: string; // HH:MM format
  reason: string;
}

export async function createCorrectionRequestAction(formData: CreateRequestInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 1. Enforce monthly limit of 5 correction requests
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01T00:00:00.000Z`;
    
    const { count, error: countError } = await supabaseAdmin
      .from("attendance_corrections")
      .select("*", { count: "exact", head: true })
      .eq("requested_by", user.id)
      .gte("created_at", startOfMonth);

    if (countError) {
      return { success: false, error: `Error checking monthly request count: ${countError.message}` };
    }

    if (count !== null && count >= 5) {
      return {
        success: false,
        error: "Monthly limit reached. You can only submit up to 5 attendance correction requests per calendar month.",
      };
    }

    // 2. Fetch the corresponding attendance record to get its date
    const { data: attendance, error: attError } = await supabaseAdmin
      .from("attendance")
      .select("date")
      .eq("id", formData.attendanceId)
      .single();

    if (attError || !attendance) {
      return { success: false, error: "Corresponding attendance log not found." };
    }

    const logDate = attendance.date; // YYYY-MM-DD

    // 3. Construct full timestamps for corrected check-in and check-out
    let correctedCheckInTimestamp: string | null = null;
    let correctedCheckOutTimestamp: string | null = null;

    if (formData.correctedCheckIn) {
      correctedCheckInTimestamp = new Date(`${logDate}T${formData.correctedCheckIn}:00`).toISOString();
    }
    if (formData.correctedCheckOut) {
      correctedCheckOutTimestamp = new Date(`${logDate}T${formData.correctedCheckOut}:00`).toISOString();
    }

    // 4. Insert correction request record
    const { data: correction, error: dbError } = await supabaseAdmin
      .from("attendance_corrections")
      .insert({
        attendance_id: formData.attendanceId,
        requested_by: user.id,
        corrected_check_in: correctedCheckInTimestamp,
        corrected_check_out: correctedCheckOutTimestamp,
        reason: formData.reason,
        correction_type: formData.correctionType,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      return { success: false, error: `Failed to create correction request: ${dbError.message}` };
    }

    // Log Audit
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "attendance_correction_requested",
      table_name: "attendance_corrections",
      record_id: correction.id,
      new_data: { correction_type: formData.correctionType, date: logDate },
    
      category: "attendance",});

    // Notify school principals of the new correction request
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("first_name, last_name, school_id")
      .eq("id", user.id)
      .single();

    if (staff) {
      const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "Staff member";
      const { data: principals } = await supabaseAdmin
        .from("principals")
        .select("id")
        .eq("school_id", staff.school_id);

      if (principals && principals.length > 0) {
        for (const principal of principals) {
          await createNotification(
            principal.id,
            "Attendance Correction Requested",
            `${staffName} requested an attendance correction for ${logDate}.`,
            "attendance"
          );
        }
      }
    }

    revalidatePath("/staff/attendance");
    return { success: true, countLeft: 5 - ((count || 0) + 1) };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface ProcessRequestInput {
  requestId: string;
  action: "approved" | "rejected";
}

export async function approveCorrectionRequestAction(formData: ProcessRequestInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: principal },
    } = await supabase.auth.getUser();

    if (!principal) {
      return { success: false, error: "Authentication required." };
    }

    // 1. Verify Principal role and get their school_id
    const { data: principalProfile } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", principal.id)
      .single();

    if (!principalProfile) {
      return { success: false, error: "Principal permissions required." };
    }

    // 2. Fetch the correction request with staff and department settings
    const { data: request, error: reqError } = await supabaseAdmin
      .from("attendance_corrections")
      .select(`
        *,
        attendance:attendance_id (
          id,
          date,
          status,
          check_in_time,
          check_out_time
        ),
        staff:requested_by (
          school_id,
          department_id
        )
      `)
      .eq("id", formData.requestId)
      .single();

    if (reqError || !request) {
      return { success: false, error: "Correction request not found." };
    }

    // Verify authorized access to same school
    if (request.staff?.school_id !== principalProfile.school_id) {
      return { success: false, error: "Unauthorized access: Staff belongs to another school." };
    }

    const now = new Date();

    if (formData.action === "approved") {
      // 3. Resolve department shift timings to recalculate corrected status
      let calculatedStatus = request.attendance?.status || "on_time";

      if (request.staff?.department_id) {
        const { data: dept } = await supabaseAdmin
          .from("departments")
          .select("*")
          .eq("id", request.staff.department_id)
          .single();

        if (dept) {
          // Use corrected check-in or fallback to existing check-in to recalculate status
          const checkInTimeStr = request.corrected_check_in || request.attendance?.check_in_time;
          const checkOutTimeStr = request.corrected_check_out || request.attendance?.check_out_time;

          if (checkInTimeStr) {
            const checkIn = new Date(checkInTimeStr);
            const [startH, startM, startS] = dept.start_time.split(":").map(Number);
            const shiftStart = new Date(checkIn);
            shiftStart.setHours(startH, startM, startS || 0, 0);

            const [endH, endM, endS] = dept.end_time.split(":").map(Number);
            const shiftEnd = new Date(checkIn);
            shiftEnd.setHours(endH, endM, endS || 0, 0);
            if (shiftEnd < shiftStart) {
              shiftEnd.setDate(shiftEnd.getDate() + 1);
            }

            const shiftDurationMs = shiftEnd.getTime() - shiftStart.getTime();

            const graceLimit = new Date(shiftStart.getTime() + dept.grace_period_mins * 60 * 1000);
            const lateLimit = new Date(shiftStart.getTime() + dept.late_threshold_mins * 60 * 1000);
            const midShiftLimit = new Date(shiftStart.getTime() + shiftDurationMs / 2);

            if (checkIn <= graceLimit) {
              calculatedStatus = "on_time";
            } else if (checkIn <= lateLimit) {
              calculatedStatus = "late";
            } else if (checkIn <= midShiftLimit) {
              calculatedStatus = "super_late";
            } else {
              calculatedStatus = "half_day";
            }
          }

          // Early checkout check (working hours < 4 hours triggers half_day)
          if (checkInTimeStr && checkOutTimeStr) {
            const checkIn = new Date(checkInTimeStr);
            const checkOut = new Date(checkOutTimeStr);
            const workDurationHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

            if (workDurationHours < 4) {
              calculatedStatus = "half_day";
            }
          }
        }
      }

      // 4. Update the attendance log record
      const attendanceUpdates: any = {};
      if (request.corrected_check_in) {
        attendanceUpdates.check_in_time = request.corrected_check_in;
      }
      if (request.corrected_check_out) {
        attendanceUpdates.check_out_time = request.corrected_check_out;
      }
      attendanceUpdates.status = calculatedStatus;
      attendanceUpdates.updated_at = now.toISOString();

      const { error: attUpdateError } = await supabaseAdmin
        .from("attendance")
        .update(attendanceUpdates)
        .eq("id", request.attendance_id);

      if (attUpdateError) {
        return { success: false, error: `Failed to update attendance log: ${attUpdateError.message}` };
      }
    }

    // 5. Update the correction request status
    const { error: reqUpdateError } = await supabaseAdmin
      .from("attendance_corrections")
      .update({
        status: formData.action,
        approved_by: principal.id,
        approved_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", formData.requestId);

    if (reqUpdateError) {
      return { success: false, error: `Failed to update request: ${reqUpdateError.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: principal.id,
      action: `attendance_correction_${formData.action}`,
      table_name: "attendance_corrections",
      record_id: formData.requestId,
      new_data: { action: formData.action },
    
      category: "attendance",});

    // Notify staff member of the correction decision
    const logDate = request.attendance?.date || "";
    await createNotification(
      request.requested_by,
      formData.action === "approved" ? "Correction Request Approved" : "Correction Request Rejected",
      `Your attendance correction request for ${logDate} has been ${formData.action}.`,
      "attendance"
    );

    revalidatePath("/principal/attendance");
    revalidatePath("/staff/attendance");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getStaffCorrectionRequestsAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: requests, error } = await supabaseAdmin
      .from("attendance_corrections")
      .select(`
        *,
        attendance:attendance_id (
          date,
          status
        )
      `)
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, requests: requests || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getSchoolCorrectionRequestsAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
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

    const { data: requests, error } = await supabaseAdmin
      .from("attendance_corrections")
      .select(`
        *,
        attendance:attendance_id (
          date,
          status,
          check_in_time,
          check_out_time
        ),
        staff:requested_by (
          first_name,
          last_name,
          email,
          designation,
          departments:department_id (
            name
          ),
          school_id
        )
      `)
      .eq("staff.school_id", principal.school_id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const filteredRequests = (requests || []).filter((r) => r.staff !== null);

    return { success: true, requests: filteredRequests };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
