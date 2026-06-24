import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getPayrollHistoryAction } from "@/app/actions/payroll-actions";
import { PrincipalPayrollClient } from "./principal-payroll-client";

export const dynamic = "force-dynamic";

export default async function PrincipalPayrollPage() {
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

  // Fetch initial payroll history runs
  const historyResult = await getPayrollHistoryAction();
  const payrollHistory = historyResult.history || [];

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <PrincipalPayrollClient initialHistory={payrollHistory} />
    </RoleGuard>
  );
}
