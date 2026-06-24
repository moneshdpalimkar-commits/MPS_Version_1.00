import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getStaffLeaveDashboardAction } from "@/app/actions/leave-actions";
import { LeaveClient } from "./leave-client";

export const dynamic = "force-dynamic";

export default async function StaffLeavePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Retrieve staff details
  const { data: staff } = await supabase
    .from("staff")
    .select("first_name, last_name, avatar_url, face_registered, schools(name)")
    .eq("id", user.id)
    .single();

  if (!staff) {
    redirect("/auth/login");
  }

  // Face registration check
  if (!staff.face_registered) {
    redirect("/staff/biometrics");
  }

  const dashboardData = await getStaffLeaveDashboardAction();
  const balancesList = dashboardData.balances || [];
  const requestsList = dashboardData.requests || [];

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <div className="space-y-6 select-none animate-in fade-in duration-300">
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
            {(staff.schools as any)?.name || "MPS School"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Leave Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit leave requests, view your remaining limits, and review your leave history.
          </p>
        </div>

        <LeaveClient
          staffName={`${staff.first_name} ${staff.last_name}`}
          initialBalances={balancesList}
          initialRequests={requestsList}
        />
      </div>
    </RoleGuard>
  );
}
