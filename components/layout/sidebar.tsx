"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  School,
  Users,
  Clock,
  CalendarDays,
  Calendar,
  Megaphone,
  CircleDollarSign,
  FileText,
  Bell,
  Settings,
  LineChart,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Building,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/auth";

interface SidebarProps {
  role: UserRole;
  className?: string;
  schoolName?: string;
}

export function Sidebar({ role, className, schoolName }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  // Define navigation sections based on role
  const getNavItems = () => {
    switch (role) {
      case "superadmin":
        return [
          { title: "Dashboard", href: "/superadmin", icon: LayoutDashboard },
          { title: "Schools", href: "/superadmin/schools", icon: School },
          { title: "Analytics", href: "/superadmin/analytics", icon: LineChart },
          { title: "Notifications", href: "/superadmin/notifications", icon: Bell, badge: 3 },
          { title: "Settings", href: "/superadmin/settings", icon: Settings },
        ];
      case "principal":
        return [
          { title: "Dashboard", href: "/principal", icon: LayoutDashboard },
          { title: "Staff Directory", href: "/principal/staff", icon: Users },
          { title: "Departments", href: "/principal/departments", icon: Building },
          { title: "Attendance Logs", href: "/principal/attendance", icon: Clock },
          { title: "Leave Requests", href: "/principal/leave", icon: CalendarDays, badge: 5 },
          { title: "Calendar", href: "/principal/calendar", icon: Calendar },
          { title: "Announcements", href: "/principal/announcements", icon: Megaphone },
          { title: "Payroll", href: "/principal/payroll", icon: CircleDollarSign },
          { title: "Reports", href: "/principal/reports", icon: FileText },
          { title: "Audit Logs", href: "/principal/audit", icon: ScrollText },
          { title: "Notifications", href: "/principal/notifications", icon: Bell, badge: 2 },
          { title: "Settings", href: "/principal/settings", icon: Settings },
        ];
      case "staff":
        return [
          { title: "Dashboard", href: "/staff", icon: LayoutDashboard },
          { title: "My Attendance", href: "/staff/attendance", icon: Clock },
          { title: "My Leaves", href: "/staff/leave", icon: CalendarDays },
          { title: "School Calendar", href: "/staff/calendar", icon: Calendar },
          { title: "Announcements", href: "/staff/announcements", icon: Megaphone },
          { title: "My Payroll", href: "/staff/payroll", icon: CircleDollarSign },
          { title: "Notifications", href: "/staff/notifications", icon: Bell, badge: 1 },
          { title: "Settings", href: "/staff/settings", icon: Settings },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 76 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-sidebar text-sidebar-foreground select-none relative overflow-x-hidden flex-shrink-0 z-20",
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border overflow-hidden">
        <div className="flex items-center gap-3 w-full">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate w-full">
              <span className="font-bold text-base tracking-tight text-foreground truncate max-w-[150px]">
                MPS Portal
              </span>
              {schoolName && (
                <span className="text-[10px] text-muted-foreground font-semibold truncate max-w-[170px]" title={schoolName}>
                  {schoolName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          // Check active state
          const isActive =
            pathname === item.href ||
            (item.href !== `/${role}` && pathname.startsWith(item.href));

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative cursor-pointer",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "w-[1.2rem] h-[1.2rem] flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                  )}
                />
                {!isCollapsed && (
                  <span className="truncate flex-1">{item.title}</span>
                )}

                {/* Badge rendering */}
                {item.badge && !isCollapsed && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
                    {item.badge}
                  </span>
                )}

                {/* Tooltip on collapse */}
                {isCollapsed && (
                  <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-xs font-semibold rounded-md border border-border py-1.5 px-2.5 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-md whitespace-nowrap z-50">
                    {item.title}
                    {item.badge && (
                      <span className="ml-1.5 px-1 py-0.5 rounded-sm bg-primary/20 text-[9px] text-primary">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Collapse Action Toggler */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute bottom-4 -right-1 translate-x-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-foreground cursor-pointer shadow-xs z-30 focus:outline-hidden"
        aria-label="Toggle sidebar collapse"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </motion.aside>
  );
}
