import React from "react";
import { RoleGuard } from "@/components/shared/role-guard";
import { AuditClient } from "./audit-client";

export const dynamic = "force-dynamic";

export default function PrincipalAuditPage() {
  return (
    <RoleGuard allowedRoles={["principal"]}>
      <AuditClient />
    </RoleGuard>
  );
}
