import React from "react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { DepartmentsClient } from "./departments-client";

export const dynamic = "force-dynamic";

export default async function PrincipalDepartmentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let schoolId: string | null = null;
  let departments: any[] = [];

  if (user) {
    const { data: principal } = await supabase
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();
    
    if (principal) {
      schoolId = principal.school_id;
      
      const { data } = await supabase
        .from("departments")
        .select("*")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });
        
      departments = data || [];
    }
  }

  // Fetch default gps radius from system_settings
  const { data: globalSettings } = await supabase
    .from("system_settings")
    .select("gps_radius_meters")
    .limit(1)
    .maybeSingle();

  const defaultGpsRadius = globalSettings?.gps_radius_meters ?? 150;

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <DepartmentsClient
        initialDepartments={departments}
        schoolId={schoolId || ""}
        defaultGpsRadius={defaultGpsRadius}
      />
    </RoleGuard>
  );
}
