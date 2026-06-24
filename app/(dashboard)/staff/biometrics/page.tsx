import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { WizardClient } from "./wizard-client";

export const dynamic = "force-dynamic";

export default async function FaceBiometricsSetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch staff profile details from Supabase using server client
  const { data: staff } = await supabase
    .from("staff")
    .select("face_registered, face_registration_attempts, first_name")
    .eq("id", user.id)
    .single();

  if (!staff) {
    redirect("/auth/login");
  }

  // If already registered, redirect back to dashboard
  if (staff.face_registered) {
    redirect("/staff");
  }

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <div className="max-w-2xl mx-auto py-8 px-4 select-none">
        <WizardClient
          firstName={staff.first_name}
          initialAttempts={staff.face_registration_attempts}
        />
      </div>
    </RoleGuard>
  );
}
