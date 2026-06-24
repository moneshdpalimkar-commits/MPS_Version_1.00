"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserRole } from "@/types/auth";

interface DashboardShellProps {
  children: React.ReactNode;
  role: UserRole;
  email: string;
  schoolName?: string;
}

export function DashboardShell({ children, role, email, schoolName }: DashboardShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar role={role} schoolName={schoolName} />

      {/* Mobile Drawer Navigation */}
      <MobileNav
        role={role}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        schoolName={schoolName}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          role={role}
          userEmail={email}
          onMenuToggle={() => setIsMobileNavOpen(true)}
          schoolName={schoolName}
        />

        {/* Dynamic Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-6 no-scrollbar">
          <div className="max-w-7xl mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
