import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getCalendarDataAction } from "@/app/actions/calendar-actions";
import { PrincipalCalendarClient } from "./principal-calendar-client";

export const dynamic = "force-dynamic";

export default async function PrincipalCalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Resolve Principal profile and school
  const { data: principal } = await supabase
    .from("principals")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!principal) {
    redirect("/auth/login");
  }

  // Fetch all calendar events and holidays
  const calendarData = await getCalendarDataAction();
  const calendarItems = calendarData.items || [];

  // Fetch departments list for event creation targeting
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", principal.school_id)
    .order("name", { ascending: true });

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <PrincipalCalendarClient
        initialItems={calendarItems}
        departments={departments || []}
      />
    </RoleGuard>
  );
}
