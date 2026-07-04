import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getSchoolAttendanceLogsAction, syncOnDemandAbsentees } from "@/app/actions/attendance-actions";
import { getSchoolCorrectionRequestsAction } from "@/app/actions/correction-actions";
import { PrincipalAttendanceClient } from "./principal-attendance-client";

export const dynamic = "force-dynamic";

export default async function PrincipalAttendancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get principal profile to resolve school_id
  const { data: principal } = await supabase
    .from("principals")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!principal) {
    redirect("/auth/login");
  }

  // Fetch school departments list for filtering options
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", principal.school_id)
    .order("name", { ascending: true });

  // Trigger on-demand sync of absentees for all active staff in this school
  await syncOnDemandAbsentees({ schoolId: principal.school_id });

  // Default query to today's date YYYY-MM-DD
  const dateStr = new Date().toISOString().split("T")[0];
  const logsResult = await getSchoolAttendanceLogsAction(dateStr, "all");
  const logsList = logsResult.logs || [];

  // Fetch all correction requests for the school
  const correctionsResult = await getSchoolCorrectionRequestsAction();
  const correctionsList = correctionsResult.requests || [];

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <PrincipalAttendanceClient
        initialLogs={logsList}
        departments={departments || []}
        initialCorrections={correctionsList}
      />
    </RoleGuard>
  );
}
