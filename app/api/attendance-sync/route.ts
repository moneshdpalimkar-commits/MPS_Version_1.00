import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Service-role admin client — bypasses RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Haversine distance helper
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate via Bearer token (passed by Service Worker)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const { data: userData, error: authError } =
      await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !userData?.user) {
      return Response.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
    }
    const user = userData.user;

    // 2. Parse request body
    const body = await request.json();
    const {
      type,           // "checkin" | "checkout"
      base64Image,
      latitude,
      longitude,
      timestamp,      // original capture time (ms)
      expiresAt,      // expiry time (ms)
    } = body;

    // 3. Enforce dynamic expiry — server-side validation using system settings
    const { data: globalSettings } = await supabaseAdmin
      .from("system_settings")
      .select("session_timeout_hours")
      .limit(1)
      .maybeSingle();
    const timeoutHours = globalSettings?.session_timeout_hours ?? 24;

    const now = Date.now();
    if (!expiresAt || expiresAt <= now) {
      return Response.json(
        {
          success: false,
          error: `Attendance record has expired (max offline duration is ${timeoutHours} hours).`,
          expired: true,
        },
        { status: 410 } // 410 Gone
      );
    }

    // Use the ORIGINAL capture timestamp for attendance records, not current time
    const captureTime = new Date(timestamp);
    const dateStr = captureTime.toISOString().split("T")[0];

    // 4. Fetch staff profile
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("id, school_id, first_name, last_name, department_id, face_registered, status")
      .eq("id", user.id)
      .single();

    if (staffError || !staff) {
      return Response.json({ success: false, error: "Staff profile not found." }, { status: 404 });
    }
    if (staff.status !== "active") {
      return Response.json({ success: false, error: "Staff account is inactive." }, { status: 403 });
    }

    // 5. Fetch department for shift rules & geofence
    const { data: dept } = await supabaseAdmin
      .from("departments")
      .select("*")
      .eq("id", staff.department_id)
      .maybeSingle();

    // === CHECK-IN FLOW ===
    if (type === "checkin") {
      // Prevent duplicate check-in for the same date
      const { data: existing } = await supabaseAdmin
        .from("attendance")
        .select("id")
        .eq("staff_id", user.id)
        .eq("date", dateStr)
        .maybeSingle();

      if (existing) {
        return Response.json({
          success: false,
          error: "Attendance already recorded for this date.",
        });
      }

      // Compute attendance status from ORIGINAL capture time
      let attendanceStatus: string = "on_time";
      if (dept) {
        const [startH, startM, startS] = dept.start_time.split(":").map(Number);
        const shiftStart = new Date(captureTime);
        shiftStart.setHours(startH, startM, startS || 0, 0);

        const [endH, endM, endS] = dept.end_time.split(":").map(Number);
        const shiftEnd = new Date(captureTime);
        shiftEnd.setHours(endH, endM, endS || 0, 0);
        if (shiftEnd < shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

        const shiftDurationMs = shiftEnd.getTime() - shiftStart.getTime();

        // Validate check-in window
        const windowOffsetMins = dept.attendance_window_mins ?? 120;
        const checkInStart = new Date(shiftStart.getTime() - windowOffsetMins * 60 * 1000);
        let checkInEnd = new Date(shiftStart.getTime() + windowOffsetMins * 60 * 1000);
        const midShiftLimit = new Date(shiftStart.getTime() + shiftDurationMs / 2);

        if (checkInEnd > midShiftLimit) {
          checkInEnd = midShiftLimit;
        }

        if (captureTime < checkInStart || captureTime > checkInEnd) {
          const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return Response.json({
            success: false,
            error: `Check-in rejected: Capture time was outside the allowed check-in window (${formatTime(checkInStart)} - ${formatTime(checkInEnd)}).`
          });
        }

        const graceLimit = new Date(shiftStart.getTime() + dept.grace_period_mins * 60000);
        const lateLimit = new Date(shiftStart.getTime() + dept.late_threshold_mins * 60000);

        if (captureTime <= graceLimit) attendanceStatus = "on_time";
        else if (captureTime <= lateLimit) attendanceStatus = "late";
        else if (captureTime <= midShiftLimit) attendanceStatus = "super_late";
        else attendanceStatus = "half_day";
      }

      // Geofence check (informational — offline geofence was already client-validated)
      let distance = 0;
      if (dept?.gps_latitude && dept?.gps_longitude && latitude != null && longitude != null) {
        distance = calculateDistanceMeters(
          latitude,
          longitude,
          Number(dept.gps_latitude),
          Number(dept.gps_longitude)
        );
      }

      // Upload face snapshot
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filePath = `snapshots/${user.id}/${dateStr}_checkin.jpg`;

      await supabaseAdmin.storage
        .from("attendance-snapshots")
        .upload(filePath, buffer, { contentType: "image/jpeg", upsert: true });

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attendance-snapshots/${filePath}`;

      // Write attendance record
      const { error: dbError } = await supabaseAdmin.from("attendance").insert({
        staff_id: user.id,
        date: dateStr,
        check_in_time: captureTime.toISOString(),
        check_in_gps: { latitude: latitude ?? null, longitude: longitude ?? null, distance_meters: Math.round(distance) },
        check_in_face_verified: true,
        check_in_face_url: publicUrl,
        status: attendanceStatus,
      });

      if (dbError) {
        return Response.json({ success: false, error: dbError.message }, { status: 500 });
      }

      // Audit log
      await supabaseAdmin.from("audit_logs").insert({
        user_id: user.id,
        action: `attendance_checkin_${attendanceStatus}_synced_offline`,
        table_name: "attendance",
        new_data: { date: dateStr, offline: true, capture_time: captureTime.toISOString() },
      
      category: "attendance",});

      return Response.json({ success: true, status: attendanceStatus, offline: true });
    }

    // === CHECK-OUT FLOW ===
    if (type === "checkout") {
      const { data: log } = await supabaseAdmin
        .from("attendance")
        .select("*")
        .eq("staff_id", user.id)
        .eq("date", dateStr)
        .maybeSingle();

      if (!log) {
        return Response.json({ success: false, error: "No check-in record found for this date." });
      }
      if (log.check_out_time) {
        return Response.json({ success: false, error: "Already checked out for this date." });
      }

      // Validate check-out window
      if (dept) {
        const [startH_co, startM_co, startS_co] = dept.start_time.split(":").map(Number);
        const shiftStart_co = new Date(captureTime);
        shiftStart_co.setHours(startH_co, startM_co, startS_co || 0, 0);

        const [endH_co, endM_co, endS_co] = dept.end_time.split(":").map(Number);
        const shiftEnd_co = new Date(captureTime);
        shiftEnd_co.setHours(endH_co, endM_co, endS_co || 0, 0);
        if (shiftEnd_co < shiftStart_co) shiftEnd_co.setDate(shiftEnd_co.getDate() + 1);

        const shiftDurationMs_co = shiftEnd_co.getTime() - shiftStart_co.getTime();

        const windowOffsetMins_co = dept.attendance_window_mins ?? 120;
        let checkOutStart_co = new Date(shiftEnd_co.getTime() - windowOffsetMins_co * 60 * 1000);
        const checkOutEnd_co = new Date(shiftEnd_co.getTime() + windowOffsetMins_co * 60 * 1000);

        const midShift_co = new Date(shiftStart_co.getTime() + shiftDurationMs_co / 2);
        if (checkOutStart_co < midShift_co) {
          checkOutStart_co = midShift_co;
        }

        if (captureTime < checkOutStart_co || captureTime > checkOutEnd_co) {
          const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return Response.json({
            success: false,
            error: `Check-out rejected: Capture time was outside the allowed check-out window (${formatTime(checkOutStart_co)} - ${formatTime(checkOutEnd_co)}).`
          });
        }
      }

      // Calculate working hours from original capture time
      const checkInTime = new Date(log.check_in_time);
      const workingHours = (captureTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      let updatedStatus = log.status;
      if (workingHours < 4 && log.status !== "half_day") {
        updatedStatus = "half_day";
      }

      // Upload checkout face snapshot
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filePath = `snapshots/${user.id}/${dateStr}_checkout.jpg`;

      await supabaseAdmin.storage
        .from("attendance-snapshots")
        .upload(filePath, buffer, { contentType: "image/jpeg", upsert: true });

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attendance-snapshots/${filePath}`;

      let distance = 0;
      if (dept?.gps_latitude && dept?.gps_longitude && latitude != null && longitude != null) {
        distance = calculateDistanceMeters(latitude, longitude, Number(dept.gps_latitude), Number(dept.gps_longitude));
      }

      const { error: dbError } = await supabaseAdmin
        .from("attendance")
        .update({
          check_out_time: captureTime.toISOString(),
          check_out_gps: { latitude: latitude ?? null, longitude: longitude ?? null, distance_meters: Math.round(distance) },
          check_out_face_verified: true,
          check_out_face_url: publicUrl,
          status: updatedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      if (dbError) {
        return Response.json({ success: false, error: dbError.message }, { status: 500 });
      }

      await supabaseAdmin.from("audit_logs").insert({
        user_id: user.id,
        action: "attendance_checkout_synced_offline",
        table_name: "attendance",
        record_id: log.id,
        new_data: { working_hours: parseFloat(workingHours.toFixed(2)), status: updatedStatus, offline: true },
      
      category: "attendance",});

      return Response.json({ success: true, status: updatedStatus, offline: true });
    }

    return Response.json({ success: false, error: "Invalid attendance type." }, { status: 400 });
  } catch (err: any) {
    console.error("[attendance-sync] Error:", err);
    return Response.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}
