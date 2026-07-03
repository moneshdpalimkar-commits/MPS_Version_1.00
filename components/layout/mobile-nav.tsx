"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  GraduationCap,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/auth";

interface MobileNavProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
  schoolName?: string;
}

export function MobileNav({ role, isOpen, onClose, schoolName }: MobileNavProps) {
  const pathname = usePathname();

  const getNavItems = () => {
    switch (role) {
      case "superadmin":
        return [
          { title: "Dashboard", href: "/superadmin", icon: LayoutDashboard },
          { title: "Schools", href: "/superadmin/schools", icon: School },
          { title: "Analytics", href: "/superadmin/analytics", icon: LineChart },
          { title: "Notifications", href: "/superadmin/notifications", icon: Bell },
          { title: "Settings", href: "/superadmin/settings", icon: Settings },
        ];
      case "principal":
        return [
          { title: "Dashboard", href: "/principal", icon: LayoutDashboard },
          { title: "Staff Directory", href: "/principal/staff", icon: Users },
          { title: "Departments", href: "/principal/departments", icon: Building },
          { title: "Attendance Logs", href: "/principal/attendance", icon: Clock },
          { title: "Leave Requests", href: "/principal/leave", icon: CalendarDays },
          { title: "Calendar", href: "/principal/calendar", icon: Calendar },
          { title: "Announcements", href: "/principal/announcements", icon: Megaphone },
          { title: "Payroll", href: "/principal/payroll", icon: CircleDollarSign },
          { title: "Reports", href: "/principal/reports", icon: FileText },
          { title: "Notifications", href: "/principal/notifications", icon: Bell },
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
          { title: "Notifications", href: "/staff/notifications", icon: Bell },
          { title: "Settings", href: "/staff/settings", icon: Settings },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 md:hidden"
          />

          {/* Sliding Drawer Container */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-[280px] bg-sidebar text-sidebar-foreground border-r border-border shadow-lg z-50 md:hidden flex flex-col select-none"
          >
            {/* Header */}
            <div className="h-auto flex flex-col justify-center px-4 py-6 border-b border-sidebar-border relative">
              <div className="flex flex-col items-center gap-2 w-full mt-2">
                <div className="flex items-center justify-center w-[220px] h-[220px] flex-shrink-0 bg-transparent">
                  <img src="/logo.png" alt="MPS Logo" className="w-full h-full object-contain drop-shadow-md" />
                </div>
                <div className="flex flex-col items-center text-center truncate w-full font-sans">
                  <span className="font-bold text-base tracking-tight text-foreground">
                    MPS Portal
                  </span>
                  {schoolName && (
                    <span className="text-[10px] text-muted-foreground font-semibold truncate max-w-[200px]" title={schoolName}>
                      {schoolName}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer focus:outline-hidden"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav list */}
            <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto no-scrollbar">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${role}` && pathname.startsWith(item.href));

                return (
                  <Link key={item.href} href={item.href} onClick={onClose}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "w-5 h-5 flex-shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="truncate flex-1">{item.title}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
