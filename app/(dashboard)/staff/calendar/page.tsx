import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getCalendarDataAction } from "@/app/actions/calendar-actions";
import { StaffCalendarClient } from "./staff-calendar-client";

export const dynamic = "force-dynamic";

export default async function StaffCalendarPage() {
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
    .select("face_registered")
    .eq("id", user.id)
    .single();

  if (!staff) {
    redirect("/auth/login");
  }

  // Face registration check
  if (!staff.face_registered) {
    redirect("/staff/biometrics");
  }

  // Fetch all calendar events and holidays
  const calendarData = await getCalendarDataAction();
  const calendarItems = calendarData.items || [];

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <div className="space-y-6 select-none animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            School Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View upcoming school exams, sports matches, PTMs, annual days, and holiday schedules.
          </p>
        </div>

        <StaffCalendarClient initialItems={calendarItems} />
      </div>
    </RoleGuard>
  );
}
