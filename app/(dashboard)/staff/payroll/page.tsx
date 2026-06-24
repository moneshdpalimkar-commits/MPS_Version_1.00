import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getStaffPayslipsAction } from "@/app/actions/payroll-actions";
import { StaffPayrollClient } from "./staff-payroll-client";

export const dynamic = "force-dynamic";

export default async function StaffPayrollPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Verify Staff profile
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!staff) {
    redirect("/auth/login");
  }

  // Fetch approved payslips for this staff member
  const payslipsResult = await getStaffPayslipsAction();
  const payslipsList = payslipsResult.payslips || [];

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <StaffPayrollClient initialPayslips={payslipsList} />
    </RoleGuard>
  );
}
