import React from "react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { StaffSettingsClient } from "./staff-settings-client";

export const dynamic = "force-dynamic";

export default async function StaffSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let staffData: any = null;

  if (user) {
    const { data } = await supabase
      .from("staff")
      .select(`
        *,
        departments:department_id (name),
        schools:school_id (name)
      `)
      .eq("id", user.id)
      .maybeSingle();

    staffData = data || null;
  }

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <StaffSettingsClient initialStaffData={staffData} />
    </RoleGuard>
  );
}
