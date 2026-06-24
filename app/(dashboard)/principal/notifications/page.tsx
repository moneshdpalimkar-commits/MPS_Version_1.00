import React from "react";
import { RoleGuard } from "@/components/shared/role-guard";
import { NotificationsClient } from "@/components/shared/notifications-client";
import { getUserNotificationsAction } from "@/app/actions/notification-actions";

export const dynamic = "force-dynamic";

export default async function PrincipalNotificationsPage() {
  const res = await getUserNotificationsAction("principal");
  const notifications = res.success ? (res.notifications ?? []) : [];
  const userId = res.success ? (res.userId ?? "") : "";

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <div className="container mx-auto px-4 py-6">
        <NotificationsClient
          initialNotifications={notifications}
          role="principal"
          userId={userId || ""}
        />
      </div>
    </RoleGuard>
  );
}
