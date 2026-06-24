"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, LogOut, ShieldAlert, ChevronDown, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { UserRole } from "@/types/auth";
import { cn } from "@/lib/utils";
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
  getUserNotificationsAction,
} from "@/app/actions/notification-actions";

interface NavbarProps {
  role: UserRole;
  userEmail?: string;
  onMenuToggle?: () => void;
  schoolName?: string;
}

export function Navbar({ role, userEmail = "mones@mps.edu", onMenuToggle, schoolName }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  // Dynamic Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Helper: Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // 1. Fetch initial notifications and unread count on mount / role change
  useEffect(() => {
    async function loadNotifications() {
      const res = await getUserNotificationsAction(role);
      if (res.success && res.notifications) {
        setNotifications(res.notifications.slice(0, 10));
        setCurrentUserId(res.userId || null);
        
        const unread = res.notifications.filter((n: any) => n.read_at === null).length;
        setUnreadCount(unread);
      }
    }

    loadNotifications();
  }, [role, supabase]);

  // 2. Subscribe to Realtime Notification inserts/updates/deletions for this user
  useEffect(() => {
    if (!currentUserId) return;

    const channelName = `user-notifications-${currentUserId}`;

    // Clean up any existing channel with the same name to prevent duplicate/already subscribed errors
    const channels = supabase.getChannels();
    const existingChannel = channels.find(
      (c: any) => c.topic === channelName || c.topic === `realtime:${channelName}`
    );
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        async () => {
          // Refresh list and count
          const res = await getUserNotificationsAction(role);
          if (res.success && res.notifications) {
            setNotifications(res.notifications.slice(0, 10));
            const unread = res.notifications.filter((n: any) => n.read_at === null).length;
            setUnreadCount(unread);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, role, supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setIsNotifMenuOpen(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setRoleSwitcherOpen(false);
    // Write cookie/user_metadata or directly route for testing mock dashboards
    router.push(`/${newRole}`);
  };

  // Handle clicking a notification in the dropdown
  const handleNotificationClick = async (notif: any) => {
    setIsNotifMenuOpen(false);
    if (!notif.read_at) {
      await markNotificationAsReadAction(notif.id);
    }
    router.push(`/${role}/notifications`);
  };

  return (
    <header className="sticky top-0 w-full h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 z-30 select-none">
      {/* Left side: Hamburger (mobile) + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden md:block">
          <Breadcrumbs />
        </div>
      </div>

      {/* Right side: Connection + Switcher + Theme + Notifications + User Menu */}
      <div className="flex items-center gap-2 md:gap-3">
        
        {/* Role Switcher (For Development/Testing Sandbox) */}
        <div className="relative" ref={roleMenuRef}>
          <button
            onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="capitalize">{role}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {roleSwitcherOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1.5 z-50">
              <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Switch Role Sandbox
              </div>
              <hr className="border-border my-1" />
              {(["superadmin", "principal", "staff"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleSwitch(r)}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer capitalize font-medium",
                    role === r && "text-primary bg-primary/5 font-semibold"
                  )}
                >
                  {r}
                  {role === r && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggler */}
        <ThemeSwitcher />

        {/* Notification Bell */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors relative cursor-pointer focus:outline-hidden"
            aria-label="View notifications"
          >
            <Bell className="w-[1.1rem] h-[1.1rem]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-background rounded-full animate-pulse" />
            )}
          </button>

          {isNotifMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-2 z-50">
              <div className="px-4 py-1.5 flex justify-between items-center">
                <span className="font-semibold text-xs text-foreground">Notifications</span>
                {unreadCount > 0 ? (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await markAllNotificationsAsReadAction(currentUserId || undefined);
                    }}
                    className="text-[10px] text-primary hover:underline font-bold"
                  >
                    Mark all as read
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-bold px-1.5 py-0.5 rounded-sm">
                    No unread
                  </span>
                )}
              </div>
              <hr className="border-border my-1" />
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => {
                    const borderColors = {
                      attendance: "border-l-rose-500",
                      leave: "border-l-amber-500",
                      announcement: "border-l-indigo-500",
                      payroll: "border-l-sky-500",
                    };
                    const borderColor = borderColors[n.type as keyof typeof borderColors] || "border-l-muted-foreground";

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          "px-4 py-2.5 hover:bg-accent/40 transition-colors flex flex-col text-left cursor-pointer border-b border-border/40 last:border-0 border-l-2",
                          borderColor,
                          !n.read_at && "bg-accent/25"
                        )}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className={cn(
                            "text-xs truncate",
                            n.read_at ? "text-muted-foreground font-medium" : "text-foreground font-semibold"
                          )}>
                            {n.title}
                          </span>
                          <span className="text-[9px] text-muted-foreground whitespace-nowrap pt-0.5">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {n.message}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <hr className="border-border my-1" />
              <button
                onClick={() => {
                  setIsNotifMenuOpen(false);
                  router.push(`/${role}/notifications`);
                }}
                className="w-full text-center py-1.5 text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>

        {/* User Profile dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-md border border-border bg-background hover:bg-accent/50 transition-colors cursor-pointer focus:outline-hidden"
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border">
              {userEmail.substring(0, 2).toUpperCase()}
            </div>
            <span className="hidden md:inline text-xs font-medium text-muted-foreground pr-1 truncate max-w-[120px]">
              {userEmail}
            </span>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1.5 z-50">
              <div className="px-3 py-2 flex flex-col">
                <span className="font-semibold text-xs text-foreground truncate">{userEmail}</span>
                <span className="text-[10px] text-muted-foreground capitalize mt-0.5">{role}</span>
                {schoolName && (
                  <span className="text-[10px] text-primary font-semibold truncate mt-1" title={schoolName}>
                    {schoolName}
                  </span>
                )}
              </div>
              <hr className="border-border my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
