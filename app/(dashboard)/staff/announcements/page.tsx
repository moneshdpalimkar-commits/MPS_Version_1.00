import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getAnnouncementsAction } from "@/app/actions/announcement-actions";
import { StaffAnnouncementsClient } from "./staff-announcements-client";

export const dynamic = "force-dynamic";

export default async function StaffAnnouncementsPage() {
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

  // Fetch announcements targeted to this staff
  const announcementsResult = await getAnnouncementsAction();
  const announcementsList = announcementsResult.announcements || [];

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <StaffAnnouncementsClient initialAnnouncements={announcementsList} />
    </RoleGuard>
  );
}
