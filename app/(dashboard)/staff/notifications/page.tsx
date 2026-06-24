import React from "react";
import { RoleGuard } from "@/components/shared/role-guard";
import { NotificationsClient } from "@/components/shared/notifications-client";
import { getUserNotificationsAction } from "@/app/actions/notification-actions";

export const dynamic = "force-dynamic";

export default async function StaffNotificationsPage() {
  const res = await getUserNotificationsAction("staff");
  const notifications = res.success ? (res.notifications ?? []) : [];
  const userId = res.success ? (res.userId ?? "") : "";

  return (
    <RoleGuard allowedRoles={["staff"]}>
      <div className="container mx-auto px-4 py-6">
        <NotificationsClient
          initialNotifications={notifications}
          role="staff"
          userId={userId || ""}
        />
      </div>
    </RoleGuard>
  );
}
