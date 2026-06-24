"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  CalendarDays,
  Sliders,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  approveLeaveRequestAction,
  updateSchoolLeaveSettingsAction,
  updateStaffLeaveBalanceAction,
} from "@/app/actions/leave-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Form Validation for School-wide Leave Settings
const settingsSchema = z.object({
  casualDefault: z.number().min(0, "Must be at least 0"),
  sickDefault: z.number().min(0, "Must be at least 0"),
  earnedDefault: z.number().min(0, "Must be at least 0"),
});

type SettingsFormInput = z.infer<typeof settingsSchema>;

// Form Validation for Custom Staff Balance overrides
const staffBalanceSchema = z.object({
  casualAllocated: z.number().min(0, "Must be at least 0"),
  sickAllocated: z.number().min(0, "Must be at least 0"),
  earnedAllocated: z.number().min(0, "Must be at least 0"),
});

type StaffBalanceFormInput = z.infer<typeof staffBalanceSchema>;

interface PrincipalLeaveClientProps {
  schoolId: string;
  initialRequests: any[];
  initialSettings: any;
  initialStaffList: any[];
}

export function PrincipalLeaveClient({
  schoolId,
  initialRequests,
  initialSettings,
  initialStaffList,
}: PrincipalLeaveClientProps) {
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"pending" | "history" | "staff" | "settings">("pending");
  const [requests, setRequests] = useState<any[]>(initialRequests);
  const [staffList, setStaffList] = useState<any[]>(initialStaffList);

  const [searchQuery, setSearchQuery] = useState("");

  // Override Balance Modal States
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceSuccess, setBalanceSuccess] = useState<string | null>(null);

  // Settings Feedback
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Form Hooks
  const settingsForm = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      casualDefault: initialSettings.casual_default,
      sickDefault: initialSettings.sick_default,
      earnedDefault: initialSettings.earned_default,
    },
  });

  const staffBalanceForm = useForm<StaffBalanceFormInput>({
    resolver: zodResolver(staffBalanceSchema),
  });

  // Filter requests
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const historyRequests = requests.filter((r) => r.status !== "pending");

  // Filter staff list based on search query
  const filteredStaff = staffList.filter((s) => {
    const fullName = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
    const employeeId = (s.employee_id || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || employeeId.includes(query);
  });

  // Approve or Reject request
  const handleProcessLeave = async (requestId: string, action: "approved" | "rejected") => {
    if (confirm(`Are you sure you want to ${action.toUpperCase()} this leave request?`)) {
      startTransition(async () => {
        const result = await approveLeaveRequestAction({ requestId, action });
        if (result.success) {
          // Update requests list locally for immediate feedback
          setRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? { ...r, status: action, approved_at: new Date().toISOString() }
                : r
            )
          );
          // Reload page to sync balances
          window.location.reload();
        } else {
          alert(result.error || `Failed to process request: ${action}`);
        }
      });
    }
  };

  // Submit Default Settings
  const onSettingsSubmit = async (data: SettingsFormInput) => {
    setSettingsError(null);
    setSettingsSuccess(null);

    startTransition(async () => {
      const result = await updateSchoolLeaveSettingsAction({
        schoolId,
        casualDefault: data.casualDefault,
        sickDefault: data.sickDefault,
        earnedDefault: data.earnedDefault,
      });

      if (result.success) {
        setSettingsSuccess("Leave policy settings updated successfully!");
        setTimeout(() => setSettingsSuccess(null), 3000);
      } else {
        setSettingsError(result.error || "Failed to update leave policy.");
      }
    });
  };

  // Open Edit Balances Modal
  const handleOpenEditBalances = (staff: any) => {
    setSelectedStaff(staff);
    setBalanceError(null);
    setBalanceSuccess(null);

    const casual = staff.leave_balances?.find((b: any) => b.leave_type === "casual")?.allocated ?? 10;
    const sick = staff.leave_balances?.find((b: any) => b.leave_type === "sick")?.allocated ?? 8;
    const earned = staff.leave_balances?.find((b: any) => b.leave_type === "earned")?.allocated ?? 5;

    staffBalanceForm.reset({
      casualAllocated: casual,
      sickAllocated: sick,
      earnedAllocated: earned,
    });
  };

  // Submit Staff Balance Overrides
  const onStaffBalanceSubmit = async (data: StaffBalanceFormInput) => {
    if (!selectedStaff) return;
    setBalanceError(null);
    setBalanceSuccess(null);

    startTransition(async () => {
      // Execute three overrides in parallel (casual, sick, earned)
      const results = await Promise.all([
        updateStaffLeaveBalanceAction({
          staffId: selectedStaff.id,
          leaveType: "casual",
          allocated: data.casualAllocated,
        }),
        updateStaffLeaveBalanceAction({
          staffId: selectedStaff.id,
          leaveType: "sick",
          allocated: data.sickAllocated,
        }),
        updateStaffLeaveBalanceAction({
          staffId: selectedStaff.id,
          leaveType: "earned",
          allocated: data.earnedAllocated,
        }),
      ]);

      const failedResult = results.find((r) => !r.success);

      if (failedResult) {
        setBalanceError(failedResult.error || "Failed to save customized allocations.");
      } else {
        setBalanceSuccess("Leave balances customized successfully!");
        setTimeout(() => {
          setSelectedStaff(null);
          // Reload page to reflect updated allocations in the list
          window.location.reload();
        }, 2000);
      }
    });
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case "casual":
        return "Casual Leave";
      case "sick":
        return "Sick Leave";
      case "earned":
        return "Earned Leave";
      case "maternity":
        return "Maternity Leave";
      case "paternity":
        return "Paternity Leave";
      default:
        return "Unpaid Leave";
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case "casual":
        return <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-bold uppercase">Casual</span>;
      case "sick":
        return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold uppercase">Sick</span>;
      case "earned":
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase">Earned</span>;
      case "maternity":
      case "paternity":
        return <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-full text-[10px] font-bold uppercase">{type}</span>;
      default:
        return <span className="px-2 py-0.5 bg-zinc-500/10 text-zinc-600 rounded-full text-[10px] font-bold uppercase">Unpaid</span>;
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

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Leave Board
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review staff leave applications, override custom staff balances, and configure default school policies.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pending Requests
          {pendingRequests.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary animate-pulse">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Leaves History
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === "staff"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Staff Leave Balances
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === "settings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Policy Settings
        </button>
      </div>

      {/* Dynamic Content */}
      <div className="space-y-6">
        
        {/* PENDING REQUESTS TAB */}
        {activeTab === "pending" && (
          <div className="space-y-4">
            {pendingRequests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pendingRequests.map((req) => {
                  const staff = req.staff;
                  const start = new Date(req.start_date);
                  const end = new Date(req.end_date);
                  const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  return (
                    <div
                      key={req.id}
                      className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between hover:border-primary/40 transition-all"
                    >
                      <div className="space-y-3">
                        {/* Header (Staff info) */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                            {staff?.first_name.charAt(0)}{staff?.last_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-foreground truncate">
                              {staff?.first_name} {staff?.last_name}
                            </h3>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {staff?.designation || "Staff"} • {staff?.departments?.name || "No Dept"}
                            </p>
                          </div>
                        </div>

                        <hr className="border-border" />

                        {/* Leave Details */}
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-muted-foreground">Category:</span>
                            {getLeaveTypeBadge(req.leave_type)}
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-muted-foreground">Duration:</span>
                            <span className="font-mono text-foreground font-semibold flex items-center gap-1">
                              {req.start_date} <ArrowRight className="w-3 h-3 text-muted-foreground" /> {req.end_date}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-muted-foreground">Total Days:</span>
                            <span className="font-bold text-foreground">{duration} {duration === 1 ? "day" : "days"}</span>
                          </div>

                          <div className="bg-muted/40 p-2.5 rounded-lg text-muted-foreground font-medium text-[11px] leading-relaxed mt-2.5">
                            <div className="text-[9px] font-bold uppercase text-muted-foreground/80 mb-1 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-primary" /> Reason / Explanations
                            </div>
                            <p className="line-clamp-3" title={req.reason}>
                              {req.reason}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Approval Actions */}
                      <div className="flex gap-2 pt-3 border-t border-border mt-3">
                        <button
                          onClick={() => handleProcessLeave(req.id, "approved")}
                          disabled={isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4.5 h-4.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleProcessLeave(req.id, "rejected")}
                          disabled={isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-destructive/15 hover:bg-destructive hover:text-white text-destructive font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-4.5 h-4.5" /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-60 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center p-6 bg-card/40">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-3 animate-pulse" />
                <h3 className="text-sm font-bold text-foreground">All Caught Up!</h3>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mt-1">
                  There are no pending leave requests awaiting approval. Outstanding requests filed by staff will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* LEAVES HISTORY TAB */}
        {activeTab === "history" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Staff Member</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Leave Type</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Duration Dates</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Total Days</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Reason</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Processed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyRequests.length > 0 ? (
                    historyRequests.map((req) => {
                      const staff = req.staff;
                      const start = new Date(req.start_date);
                      const end = new Date(req.end_date);
                      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                      return (
                        <tr key={req.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <div className="font-bold">{staff?.first_name} {staff?.last_name}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">
                              {staff?.designation} • {staff?.departments?.name}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getLeaveTypeBadge(req.leave_type)}
                          </td>
                          <td className="px-4 py-3 text-foreground font-semibold">
                            <div className="flex items-center gap-1 font-mono">
                              {req.start_date}
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                              {req.end_date}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground font-mono font-semibold">
                            {duration} {duration === 1 ? "day" : "days"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={req.reason}>
                            <div className="flex items-start gap-1">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <span>{req.reason}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getRequestStatusBadge(req.status)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono">
                            {req.approved_at
                              ? new Date(req.approved_at).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground font-medium italic">
                        No leave history records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STAFF LEAVE BALANCES TAB */}
        {activeTab === "staff" && (
          <div className="space-y-4">
            {/* Search Toolbar */}
            <div className="max-w-sm relative bg-card border border-border p-3 rounded-xl shadow-xs">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff balances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Balances Directory Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Staff Member</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Casual Leave (CL)</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Sick Leave (SL)</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Earned Leave (EL)</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStaff.length > 0 ? (
                      filteredStaff.map((staff) => {
                        const cl = staff.leave_balances?.find((b: any) => b.leave_type === "casual") || { allocated: 0, used: 0, remaining: 0 };
                        const sl = staff.leave_balances?.find((b: any) => b.leave_type === "sick") || { allocated: 0, used: 0, remaining: 0 };
                        const el = staff.leave_balances?.find((b: any) => b.leave_type === "earned") || { allocated: 0, used: 0, remaining: 0 };

                        return (
                          <tr key={staff.id} className="hover:bg-muted/10">
                            <td className="px-4 py-3 font-semibold text-foreground">
                              <div className="font-bold">{staff.first_name} {staff.last_name}</div>
                              <div className="text-[10px] text-muted-foreground font-normal">
                                ID: {staff.employee_id || "—"} • {staff.designation}
                              </div>
                            </td>
                            {/* Casual balance summary */}
                            <td className="px-4 py-3 text-foreground font-mono">
                              <div>Remaining: <strong className="text-indigo-600 dark:text-indigo-400">{cl.remaining}</strong></div>
                              <div className="text-[10px] text-muted-foreground">Used: {cl.used} / {cl.allocated}</div>
                            </td>
                            {/* Sick balance summary */}
                            <td className="px-4 py-3 text-foreground font-mono">
                              <div>Remaining: <strong className="text-amber-600 dark:text-amber-400">{sl.remaining}</strong></div>
                              <div className="text-[10px] text-muted-foreground">Used: {sl.used} / {sl.allocated}</div>
                            </td>
                            {/* Earned balance summary */}
                            <td className="px-4 py-3 text-foreground font-mono">
                              <div>Remaining: <strong className="text-emerald-600 dark:text-emerald-400">{el.remaining}</strong></div>
                              <div className="text-[10px] text-muted-foreground">Used: {el.used} / {el.allocated}</div>
                            </td>
                            {/* Action custom override */}
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleOpenEditBalances(staff)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 rounded-lg bg-muted/50 hover:bg-primary/10 text-xs font-semibold text-foreground hover:text-primary transition-all cursor-pointer"
                              >
                                Customize
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground font-medium italic">
                          No staff matches found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* POLICY SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xs max-w-xl">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
              <Sliders className="w-4.5 h-4.5 text-primary" />
              Configure Default Leave Policy
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              Specify the default number of leave allocations granted to new employees per academic year. Altering these settings will NOT retrospectively change existing staff member balances.
            </p>

            {settingsError && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsSuccess && (
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Casual (CL)
                  </label>
                  <input
                    {...settingsForm.register("casualDefault", { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                  />
                  {settingsForm.formState.errors.casualDefault && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {settingsForm.formState.errors.casualDefault.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Sick (SL)
                  </label>
                  <input
                    {...settingsForm.register("sickDefault", { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                  />
                  {settingsForm.formState.errors.sickDefault && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {settingsForm.formState.errors.sickDefault.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Earned (EL)
                  </label>
                  <input
                    {...settingsForm.register("earnedDefault", { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                  />
                  {settingsForm.formState.errors.earnedDefault && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {settingsForm.formState.errors.earnedDefault.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border mt-6">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Customize Staff Balances Modal */}
      <Dialog open={selectedStaff !== null} onOpenChange={(open) => !open && setSelectedStaff(null)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Customize Leave Balance
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Override leave allocations for{" "}
              <strong className="text-foreground">
                {selectedStaff?.first_name} {selectedStaff?.last_name}
              </strong>{" "}
              for the current academic year.
            </DialogDescription>
          </DialogHeader>

          {balanceError && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{balanceError}</span>
            </div>
          )}

          {balanceSuccess && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{balanceSuccess}</span>
            </div>
          )}

          <form onSubmit={staffBalanceForm.handleSubmit(onStaffBalanceSubmit)} className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Casual (CL)
                </label>
                <input
                  {...staffBalanceForm.register("casualAllocated", { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Sick (SL)
                </label>
                <input
                  {...staffBalanceForm.register("sickAllocated", { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Earned (EL)
                </label>
                <input
                  {...staffBalanceForm.register("earnedAllocated", { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
