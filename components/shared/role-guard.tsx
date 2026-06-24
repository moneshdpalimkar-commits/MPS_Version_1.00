"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@/types/auth";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingPage } from "@/components/shared/loading-state";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { role, loading } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (!role || !allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <ErrorState
          title="Access Denied"
          message="You do not have the required permissions to view this dashboard section. If you believe this is an error, please contact your systems administrator."
          className="max-w-md w-full shadow-sm bg-destructive/5 border-destructive/20"
        />
      </div>
    );
  }

  return <>{children}</>;
}
