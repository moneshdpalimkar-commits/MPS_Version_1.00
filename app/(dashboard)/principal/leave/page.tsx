import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import {
  getSchoolLeavesAction,
  getSchoolLeaveSettingsAction,
} from "@/app/actions/leave-actions";
import { PrincipalLeaveClient } from "./principal-leave-client";

export const dynamic = "force-dynamic";

export default async function PrincipalLeavePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Verify Principal profile to resolve school_id
  const { data: principal } = await supabase
    .from("principals")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!principal) {
    redirect("/auth/login");
  }

  // 1. Fetch school leaves history & pending requests
  const leavesResult = await getSchoolLeavesAction();
  const requestsList = leavesResult.requests || [];

  // 2. Fetch school-wide default leave settings
  const settingsResult = await getSchoolLeaveSettingsAction(principal.school_id);
  const leaveSettings = settingsResult.settings || {
    casual_default: 10,
    sick_default: 8,
    earned_default: 5,
  };

  // 3. Fetch active staff list with their current leave balances
  const { data: staffList } = await supabase
    .from("staff")
    .select(`
      id,
      employee_id,
      first_name,
      last_name,
      designation,
      staff_role,
      departments:department_id (
        name
      ),
      leave_balances (
        id,
        leave_type,
        allocated,
        used,
        remaining
      )
    `)
    .eq("school_id", principal.school_id)
    .neq("status", "archived")
    .order("first_name", { ascending: true });

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <PrincipalLeaveClient
        schoolId={principal.school_id}
        initialRequests={requestsList}
        initialSettings={leaveSettings}
        initialStaffList={staffList || []}
      />
    </RoleGuard>
  );
}
