"use client";

import React, { useState, useEffect } from "react";
import { RoleGuard } from "@/components/shared/role-guard";
import { Bell, Send, Megaphone, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  broadcastSystemNotificationAction,
  getSystemBroadcastsAction,
  getUserNotificationsAction,
} from "@/app/actions/notification-actions";
import { NotificationsClient } from "@/components/shared/notifications-client";

export default function SuperadminNotifications() {
  const [activeTab, setActiveTab] = useState<"broadcast" | "inbox">("broadcast");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  // Inbox state
  const [personalNotifications, setPersonalNotifications] = useState<any[]>([]);
  const [personalUserId, setPersonalUserId] = useState<string>("");
  const [loadingInbox, setLoadingInbox] = useState(false);

  const fetchBroadcasts = async () => {
    const res = await getSystemBroadcastsAction();
    if (res.success && res.broadcasts) {
      setBroadcasts(res.broadcasts);
    }
  };

  const fetchInbox = async () => {
    setLoadingInbox(true);
    const res = await getUserNotificationsAction("superadmin");
    if (res.success && res.notifications) {
      setPersonalNotifications(res.notifications);
      setPersonalUserId(res.userId || "");
    }
    setLoadingInbox(false);
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  useEffect(() => {
    if (activeTab === "inbox") {
      fetchInbox();
    }
  }, [activeTab]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSuccess(false);
    setErrorMsg(null);

    const res = await broadcastSystemNotificationAction(title, message);
    setIsLoading(false);

    if (res.success) {
      setIsSuccess(true);
      setTitle("");
      setMessage("");
      fetchBroadcasts();
      setTimeout(() => setIsSuccess(false), 3000);
    } else {
      setErrorMsg(res.error || "Failed to broadcast system alert.");
    }
  };

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <div className="space-y-6 select-none animate-in fade-in slide-in-from-bottom-3 duration-300">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            System Communications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage global announcements and view your administrative messages.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border gap-2">
          <button
            onClick={() => setActiveTab("broadcast")}
            className={cn(
              "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative",
              activeTab === "broadcast"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            System Announcements
          </button>
          <button
            onClick={() => setActiveTab("inbox")}
            className={cn(
              "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative",
              activeTab === "inbox"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            My Inbox
          </button>
        </div>

        {activeTab === "broadcast" ? (
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Form to Draft Alerts */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col h-fit lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Megaphone className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm text-foreground">
                  Broadcast Notice
                </h2>
              </div>

              {isSuccess && (
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mb-3">
                  System alert broadcasted successfully!
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 text-rose-600 rounded-lg text-xs font-semibold mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleBroadcast} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Alert Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="System Maintenance"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Alert Message
                  </label>
                  <textarea
                    required
                    placeholder="Please note that the database..."
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Broadcast
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* List of Previous Alerts */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm text-foreground">
                  Sent Announcements
                </h2>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {broadcasts.length > 0 ? (
                  broadcasts.map((n) => (
                    <div
                      key={n.id}
                      className="p-4 border border-border/60 rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors flex flex-col text-left"
                    >
                      <div className="flex justify-between items-center gap-4">
                        <span className="font-bold text-sm text-foreground truncate">
                          {n.new_data?.title || "System Notice"}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(n.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-normal whitespace-pre-wrap">
                        {n.new_data?.message}
                      </p>
                      <div className="mt-2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Sent to {n.new_data?.recipient_count || 0} users
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No system announcements broadcasted yet.
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
            {loadingInbox ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground mt-3 font-semibold">
                  Loading inbox notifications...
                </p>
              </div>
            ) : (
              <NotificationsClient
                initialNotifications={personalNotifications}
                role="superadmin"
                userId={personalUserId}
              />
            )}
          </div>
        )}

      </div>
    </RoleGuard>
  );
}
