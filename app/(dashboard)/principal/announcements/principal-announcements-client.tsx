"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Megaphone,
  Plus,
  Trash2,
  Search,
  Loader2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Building,
  Volume2,
  Calendar,
  X,
  Download,
  ExternalLink,
} from "lucide-react";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
} from "@/app/actions/announcement-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Zod Schema
const announcementSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(5, "Description must be at least 5 characters"),
    type: z.enum(["general", "holiday", "meeting", "exam", "emergency"]),
    audience: z.enum(["all", "teaching", "non-teaching", "department"]),
    departmentId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.audience === "department" && !data.departmentId) {
        return false;
      }
      return true;
    },
    {
      message: "Department selection is required when target audience is Department",
      path: ["departmentId"],
    }
  );

type AnnouncementFormInput = z.infer<typeof announcementSchema>;

interface PrincipalAnnouncementsClientProps {
  initialAnnouncements: any[];
  departments: any[];
  schoolId: string;
}

export function PrincipalAnnouncementsClient({
  initialAnnouncements,
  departments,
  schoolId,
}: PrincipalAnnouncementsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State Management
  const [announcements, setAnnouncements] = useState<any[]>(initialAnnouncements);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedAudience, setSelectedAudience] = useState<string>("all-audiences");

  const [isOpen, setIsOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  // Status indicators
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "disconnected">("connected");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Upload Management
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AnnouncementFormInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "general",
      audience: "all",
      departmentId: "",
    },
  });

  const watchAudience = watch("audience");

  // Realtime subscription setup
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("announcements_principal_realtime")
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      alert("Only Image (PNG, JPG, etc.) and PDF files are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds the 5MB limit.");
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${schoolId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      setUploadProgress(40);
      const { data, error } = await supabase.storage
        .from("announcements")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      setUploadProgress(80);
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/announcements/${data.path}`;
      setAttachmentUrl(publicUrl);
      setAttachmentName(file.name);
      setUploadProgress(100);
    } catch (err: any) {
      console.error("Upload failed: ", err);
      alert(`File upload failed: ${err.message}`);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const clearAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentName(null);
    setUploadProgress(0);
  };

  const handleCreateAnnouncement = (data: AnnouncementFormInput) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await createAnnouncementAction({
        title: data.title,
        description: data.description,
        type: data.type,
        audience: data.audience,
        departmentId: data.audience === "department" ? data.departmentId : undefined,
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      });

      if (result.success) {
        setSuccessMsg("Announcement broadcast successfully!");
        clearAttachment();
        reset();
        setTimeout(() => {
          setIsOpen(false);
          setSuccessMsg(null);
        }, 1500);
      } else {
        setErrorMsg(result.error || "Failed to broadcast announcement.");
      }
    });
  };

  const handleDeleteAnnouncement = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail panel
    if (confirm("Are you sure you want to delete this announcement? This action is irreversible.")) {
      startTransition(async () => {
        const result = await deleteAnnouncementAction(id);
        if (result.success) {
          alert("Announcement deleted successfully.");
          if (selectedAnnouncement?.id === id) {
            setSelectedAnnouncement(null);
          }
        } else {
          alert(result.error || "Failed to delete announcement.");
        }
      });
    }
  };

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

    const matchesAudience =
      selectedAudience === "all-audiences" || item.audience === selectedAudience;

    return matchesSearch && matchesType && matchesAudience;
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
              Announcements Console
            </h1>
            <span
              className={`w-2 h-2 rounded-full mt-1.5 transition-all ${
                realtimeStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-muted"
              }`}
              title={realtimeStatus === "connected" ? "Realtime sync connected" : "Realtime sync offline"}
            />
          </div>
          <p className="text-xs text-muted-foreground font-semibold mt-1">
            Publish, edit, and delete official school circulars and emergency alerts.
          </p>
        </div>

        <button
          onClick={() => {
            clearAttachment();
            reset();
            setErrorMsg(null);
            setSuccessMsg(null);
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-sm hover:scale-[1.02] cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Publish Circular
        </button>
      </div>

      {/* Filters and search section */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search circulars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-card text-xs text-foreground focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Type filters */}
          <div className="flex border border-border rounded-lg bg-card p-0.5 text-[11px] font-bold">
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
                className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                  selectedType === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Audience filters */}
          <select
            value={selectedAudience}
            onChange={(e) => setSelectedAudience(e.target.value)}
            className="border border-border rounded-lg bg-card px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-hidden cursor-pointer"
          >
            <option value="all-audiences">All Audiences</option>
            <option value="all">All Staff</option>
            <option value="teaching">Teaching Staff</option>
            <option value="non-teaching">Non-Teaching Staff</option>
            <option value="department">Departments</option>
          </select>
        </div>
      </div>

      {/* Announcements Feed Grid */}
      {filteredAnnouncements.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAnnouncements.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedAnnouncement(item)}
              className="group border border-border hover:border-primary/40 rounded-2xl p-5 bg-card hover:bg-card/70 hover:shadow-xs transition-all flex flex-col justify-between min-h-[190px] cursor-pointer"
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

                <div className="flex items-center gap-2">
                  {item.attachment_url && (
                    <span className="p-1 border border-border rounded-md hover:bg-accent text-primary" title={item.attachment_name || "Attachment"}>
                      <Paperclip className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDeleteAnnouncement(item.id, e)}
                    disabled={isPending}
                    className="p-1 border border-border rounded-md hover:border-destructive hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer disabled:opacity-50"
                    title="Delete Announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-2xl h-60 flex flex-col items-center justify-center text-center p-6 bg-card/20">
          <Megaphone className="w-10 h-10 text-muted-foreground/45 mb-2.5 animate-pulse" />
          <p className="text-sm font-extrabold text-foreground">No Announcements Found</p>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            No circulars match your active filters, or none have been published yet.
          </p>
        </div>
      )}

      {/* CREATE MODAL */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Publish Circular</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Broadcast circulars, notices, exam alerts, and emergency bulletins to staff.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/10 text-destructive border border-destructive/25 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(handleCreateAnnouncement)} className="space-y-4 mt-4">
            
            {/* Title */}
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                Title
              </label>
              <input
                {...register("title")}
                type="text"
                placeholder="e.g. Mandatory Staff Meeting, Term End Exams Schedule"
                className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden"
              />
              {errors.title && (
                <span className="text-xs text-destructive mt-0.5 block">{errors.title.message}</span>
              )}
            </div>

            {/* Type & Audience row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Type / Classification
                </label>
                <select
                  {...register("type")}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="general">General</option>
                  <option value="emergency">Emergency Alert</option>
                  <option value="exam">Exam Schedule</option>
                  <option value="holiday">Holiday Announcement</option>
                  <option value="meeting">Staff Meeting</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Audience Group
                </label>
                <select
                  {...register("audience")}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All School Staff</option>
                  <option value="teaching">Teaching Staff only</option>
                  <option value="non-teaching">Non-teaching Staff only</option>
                  <option value="department">Specific Department</option>
                </select>
              </div>
            </div>

            {/* Department Selector */}
            {watchAudience === "department" && (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Select Target Department
                </label>
                <select
                  {...register("departmentId")}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="">Choose Department...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.departmentId && (
                  <span className="text-xs text-destructive mt-0.5 block">
                    {errors.departmentId.message}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                Description / Circular Content
              </label>
              <textarea
                {...register("description")}
                rows={4}
                placeholder="Draft full announcement contents here..."
                className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden resize-none"
              />
              {errors.description && (
                <span className="text-xs text-destructive mt-0.5 block">
                  {errors.description.message}
                </span>
              )}
            </div>

            {/* Attachment Area */}
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                Attach Documents (PDF / Image)
              </label>
              
              {!attachmentUrl ? (
                <div className="mt-1 border border-dashed border-border hover:border-primary/50 rounded-xl p-4 text-center cursor-pointer transition-colors relative">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      <span className="text-xs text-primary font-bold">Uploading ({uploadProgress}%)</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-1 py-1 text-muted-foreground">
                      <Paperclip className="w-5 h-5 text-muted-foreground/60" />
                      <span className="text-xs font-bold">Upload PDF or Image</span>
                      <span className="text-[10px] opacity-60">PDF, JPG, PNG (Max 5MB)</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between border border-border rounded-xl p-3 bg-muted/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attachmentName?.endsWith(".pdf") ? (
                      <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    )}
                    <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
                      {attachmentName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="p-1 text-muted-foreground hover:text-destructive cursor-pointer hover:bg-muted rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-3.5 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-accent text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || uploading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Publish Notice
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DETAIL DRAWER / DIALOG */}
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
                    Circular Attachment
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
