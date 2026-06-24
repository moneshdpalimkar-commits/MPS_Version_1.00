import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { AttendanceClient } from "./attendance-client";

export const dynamic = "force-dynamic";

export default async function StaffAttendancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 1. Fetch staff profile
  const { data: staff } = await supabase
    .from("staff")
    .select("face_registered, department_id, first_name, last_name, avatar_url, schools(name)")
    .eq("id", user.id)
    .single();

  if (!staff) {
    redirect("/auth/login");
  }

  // Biometrics Redirection Check:
  // If the user's face is not registered, force them to the Setup Wizard!
  if (!staff.face_registered) {
    redirect("/staff/biometrics");
  }

  let department = null;
  if (staff.department_id) {
    const { data: dept } = await supabase
      .from("departments")
      .select("*")
      .eq("id", staff.department_id)
      .single();
    department = dept;
  }

  // 2. Fetch today's check-in status
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: todayLog } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", user.id)
    .eq("date", dateStr)
    .single();

  // 3. Fetch past attendance logs (default to current month)
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: historyLogs } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  // 4. Fetch the face template (Front view) for client-side face verification reference
  const { data: frontTemplate } = await supabase
    .from("face_templates")
    .select("image_url, descriptor")
    .eq("staff_id", user.id)
    .eq("pose", "front")
    .maybeSingle();

  // 5. Fetch correction requests history
  const { data: correctionRequests } = await supabase
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

  // Fetch system settings for offline session timeout
  const { data: globalSettings } = await supabase
    .from("system_settings")
    .select("session_timeout_hours")
    .limit(1)
    .maybeSingle();
  const sessionTimeoutHours = globalSettings?.session_timeout_hours ?? 24;

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <div className="space-y-6 select-none">
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
            {(staff.schools as any)?.name || "MPS School"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Daily Check-in Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log your daily shift check-in and check-out using biometrics and geofencing verification.
          </p>
        </div>

        <AttendanceClient
          staffName={`${staff.first_name} ${staff.last_name}`}
          avatarUrl={frontTemplate?.image_url || staff.avatar_url}
          referenceDescriptor={frontTemplate?.descriptor || null}
          department={department}
          initialTodayLog={todayLog || null}
          initialHistory={historyLogs || []}
          initialCorrections={correctionRequests || []}
          sessionTimeoutHours={sessionTimeoutHours}
        />
      </div>
    </RoleGuard>
  );
}
