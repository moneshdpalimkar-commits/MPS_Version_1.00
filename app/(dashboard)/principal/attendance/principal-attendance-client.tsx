"use client";

import React, { useState, useTransition } from "react";
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  Eye,
  Camera,
  ShieldCheck,
  Building,
  User,
  Loader2,
  Check,
  X,
  FileText,
  History,
} from "lucide-react";
import { getSchoolAttendanceLogsAction } from "@/app/actions/attendance-actions";
import { approveCorrectionRequestAction } from "@/app/actions/correction-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PrincipalAttendanceClientProps {
  initialLogs: any[];
  departments: any[];
  initialCorrections: any[];
}

export function PrincipalAttendanceClient({
  initialLogs,
  departments,
  initialCorrections,
}: PrincipalAttendanceClientProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"logs" | "corrections">("logs");

  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [corrections, setCorrections] = useState<any[]>(initialCorrections);

  // Filters
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedDept, setSelectedDept] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal view snap
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const fetchLogs = (date: string, dept: string) => {
    startTransition(async () => {
      const result = await getSchoolAttendanceLogsAction(date, dept);
      if (result.success && result.logs) {
        setLogs(result.logs);
      }
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value;
    setSelectedDate(d);
    fetchLogs(d, selectedDept);
  };

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dept = e.target.value;
    setSelectedDept(dept);
    fetchLogs(selectedDate, dept);
  };

  // Process Correction Requests (Approve/Reject)
  const handleProcessCorrection = async (requestId: string, action: "approved" | "rejected") => {
    if (
      confirm(
        `Are you sure you want to ${action.toUpperCase()} this attendance correction request?`
      )
    ) {
      startTransition(async () => {
        const result = await approveCorrectionRequestAction({ requestId, action });
        if (result.success) {
          // Refresh lists
          fetchLogs(selectedDate, selectedDept);
          // Manually update request status in the local state for immediate feedback
          setCorrections((prev) =>
            prev.map((c) =>
              c.id === requestId
                ? { ...c, status: action, approved_at: new Date().toISOString() }
                : c
            )
          );
        } else {
          alert(result.error || `Failed to process request: ${action}`);
        }
      });
    }
  };

  // Filter logs by search query (first name, last name, or email)
  const filteredLogs = logs.filter((log) => {
    const fullName = `${log.staff?.first_name || ""} ${log.staff?.last_name || ""}`.toLowerCase();
    const email = (log.staff?.email || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  // Filter corrections by search query
  const filteredCorrections = corrections.filter((c) => {
    const fullName = `${c.staff?.first_name || ""} ${c.staff?.last_name || ""}`.toLowerCase();
    const email = (c.staff?.email || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "on_time":
      case "present":
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase">On Time</span>;
      case "late":
        return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold uppercase">Late</span>;
      case "super_late":
        return <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded-full text-[10px] font-bold uppercase">Super Late</span>;
      case "half_day":
        return <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded-full text-[10px] font-bold uppercase">Half Day</span>;
      case "leave":
      case "on_leave":
        return <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold uppercase">Leave</span>;
      case "holiday":
        return <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-bold uppercase">Holiday</span>;
      default:
        return <span className="px-2 py-0.5 bg-zinc-500/10 text-zinc-600 rounded-full text-[10px] font-bold uppercase">Absent</span>;
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase">Approved</span>;
      case "rejected":
        return <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded-full text-[10px] font-bold uppercase">Rejected</span>;
      default:
        return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold uppercase">Pending</span>;
    }
  };

  const getCorrectionTypeLabel = (type: string) => {
    switch (type) {
      case "forgot_checkout":
        return "Forgot Checkout";
      case "wrong_attendance":
        return "Wrong Attendance Info";
      default:
        return "Other";
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Attendance Board
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor real-time biometric verifications, check-in snapshots, and campus boundary distances.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Daily Clock Logs
        </button>
        <button
          onClick={() => setActiveTab("corrections")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeTab === "corrections"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Correction Requests
          {corrections.filter((c) => c.status === "pending").length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
              {corrections.filter((c) => c.status === "pending").length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "logs" ? (
        <div className="space-y-6">
          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-card border border-border rounded-xl shadow-xs">
            {/* Search */}
            <div className="sm:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Date Filter */}
            <div className="sm:col-span-4 relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
              />
            </div>

            {/* Department Filter */}
            <div className="sm:col-span-4 relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={selectedDept}
                onChange={handleDeptChange}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Logs Grid Card Layout */}
          {isPending ? (
            <div className="h-60 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredLogs.map((log) => {
                const inGps = log.check_in_gps;
                return (
                  <div
                    key={log.id}
                    className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4 hover:border-primary/40 transition-colors"
                  >
                    {/* Header (Staff Info) */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden border border-border flex-shrink-0 flex items-center justify-center">
                        {log.staff?.avatar_url ? (
                          <img
                            src={log.staff.avatar_url}
                            alt="Staff avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate">
                          {log.staff?.first_name} {log.staff?.last_name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {log.staff?.designation || "Staff"} • {log.staff?.departments?.name || "No Dept"}
                        </p>
                      </div>
                    </div>

                    <hr className="border-border" />

                    {/* Clock timings and status */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-muted-foreground uppercase">Clock In</span>
                        <span className="font-semibold text-foreground font-mono">
                          {log.check_in_time
                            ? new Date(log.check_in_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold text-muted-foreground uppercase">Clock Out</span>
                        <span className="font-semibold text-foreground font-mono">
                          {log.check_out_time
                            ? new Date(log.check_out_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Status and Geofence distance */}
                    <div className="flex items-center justify-between py-1 bg-muted/30 px-3 rounded-lg text-xs">
                      <span className="font-medium text-muted-foreground">Status:</span>
                      {getStatusBadge(log.status)}
                    </div>

                    {inGps && inGps.distance_meters !== undefined && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>
                          Clock In Location: <strong>{inGps.distance_meters}m</strong> from geofence
                        </span>
                      </div>
                    )}

                    {/* Verification snaps side-by-side */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="space-y-1">
                        <span className="block text-[9px] font-bold text-muted-foreground uppercase">Clock In Snap</span>
                        <div className="aspect-video relative rounded-lg border border-border overflow-hidden bg-muted/40 group">
                          {log.check_in_face_url ? (
                            <>
                              <img
                                src={log.check_in_face_url}
                                alt="Check in snap"
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: log.check_in_face_url,
                                    title: `${log.staff?.first_name} ${log.staff?.last_name} — Clock In Snap`,
                                  })
                                }
                                className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold gap-1 text-[10px] uppercase tracking-wider"
                              >
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </button>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-[10px] font-semibold italic uppercase">
                              No Photo
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[9px] font-bold text-muted-foreground uppercase">Clock Out Snap</span>
                        <div className="aspect-video relative rounded-lg border border-border overflow-hidden bg-muted/40 group">
                          {log.check_out_face_url ? (
                            <>
                              <img
                                src={log.check_out_face_url}
                                alt="Check out snap"
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: log.check_out_face_url,
                                    title: `${log.staff?.first_name} ${log.staff?.last_name} — Clock Out Snap`,
                                  })
                                }
                                className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold gap-1 text-[10px] uppercase tracking-wider"
                              >
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </button>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-[10px] font-semibold italic uppercase">
                              No Photo
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verification details */}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Face Biometrics Checked & Verified</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-60 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center p-6 bg-card/40">
              <Camera className="w-8 h-8 text-muted-foreground mb-3 animate-pulse" />
              <h3 className="text-sm font-bold text-foreground">No Attendance Logs Found</h3>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mt-1">
                There are no biometric clock logs recorded for the selected date ({selectedDate}) in this department filter.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* CORRECTION REQUESTS LIST VIEW */
        <div className="space-y-6">
          {/* Search bar */}
          <div className="max-w-sm relative bg-card border border-border p-3 rounded-xl shadow-xs">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search staff requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
            />
          </div>

          {isPending ? (
            <div className="h-60 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filteredCorrections.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Staff Member</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Target Date</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Current Log</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Correction Request</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Reason</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Status</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCorrections.map((c) => {
                      const att = c.attendance;
                      const staff = c.staff;
                      return (
                        <tr key={c.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <div className="font-bold">{staff?.first_name} {staff?.last_name}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">
                              {staff?.designation} • {staff?.departments?.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground font-semibold">
                            {att?.date
                              ? new Date(att.date).toLocaleDateString([], {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono">
                            {att?.check_in_time ? (
                              <div>In: {new Date(att.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            ) : (
                              <div>In: —</div>
                            )}
                            {att?.check_out_time ? (
                              <div>Out: {new Date(att.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            ) : (
                              <div>Out: —</div>
                            )}
                            <div className="mt-1">
                              Status: <strong className="text-foreground">{att?.status}</strong>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground font-mono leading-relaxed bg-primary/5">
                            <div className="text-[10px] font-bold text-primary uppercase mb-0.5">{getCorrectionTypeLabel(c.correction_type)}</div>
                            {c.corrected_check_in ? (
                              <div>In: <strong className="text-primary">{new Date(c.corrected_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div>
                            ) : (
                              <div>In: <span className="text-muted-foreground/60">No Change</span></div>
                            )}
                            {c.corrected_check_out ? (
                              <div>Out: <strong className="text-primary">{new Date(c.corrected_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div>
                            ) : (
                              <div>Out: <span className="text-muted-foreground/60">No Change</span></div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={c.reason}>
                            <div className="flex items-start gap-1">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <span>{c.reason}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getRequestStatusBadge(c.status)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.status === "pending" ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleProcessCorrection(c.id, "approved")}
                                  className="w-7 h-7 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                                  title="Approve Time Correction"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleProcessCorrection(c.id, "rejected")}
                                  className="w-7 h-7 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                                  title="Reject Request"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 italic font-medium">Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-60 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center p-6 bg-card/40">
              <History className="w-8 h-8 text-muted-foreground mb-3 animate-pulse" />
              <h3 className="text-sm font-bold text-foreground">No Correction Requests</h3>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                There are no pending or historic attendance correction requests logged in this school.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Snapshot Zoom Modal Dialog */}
      <Dialog
        open={previewPhoto !== null}
        onOpenChange={(isOpen) => !isOpen && setPreviewPhoto(null)}
      >
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              {previewPhoto?.title}
            </DialogTitle>
          </DialogHeader>

          {previewPhoto?.url && (
            <div className="aspect-square rounded-lg overflow-hidden border border-border bg-black mt-2">
              <img
                src={previewPhoto.url}
                alt="High res snapshot preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-border mt-4">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="px-4 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              Close Preview
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
