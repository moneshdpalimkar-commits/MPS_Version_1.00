import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getAnalyticsDashboardDataAction } from "@/app/actions/report-actions";
import { syncOnDemandAbsentees } from "@/app/actions/attendance-actions";
import { PrincipalReportsClient } from "./principal-reports-client";

export const dynamic = "force-dynamic";

export default async function PrincipalReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Verify Principal profile to resolve school context
  const { data: principal } = await supabase
    .from("principals")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!principal) {
    redirect("/auth/login");
  }

  // Trigger on-demand sync of absentees for all active staff in this school
  await syncOnDemandAbsentees({ schoolId: principal.school_id });

  // Fetch initial analytics data (30 days trend + leaderboard)
  const analyticsResult = await getAnalyticsDashboardDataAction();
  const initialAnalytics = analyticsResult.data || {
    avgAttendanceRate: 100,
    totalLogs: 0,
    lateCount: 0,
    attendanceTrend: [],
    statusDistribution: [],
    mostPunctual: [],
    mostAbsent: [],
  };

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <PrincipalReportsClient initialAnalytics={initialAnalytics} />
    </RoleGuard>
  );
}
