import React from "react";
import { RoleGuard } from "@/components/shared/role-guard";
import { SchoolSettingsClient } from "./school-settings-client";
import { getSchoolPayrollSettingsAction } from "@/app/actions/payroll-actions";

export default async function SchoolSettings() {
  const settingsResult = await getSchoolPayrollSettingsAction();
  const settings = settingsResult.success ? settingsResult.settings : null;

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <div className="space-y-6 select-none">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            School Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure payroll standard parameters, check-in thresholds, and general profiles.
          </p>
        </div>

        <div className="p-6 border border-border rounded-2xl bg-card/50">
          <SchoolSettingsClient initialSettings={settings} />
        </div>
      </div>
    </RoleGuard>
  );
}
