import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// Instantiate the service role admin client to bypass RLS
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

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the cron request via Bearer token
    const authHeader = request.headers.get("Authorization");
    const secret = process.env.CRON_SECRET || "super_secret_cron_token_2026_mps";

    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Resolve the target date (allows override via query param for testing)
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const targetDateStr = dateParam || new Date().toISOString().split("T")[0];

    // 3. Fetch all active staff
    const { data: staffList, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("id, school_id, department_id, first_name, last_name")
      .eq("status", "active");

    if (staffError) {
      console.error("[mark-absent] Staff query error:", staffError);
      return Response.json({ success: false, error: staffError.message }, { status: 500 });
    }

    if (!staffList || staffList.length === 0) {
      return Response.json({ success: true, message: "No active staff found.", recordsInserted: 0 });
    }

    // 4. Fetch existing attendance entries for the target date
    const { data: attendanceLogs, error: attendanceError } = await supabaseAdmin
      .from("attendance")
      .select("staff_id, status")
      .eq("date", targetDateStr);

    if (attendanceError) {
      console.error("[mark-absent] Attendance query error:", attendanceError);
      return Response.json({ success: false, error: attendanceError.message }, { status: 500 });
    }
    const markedStaffIds = new Set(attendanceLogs?.map((a) => a.staff_id) || []);

    // 5. Fetch approved leave requests covering the target date
    const { data: leaveRequests, error: leaveError } = await supabaseAdmin
      .from("leave_requests")
      .select("staff_id")
      .eq("status", "approved")
      .lte("start_date", targetDateStr)
      .gte("end_date", targetDateStr);

    if (leaveError) {
      console.error("[mark-absent] Leave query error:", leaveError);
      return Response.json({ success: false, error: leaveError.message }, { status: 500 });
    }
    const staffOnLeaveIds = new Set(leaveRequests?.map((l) => l.staff_id) || []);

    // 6. Fetch holidays covering the target date
    const { data: holidays, error: holidayError } = await supabaseAdmin
      .from("holidays")
      .select("school_id")
      .lte("start_date", targetDateStr)
      .gte("end_date", targetDateStr);

    if (holidayError) {
      console.error("[mark-absent] Holiday query error:", holidayError);
      return Response.json({ success: false, error: holidayError.message }, { status: 500 });
    }
    const holidaySchoolIds = new Set(holidays?.map((h) => h.school_id) || []);

    // 7. Determine which active staff have no attendance entries and insert appropriate records
    const attendanceInserts: any[] = [];

    for (const staff of staffList) {
      if (markedStaffIds.has(staff.id)) {
        continue;
      }

      if (holidaySchoolIds.has(staff.school_id)) {
        attendanceInserts.push({
          staff_id: staff.id,
          date: targetDateStr,
          status: "holiday",
        });
        continue;
      }

      if (staffOnLeaveIds.has(staff.id)) {
        attendanceInserts.push({
          staff_id: staff.id,
          date: targetDateStr,
          status: "on_leave",
        });
        continue;
      }

      attendanceInserts.push({
        staff_id: staff.id,
        date: targetDateStr,
        status: "absent",
      });
    }

    let insertedCount = 0;
    if (attendanceInserts.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("attendance")
        .insert(attendanceInserts);

      if (insertError) {
        console.error("[mark-absent] Insert error:", insertError);
        return Response.json({ success: false, error: insertError.message }, { status: 500 });
      }
      insertedCount = attendanceInserts.length;
    }

    // 8. Create an audit log for the action
    await supabaseAdmin.from("audit_logs").insert({
      action: "cron_mark_absent_attendance",
      table_name: "attendance",
      new_data: {
        date: targetDateStr,
        records_processed: staffList.length,
        records_inserted: insertedCount,
        absent_count: attendanceInserts.filter((a) => a.status === "absent").length,
        on_leave_count: attendanceInserts.filter((a) => a.status === "on_leave").length,
        holiday_count: attendanceInserts.filter((a) => a.status === "holiday").length,
      },
      category: "attendance",
    });

    // 9. Revalidate dashboard layouts
    revalidatePath("/staff/attendance");
    revalidatePath("/staff");
    revalidatePath("/principal/attendance");
    revalidatePath("/superadmin/analytics");

    return Response.json({
      success: true,
      message: `Successfully processed attendance for ${targetDateStr}. Created ${insertedCount} new status records.`,
      date: targetDateStr,
      recordsInserted: insertedCount,
    });
  } catch (err: any) {
    console.error("[mark-absent] Server error:", err);
    return Response.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
