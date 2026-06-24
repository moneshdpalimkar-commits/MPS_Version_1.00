"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Trash2,
  CheckCheck,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  CircleCheck,
  CircleAlert,
  ChevronRight,
  Eye,
  Trash,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
  deleteNotificationAction,
  getUserNotificationsAction,
} from "@/app/actions/notification-actions";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read_at: string | null;
  type: "attendance" | "leave" | "announcement" | "payroll";
  created_at: string;
}

interface NotificationsClientProps {
  initialNotifications: Notification[];
  role: "principal" | "staff" | "superadmin";
  userId: string;
}

export function NotificationsClient({
  initialNotifications,
  role,
  userId,
}: NotificationsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isPending, startTransition] = useTransition();

  // Helper: Format detailed date
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

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

  // Realtime subscription sync
  useEffect(() => {
    if (!userId) return;

    const channelName = `page-notifications-${userId}`;

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
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Re-fetch all notifications via server action to bypass sandbox RLS limits
          const res = await getUserNotificationsAction(role as any);
          if (res.success && res.notifications) {
            setNotifications(res.notifications as Notification[]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  // Sync state if initialNotifications changes (e.g. on server navigation refresh)
  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread") return n.read_at === null;
    return true;
  });

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  const handleMarkAsRead = (id: string) => {
    startTransition(async () => {
      const res = await markNotificationAsReadAction(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
        );
        if (selectedNotification?.id === id) {
          setSelectedNotification((prev) =>
            prev ? { ...prev, read_at: new Date().toISOString() } : null
          );
        }
      }
    });
  };

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      const res = await markAllNotificationsAsReadAction();
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        );
        if (selectedNotification && !selectedNotification.read_at) {
          setSelectedNotification((prev) =>
            prev ? { ...prev, read_at: new Date().toISOString() } : null
          );
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteNotificationAction(id);
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (selectedNotification?.id === id) {
          setSelectedNotification(null);
        }
      }
    });
  };

  const handleDeleteAllRead = () => {
    startTransition(async () => {
      const readIds = notifications.filter((n) => n.read_at !== null).map((n) => n.id);
      for (const id of readIds) {
        await deleteNotificationAction(id);
      }
      setNotifications((prev) => prev.filter((n) => n.read_at === null));
      if (selectedNotification && selectedNotification.read_at !== null) {
        setSelectedNotification(null);
      }
    });
  };

  // Helper styling config based on type
  const getNotificationConfig = (type: Notification["type"], title: string) => {
    const isError =
      title.toLowerCase().includes("violation") ||
      title.toLowerCase().includes("failure") ||
      title.toLowerCase().includes("rejected");

    switch (type) {
      case "attendance":
        return {
          icon: isError ? CircleAlert : Clock,
          colorClass: isError
            ? "text-rose-500 bg-rose-50 dark:bg-rose-950/20"
            : "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
          borderClass: isError ? "border-l-rose-500" : "border-l-emerald-500",
          badgeLabel: isError ? "Attendance Violation" : "Attendance",
        };
      case "leave":
        return {
          icon: Calendar,
          colorClass: "text-amber-500 bg-amber-50 dark:bg-amber-950/20",
          borderClass: "border-l-amber-500",
          badgeLabel: "Leave",
        };
      case "payroll":
        return {
          icon: FileText,
          colorClass: "text-sky-500 bg-sky-50 dark:bg-sky-950/20",
          borderClass: "border-l-sky-500",
          badgeLabel: "Payroll",
        };
      case "announcement":
      default:
        return {
          icon: Layers,
          colorClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
          borderClass: "border-l-indigo-500",
          badgeLabel: "Notice",
        };
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notification Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Realtime alerts, log corrections, biometric validations, and approvals for the school campus.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-input hover:bg-accent hover:text-accent-foreground transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all as read
            </button>
          )}
          {notifications.some((n) => n.read_at !== null) && (
            <button
              onClick={handleDeleteAllRead}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500/10 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear read
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side - Notification List */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all duration-200 cursor-pointer relative",
                activeTab === "all"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              All Notifications
              <span className="ml-1.5 bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                {notifications.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={cn(
                "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all duration-200 cursor-pointer relative",
                activeTab === "unread"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-1.5 bg-rose-500 text-rose-50 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* List items */}
          <div className="flex flex-col gap-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-xl bg-card">
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">No notifications found</h3>
                <p className="text-xs text-muted-foreground text-center mt-1 max-w-[280px]">
                  {activeTab === "unread"
                    ? "Hooray! You are all caught up. No unread notifications at the moment."
                    : "No notifications recorded yet. We'll alert you when events occur."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const config = getNotificationConfig(notif.type, notif.title);
                const IconComponent = config.icon;
                const isSelected = selectedNotification?.id === notif.id;

                return (
                  <div
                    key={notif.id}
                    onClick={() => setSelectedNotification(notif)}
                    className={cn(
                      "group p-4 border rounded-lg bg-card hover:bg-accent/40 cursor-pointer transition-all duration-200 flex items-start gap-3 border-l-4",
                      config.borderClass,
                      !notif.read_at && "shadow-sm border-border/80 bg-primary/[0.01]",
                      isSelected && "ring-1 ring-primary border-primary bg-primary/[0.02] dark:bg-primary/[0.04]"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn("p-2 rounded-md shrink-0", config.colorClass)}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          {config.badgeLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>
                      <h4
                        className={cn(
                          "text-xs mt-1 truncate",
                          notif.read_at ? "text-muted-foreground font-medium" : "text-foreground font-semibold"
                        )}
                      >
                        {notif.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 group-hover:line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Check / Delete actions on hover */}
                    <div className="flex items-center gap-1 opacity-90 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 self-center">
                      {!notif.read_at && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                          }}
                          title="Mark as read"
                          className="p-1 rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/15 cursor-pointer transition-colors"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notif.id);
                        }}
                        title="Delete notification"
                        className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side - Selected Notification Inspector */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          {selectedNotification ? (
            <div className="border border-border rounded-xl bg-card p-6 shadow-sm flex flex-col gap-5 animate-in fade-in duration-200">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      getNotificationConfig(selectedNotification.type, selectedNotification.title).colorClass
                    )}
                  >
                    {getNotificationConfig(selectedNotification.type, selectedNotification.title).badgeLabel}
                  </span>
                  {!selectedNotification.read_at && (
                    <span className="w-2 h-2 rounded-full bg-rose-500" title="Unread" />
                  )}
                </div>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 hover:bg-accent rounded-md"
                >
                  Close
                </button>
              </div>

              {/* Title & Message */}
              <div>
                <h3 className="font-semibold text-sm text-foreground leading-snug">
                  {selectedNotification.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDateTime(selectedNotification.created_at)}</span>
                </div>
              </div>

              {/* Message Block */}
              <div className="bg-accent/40 rounded-lg p-4 text-xs text-foreground/90 leading-relaxed border border-border/30 whitespace-pre-wrap font-medium">
                {selectedNotification.message}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between border-t border-border pt-4 mt-1">
                <button
                  onClick={() => handleDelete(selectedNotification.id)}
                  className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer hover:bg-rose-500/5 px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Trash className="w-3.5 h-3.5" />
                  Delete
                </button>

                {!selectedNotification.read_at && (
                  <button
                    onClick={() => handleMarkAsRead(selectedNotification.id)}
                    className="flex items-center gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-xl p-8 bg-card flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center mb-3">
                <Eye className="w-5 h-5 text-muted-foreground" />
              </div>
              <h4 className="font-semibold text-xs text-foreground">Select a notification</h4>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                Click on any notification in the list to inspect its full details and perform actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
