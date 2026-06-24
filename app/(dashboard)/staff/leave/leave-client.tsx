"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarDays,
  Clock,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  CheckCircle,
  FileText,
  Plus,
  ArrowRight,
} from "lucide-react";
import { applyLeaveRequestAction } from "@/app/actions/leave-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Form Validation Schema
const leaveSchema = z.object({
  leaveType: z.enum(["casual", "sick", "earned", "maternity", "paternity", "unpaid"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return start <= end;
}, {
  message: "End date must be greater than or equal to start date",
  path: ["endDate"],
});

type LeaveFormInput = z.infer<typeof leaveSchema>;

interface LeaveClientProps {
  staffName: string;
  initialBalances: any[];
  initialRequests: any[];
}

export function LeaveClient({
  staffName,
  initialBalances,
  initialRequests,
}: LeaveClientProps) {
  const [isPending, startTransition] = useTransition();

  const [balances, setBalances] = useState<any[]>(initialBalances);
  const [requests, setRequests] = useState<any[]>(initialRequests);

  // Form Dialog Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form hook
  const leaveForm = useForm<LeaveFormInput>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leaveType: "casual",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });

  const onSubmit = async (data: LeaveFormInput) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Clientside check: check if remaining balance is sufficient (except unpaid)
    if (data.leaveType !== "unpaid") {
      const targetBal = balances.find((b) => b.leave_type === data.leaveType);
      if (targetBal) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const requestedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        if (requestedDays > targetBal.remaining) {
          setErrorMsg(
            `Insufficient leaves. You requested ${requestedDays} days of ${getLeaveTypeLabel(
              data.leaveType
            )} but only have ${targetBal.remaining} days remaining.`
          );
          return;
        }
      }
    }

    startTransition(async () => {
      const result = await applyLeaveRequestAction({
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
      });

      if (result.success) {
        setSuccessMsg("Leave request submitted successfully!");
        setTimeout(() => {
          setIsOpen(false);
          // Reload to refresh balances and requests list
          window.location.reload();
        }, 2000);
      } else {
        setErrorMsg(result.error || "Failed to submit request.");
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Approved</span>;
      case "rejected":
        return <span className="px-2.5 py-0.5 bg-rose-500/10 text-rose-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Rejected</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Pending</span>;
    }
  };

  const getBalanceCardStyle = (type: string) => {
    switch (type) {
      case "casual":
        return {
          bg: "bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/15 hover:border-indigo-500/35",
          accentText: "text-indigo-600 dark:text-indigo-400",
          progressColor: "bg-indigo-500",
        };
      case "sick":
        return {
          bg: "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/15 hover:border-amber-500/35",
          accentText: "text-amber-600 dark:text-amber-400",
          progressColor: "bg-amber-500",
        };
      case "earned":
        return {
          bg: "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/15 hover:border-emerald-500/35",
          accentText: "text-emerald-600 dark:text-emerald-400",
          progressColor: "bg-emerald-500",
        };
      default:
        return {
          bg: "bg-zinc-500/5 hover:bg-zinc-500/10 border-zinc-500/15 hover:border-zinc-500/35",
          accentText: "text-zinc-600 dark:text-zinc-400",
          progressColor: "bg-zinc-500",
        };
    }
  };

  const handleOpenDialog = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    leaveForm.reset({
      leaveType: "casual",
      startDate: "",
      endDate: "",
      reason: "",
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Leave Balances Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {["casual", "sick", "earned"].map((type) => {
          const bal = balances.find((b) => b.leave_type === type) || {
            allocated: 0,
            used: 0,
            remaining: 0,
          };
          const style = getBalanceCardStyle(type);
          const percentageUsed = bal.allocated > 0 ? (bal.used / bal.allocated) * 100 : 0;

          return (
            <div
              key={type}
              className={`border rounded-2xl p-5 shadow-2xs transition-all duration-300 flex flex-col justify-between ${style.bg}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    {getLeaveTypeLabel(type)}
                  </span>
                  <span className={`text-3xl font-extrabold tracking-tight mt-1.5 block ${style.accentText}`}>
                    {bal.remaining}
                    <span className="text-xs text-muted-foreground font-normal ml-1">days left</span>
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center">
                  <CalendarDays className={`w-5 h-5 ${style.accentText}`} />
                </div>
              </div>

              {/* Progress and rollup info */}
              <div className="mt-6 space-y-2">
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${style.progressColor}`}
                    style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold uppercase">
                  <span>Used: {bal.used} days</span>
                  <span>Allocated: {bal.allocated} days</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Panel Toolbar & Requests History */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Leave History & Requests</h2>
          </div>

          <button
            onClick={handleOpenDialog}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Request Leave
          </button>
        </div>

        {/* History Table */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Date Filed</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Leave Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Duration</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Total Days</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Reason</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.length > 0 ? (
                  requests.map((req) => {
                    const start = new Date(req.start_date);
                    const end = new Date(req.end_date);
                    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                    return (
                      <tr key={req.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {new Date(req.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground capitalize">
                          {getLeaveTypeLabel(req.leave_type)}
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
                        <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate" title={req.reason}>
                          <div className="flex items-start gap-1">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span>{req.reason}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(req.status)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground font-medium italic">
                      No leave requests filed yet. Click "Request Leave" above to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Apply Leave Request Dialog Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Apply for Leave
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select your leave category, dates, and provide a clear explanation for review.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={leaveForm.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Leave Type
              </label>
              <select
                {...leaveForm.register("leaveType")}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
              >
                <option value="casual">Casual Leave (CL)</option>
                <option value="sick">Sick Leave (SL)</option>
                <option value="earned">Earned Leave (EL)</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Start Date
                </label>
                <input
                  {...leaveForm.register("startDate")}
                  type="date"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                />
                {leaveForm.formState.errors.startDate && (
                  <span className="text-xs text-destructive mt-0.5 block">
                    {leaveForm.formState.errors.startDate.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  End Date
                </label>
                <input
                  {...leaveForm.register("endDate")}
                  type="date"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                />
                {leaveForm.formState.errors.endDate && (
                  <span className="text-xs text-destructive mt-0.5 block">
                    {leaveForm.formState.errors.endDate.message}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Reason / Remarks
              </label>
              <textarea
                {...leaveForm.register("reason")}
                rows={3}
                placeholder="Details of the leave request..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden placeholder:text-muted-foreground/60 resize-none"
              />
              {leaveForm.formState.errors.reason && (
                <span className="text-xs text-destructive mt-0.5 block">
                  {leaveForm.formState.errors.reason.message}
                </span>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
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
                Submit Request
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
