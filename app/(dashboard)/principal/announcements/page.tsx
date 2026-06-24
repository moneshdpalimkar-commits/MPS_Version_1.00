import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { getAnnouncementsAction } from "@/app/actions/announcement-actions";
import { PrincipalAnnouncementsClient } from "./principal-announcements-client";

export const dynamic = "force-dynamic";

export default async function PrincipalAnnouncementsPage() {
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

  // Fetch initial announcements
  const announcementsResult = await getAnnouncementsAction();
  const announcementsList = announcementsResult.announcements || [];

  // Fetch departments list for selection dropdown
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("school_id", principal.school_id)
    .order("name", { ascending: true });

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <PrincipalAnnouncementsClient
        initialAnnouncements={announcementsList}
        departments={departments || []}
        schoolId={principal.school_id}
      />
    </RoleGuard>
  );
}
