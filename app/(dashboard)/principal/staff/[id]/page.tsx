import React from "react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { ErrorState } from "@/components/shared/error-state";
import { StaffProfileClient } from "./staff-profile-client";

interface ProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function PrincipalStaffProfilePage({ params }: ProfilePageProps) {
  const supabase = await createClient();

  // Await params segment (Next.js 15 requirement)
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // 1. Fetch Staff Profile details
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("*, departments(name)")
    .eq("id", id)
    .single();

  if (staffError || !staff) {
    return (
      <RoleGuard allowedRoles={["principal"]}>
        <div className="flex items-center justify-center min-h-[50vh] p-4">
          <ErrorState
            title="Profile Not Found"
            message="The requested staff profile does not exist or has been removed from the school directory."
            error={staffError?.message}
            className="max-w-md w-full shadow-sm bg-destructive/5 border-destructive/20"
          />
        </div>
      </RoleGuard>
    );
  }

  // 2. Fetch Leave Balances, Attendance Summaries, and Face Templates in parallel
  const [
    { data: leaveBalances },
    { data: attendanceRollups },
    { data: faceTemplates },
  ] = await Promise.all([
    supabase
      .from("leave_balances")
      .select("*")
      .eq("staff_id", id),
    supabase
      .from("staff_attendance_summary")
      .select("*")
      .eq("staff_id", id),
    supabase
      .from("face_templates")
      .select("*")
      .eq("staff_id", id),
  ]);

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <StaffProfileClient
        staff={staff}
        leaves={leaveBalances || []}
        attendance={attendanceRollups || []}
        templates={faceTemplates || []}
      />
    </RoleGuard>
  );
}
