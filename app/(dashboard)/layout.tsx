import React from "react";
import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types/auth";
import { DashboardShell } from "./dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // Safely fetch user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fallback credentials for preview/development sandboxing
  // This ensures the App Shell renders immediately for testing prior to DB Setup
  const userEmail = user?.email || "architect@mps.edu";
  const userRole = (user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "staff") as UserRole;

  let schoolName = "";
  if (user) {
    if (userRole === "principal") {
      const { data: principal } = await supabase
        .from("principals")
        .select("schools(name)")
        .eq("id", user.id)
        .single();
      schoolName = (principal?.schools as any)?.name || "";
    } else if (userRole === "staff") {
      const { data: staff } = await supabase
        .from("staff")
        .select("schools(name)")
        .eq("id", user.id)
        .single();
      schoolName = (staff?.schools as any)?.name || "";
    }
  }

  return (
    <DashboardShell role={userRole} email={userEmail} schoolName={schoolName}>
      {children}
    </DashboardShell>
  );
}
