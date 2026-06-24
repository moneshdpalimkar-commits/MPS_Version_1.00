"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Megaphone,
  Search,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Clock,
  Users,
  Volume2,
  Calendar,
  X,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StaffAnnouncementsClientProps {
  initialAnnouncements: any[];
}

export function StaffAnnouncementsClient({ initialAnnouncements }: StaffAnnouncementsClientProps) {
  const router = useRouter();

  // State Management
  const [announcements, setAnnouncements] = useState<any[]>(initialAnnouncements);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  // Status indicators
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "disconnected">("connected");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Realtime subscription setup
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("announcements_staff_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setToastMsg(`New Announcement: "${payload.new.title}" posted!`);
            setTimeout(() => setToastMsg(null), 4000);
          }
          router.refresh();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
        } else {
          setRealtimeStatus("disconnected");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Sync initial list when page revalidates
  useEffect(() => {
    setAnnouncements(initialAnnouncements);
  }, [initialAnnouncements]);

  const getAnnouncementTypeBadge = (type: string) => {
    switch (type) {
      case "emergency":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "holiday":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "exam":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "meeting":
        return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
      default: // general
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  const getAudienceLabel = (audience: string, departmentName?: string) => {
    switch (audience) {
      case "all":
        return "All Staff";
      case "teaching":
        return "Teaching Staff";
      case "non-teaching":
        return "Non-Teaching Staff";
      case "department":
        return departmentName ? `Dept: ${departmentName}` : "Department";
      default:
        return audience;
    }
  };

  // Filter logic
  const filteredAnnouncements = announcements.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === "all" || item.type === selectedType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      
      {/* Realtime Toast notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-card border border-primary/30 p-4 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up max-w-sm">
          <Volume2 className="w-5 h-5 text-primary animate-bounce flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-primary block uppercase">Alert</span>
            <p className="text-xs font-semibold text-foreground truncate">{toastMsg}</p>
          </div>
          <button onClick={() => setToastMsg(null)} className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-foreground font-sans flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              School Announcements
            </h1>
            <span
              className={`w-2 h-2 rounded-full mt-1.5 transition-all ${
                realtimeStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-muted"
              }`}
              title={realtimeStatus === "connected" ? "Realtime sync connected" : "Realtime sync offline"}
            />
          </div>
          <p className="text-xs text-muted-foreground font-semibold mt-1">
            Stay updated with official bulletins, exam circulars, and emergency alerts.
          </p>
        </div>
      </div>

      {/* Filters and search section */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-card text-xs text-foreground focus:outline-hidden"
          />
        </div>

        {/* Type filters */}
        <div className="flex border border-border rounded-lg bg-card p-0.5 text-[11px] font-bold w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All Types" },
            { id: "general", label: "General" },
            { id: "emergency", label: "Emergency" },
            { id: "exam", label: "Exam" },
            { id: "holiday", label: "Holiday" },
            { id: "meeting", label: "Meeting" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                selectedType === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements Feed Grid */}
      {filteredAnnouncements.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAnnouncements.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedAnnouncement(item)}
              className="group border border-border hover:border-primary/40 rounded-2xl p-5 bg-card hover:bg-card/70 hover:shadow-xs transition-all flex flex-col justify-between min-h-[180px] cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 border text-[9px] font-extrabold uppercase rounded-full tracking-wider ${getAnnouncementTypeBadge(
                      item.type
                    )}`}
                  >
                    {item.type}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {getAudienceLabel(item.audience, item.departments?.name)}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-border mt-4 pt-3.5 flex items-center justify-between gap-3 text-[10px] text-muted-foreground font-semibold">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 opacity-70" />
                  <span>{new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </div>

                {item.attachment_url && (
                  <span className="p-1 border border-border rounded-md hover:bg-accent text-primary" title={item.attachment_name || "Attachment"}>
                    <Paperclip className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-2xl h-60 flex flex-col items-center justify-center text-center p-6 bg-card/20">
          <Megaphone className="w-10 h-10 text-muted-foreground/45 mb-2.5 animate-pulse" />
          <p className="text-sm font-extrabold text-foreground">No Announcements Found</p>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            No circulars match your active filters, or none have been published to your target audience.
          </p>
        </div>
      )}

      {/* DETAIL DIALOG */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-2xl p-6">
          {selectedAnnouncement && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`px-2 py-0.5 border text-[9px] font-extrabold uppercase rounded-full tracking-wider ${getAnnouncementTypeBadge(
                      selectedAnnouncement.type
                    )}`}
                  >
                    {selectedAnnouncement.type}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {getAudienceLabel(selectedAnnouncement.audience, selectedAnnouncement.departments?.name)}
                  </span>
                </div>
                <DialogTitle className="text-base font-extrabold text-foreground leading-snug">
                  {selectedAnnouncement.title}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Published on {new Date(selectedAnnouncement.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </DialogDescription>
              </DialogHeader>

              <div className="border-t border-b border-border py-4 my-2">
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedAnnouncement.description}
                </p>
              </div>

              {/* Attachment Preview/Link */}
              {selectedAnnouncement.attachment_url && (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
                    Attachment
                  </h4>

                  {/* Render inline image if it is an image */}
                  {!selectedAnnouncement.attachment_url.toLowerCase().endsWith(".pdf") && (
                    <div className="border border-border rounded-xl overflow-hidden bg-muted/20 relative aspect-video flex items-center justify-center max-h-[160px]">
                      <img
                        src={selectedAnnouncement.attachment_url}
                        alt="Circular attachment preview"
                        className="object-contain w-full h-full max-h-[160px]"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between border border-border rounded-xl p-3 bg-muted/40">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedAnnouncement.attachment_url.toLowerCase().endsWith(".pdf") ? (
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                      <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
                        {selectedAnnouncement.attachment_name || "circular-attachment"}
                      </span>
                    </div>

                    <a
                      href={selectedAnnouncement.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-border hover:border-primary/40 bg-background text-[10px] font-bold rounded-lg text-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                </div>
              )}

              {/* Footer action */}
              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-accent text-foreground transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
