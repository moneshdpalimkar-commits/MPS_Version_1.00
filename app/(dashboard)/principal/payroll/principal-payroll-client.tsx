"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleDollarSign,
  Plus,
  Trash2,
  ChevronLeft,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Coins,
  ArrowRight,
  TrendingDown,
  UserCheck,
  Percent,
  Calculator,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import {
  createDraftPayrollAction,
  getPayrollDetailsAction,
  updatePayslipDetailsAction,
  approvePayrollAction,
  deletePayrollAction,
} from "@/app/actions/payroll-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PrincipalPayrollClientProps {
  initialHistory: any[];
}

export function PrincipalPayrollClient({ initialHistory }: PrincipalPayrollClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State
  const [history, setHistory] = useState<any[]>(initialHistory);
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<any | null>(null);
  const [payslips, setPayslips] = useState<any[]>([]);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activePayslip, setActivePayslip] = useState<any | null>(null);

  // Form inputs
  const [draftMonth, setDraftMonth] = useState<number>(new Date().getMonth() + 1);
  const [draftYear, setDraftYear] = useState<number>(new Date().getFullYear());
  const [otherDeductionsInput, setOtherDeductionsInput] = useState<string>("0");
  
  const [standardWorkingDays, setStandardWorkingDays] = useState<number>(30);
  const [basicSalaryInput, setBasicSalaryInput] = useState<string>("0");
  const [unpaidLeavesCountInput, setUnpaidLeavesCountInput] = useState<string>("0");
  const [unpaidLeavesDeductionInput, setUnpaidLeavesDeductionInput] = useState<string>("0");
  const [latePenaltiesCountInput, setLatePenaltiesCountInput] = useState<string>("0");
  const [latePenaltiesDeductionInput, setLatePenaltiesDeductionInput] = useState<string>("0");

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Sync initial list when page revalidates
  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  const loadPayrollDetails = async (id: string) => {
    setLoadingDetails(true);
    setErrorMsg(null);
    try {
      const result = await getPayrollDetailsAction(id);
      if (result.success && result.payroll) {
        setSelectedPayrollId(id);
        setSelectedPayroll(result.payroll);
        setPayslips(result.payslips || []);
        setStandardWorkingDays(result.standardWorkingDays ?? 30);
      } else {
        setErrorMsg(result.error || "Failed to load payroll details.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Unexpected error loading details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateDraft = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await createDraftPayrollAction(draftMonth, draftYear);
      if (result.success) {
        setSuccessMsg("Payroll draft generated successfully!");
        setHistory((prev) => [
          {
            id: Math.random().toString(), // temporary visual item before reload
            month: draftMonth,
            year: draftYear,
            status: "draft",
            employeeCount: 0,
            totalNetSalary: 0,
          },
          ...prev,
        ]);
        setTimeout(() => {
          setIsCreateOpen(false);
          setSuccessMsg(null);
          router.refresh();
        }, 1500);
      } else {
        setErrorMsg(result.error || "Failed to create draft payroll.");
      }
    });
  };

  const handleOpenEditDeductions = (payslip: any) => {
    setActivePayslip(payslip);
    setBasicSalaryInput(String(payslip.basic_salary));
    setUnpaidLeavesCountInput(String(payslip.unpaid_leaves_count ?? 0));
    setUnpaidLeavesDeductionInput(String(payslip.unpaid_leaves_deduction ?? payslip.attendance_deduction ?? 0.0));
    setLatePenaltiesCountInput(String(payslip.late_penalties_count ?? 0));
    setLatePenaltiesDeductionInput(String(payslip.late_penalties_deduction ?? 0.0));
    setOtherDeductionsInput(String(payslip.other_deductions));
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEditOpen(true);
  };

  const handleUnpaidLeavesDaysChange = (daysVal: string, basicSalaryVal: string) => {
    setUnpaidLeavesCountInput(daysVal);
    const days = Number(daysVal);
    const salary = Number(basicSalaryVal);
    if (!isNaN(days) && !isNaN(salary) && days >= 0 && salary >= 0) {
      const daysInMonth = standardWorkingDays > 0 ? standardWorkingDays : 30;
      const dailyRate = salary / daysInMonth;
      setUnpaidLeavesDeductionInput(String(Number((days * dailyRate).toFixed(2))));
    }
  };

  const handleSaveAdjustments = () => {
    if (!activePayslip) return;

    const basicSalary = Number(basicSalaryInput);
    const unpaidLeavesCount = Number(unpaidLeavesCountInput);
    const unpaidLeavesDeduction = Number(unpaidLeavesDeductionInput);
    const latePenaltiesCount = Number(latePenaltiesCountInput);
    const latePenaltiesDeduction = Number(latePenaltiesDeductionInput);
    const otherDeductions = Number(otherDeductionsInput);

    if (
      isNaN(basicSalary) || basicSalary < 0 ||
      isNaN(unpaidLeavesCount) || unpaidLeavesCount < 0 ||
      isNaN(unpaidLeavesDeduction) || unpaidLeavesDeduction < 0 ||
      isNaN(latePenaltiesCount) || latePenaltiesCount < 0 ||
      isNaN(latePenaltiesDeduction) || latePenaltiesDeduction < 0 ||
      isNaN(otherDeductions) || otherDeductions < 0
    ) {
      setErrorMsg("All inputs must be non-negative numbers.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await updatePayslipDetailsAction({
        payslipId: activePayslip.id,
        basicSalary,
        unpaidLeavesCount,
        unpaidLeavesDeduction,
        latePenaltiesCount,
        latePenaltiesDeduction,
        otherDeductions,
      });

      if (result.success) {
        setSuccessMsg("Adjustments saved successfully.");
        // Refetch details locally
        if (selectedPayrollId) {
          await loadPayrollDetails(selectedPayrollId);
        }
        setTimeout(() => {
          setIsEditOpen(false);
          setSuccessMsg(null);
        }, 1200);
      } else {
        setErrorMsg(result.error || "Failed to save adjustments.");
      }
    });
  };

  const handleApprovePayroll = (id: string) => {
    if (confirm("Are you sure you want to approve and freeze this payroll? This will publish the payslips for staff members.")) {
      startTransition(async () => {
        const result = await approvePayrollAction(id);
        if (result.success) {
          alert("Payroll run approved successfully! Payslips are now published.");
          setSelectedPayrollId(null);
          setSelectedPayroll(null);
          setPayslips([]);
          router.refresh();
        } else {
          alert(result.error || "Failed to approve payroll.");
        }
      });
    }
  };

  const handleDeleteDraft = (id: string, e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (confirm("Are you sure you want to delete this draft payroll worksheet? This will remove all associated calculations.")) {
      startTransition(async () => {
        const result = await deletePayrollAction(id);
        if (result.success) {
          alert("Payroll draft deleted successfully.");
          if (selectedPayrollId === id) {
            setSelectedPayrollId(null);
            setSelectedPayroll(null);
            setPayslips([]);
          }
          router.refresh();
        } else {
          alert(result.error || "Failed to delete draft.");
        }
      });
    }
  };

  const getMonthName = (monthNum: number) => {
    return new Date(2000, monthNum - 1, 1).toLocaleString("default", { month: "long" });
  };

  // Aggregated Stats
  const approvedRuns = history.filter((p) => p.status === "approved");
  const totalApprovedPaid = approvedRuns.reduce((sum, r) => sum + r.totalNetSalary, 0);
  const activeDraft = history.find((p) => p.status === "draft");

  return (
    <div className="space-y-6">
      
      {/* 1. Main History & Dashboard View */}
      {!selectedPayrollId ? (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Total Disbursed (Approved)
                </span>
                <span className="text-xl font-extrabold text-foreground block font-mono">
                  ₹{totalApprovedPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Total Payroll Runs
                </span>
                <span className="text-xl font-extrabold text-foreground block font-mono">
                  {history.length} runs
                </span>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Pending Approvals
                </span>
                <span className="text-xl font-extrabold text-foreground block">
                  {activeDraft ? `1 Draft (${getMonthName(activeDraft.month)})` : "None"}
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-xs">
            <div className="space-y-1">
              <h1 className="text-xl font-extrabold text-foreground font-sans flex items-center gap-2">
                <CircleDollarSign className="w-5.5 h-5.5 text-primary" />
                Payroll Workspace
              </h1>
              <p className="text-xs text-muted-foreground font-semibold">
                Generate monthly salary worksheets, calculate statutory deductions, and publish payslips.
              </p>
            </div>

            <button
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-sm hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Run New Payroll
            </button>
          </div>

          {/* History List */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-border">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Payroll Runs History ({history.length})
              </h2>
            </div>

            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                      <th className="p-4">Period</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Employee Count</th>
                      <th className="p-4">Net Salary Outflow</th>
                      <th className="p-4">Release Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((run) => (
                      <tr
                        key={run.id}
                        onClick={() => loadPayrollDetails(run.id)}
                        className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <td className="p-4 font-bold text-foreground">
                          {getMonthName(run.month)} {run.year}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 border text-[9px] font-extrabold uppercase rounded-full tracking-wider ${
                              run.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-muted-foreground">
                          {run.employeeCount} employees
                        </td>
                        <td className="p-4 font-mono font-bold text-foreground">
                          ₹{run.totalNetSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 font-semibold text-muted-foreground">
                          {run.approvedAt
                            ? new Date(run.approvedAt).toLocaleDateString([], {
                                dateStyle: "medium",
                              })
                            : "--"}
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => loadPayrollDetails(run.id)}
                              className="px-2.5 py-1 border border-border hover:border-primary/40 rounded-lg text-[10px] font-bold text-foreground hover:text-primary transition-all cursor-pointer"
                            >
                              Inspect Sheet
                            </button>
                            {run.status === "draft" && (
                              <button
                                onClick={(e) => handleDeleteDraft(run.id, e)}
                                disabled={isPending}
                                className="p-1.5 border border-border hover:border-destructive/40 rounded-lg text-muted-foreground hover:text-destructive transition-all cursor-pointer disabled:opacity-50"
                                title="Delete Draft Worksheet"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-center p-6">
                <CircleDollarSign className="w-10 h-10 text-muted-foreground/45 mb-2 animate-pulse" />
                <p className="text-sm font-extrabold text-foreground">No Payroll Runs Yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Click the "Run New Payroll" button to initialize a draft salary sheet.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* 2. Detailed Sheet Inspector View */
        <div className="space-y-6">
          
          {/* Detailed Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedPayrollId(null);
                  setSelectedPayroll(null);
                  setPayslips([]);
                }}
                className="p-2 border border-border hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-extrabold text-foreground font-sans flex items-center gap-2">
                  Salary Worksheet — {getMonthName(selectedPayroll.month)} {selectedPayroll.year}
                  <span
                    className={`px-2.5 py-0.5 border text-[9px] font-extrabold uppercase rounded-full tracking-wider ${
                      selectedPayroll.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    }`}
                  >
                    {selectedPayroll.status}
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                  Verify attendance deductions, edit adjustments, and finalize payout.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {selectedPayroll.status === "draft" && (
                <>
                  <button
                    onClick={(e) => handleDeleteDraft(selectedPayroll.id, e)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 px-3.5 py-2 border border-border hover:border-destructive/40 rounded-xl text-xs font-bold text-muted-foreground hover:text-destructive transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Draft
                  </button>
                  <button
                    onClick={() => handleApprovePayroll(selectedPayroll.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-sm hover:scale-[1.02] cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" /> Approve & Dispatch
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Payslips Sheet Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Payslips Sheet Details ({payslips.length} items)
              </h2>
              <div className="text-xs font-bold text-foreground">
                Total Sheet Net Payout:{" "}
                <span className="font-mono text-sm text-primary ml-1">
                  ₹
                  {payslips
                    .reduce((sum, s) => sum + Number(s.net_salary), 0)
                    .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Base Salary</th>
                    <th className="p-4 text-rose-500">Unpaid Leaves</th>
                    <th className="p-4 text-rose-500">Late Penalties</th>
                    <th className="p-4 text-rose-500">Other Deduct</th>
                    <th className="p-4 font-extrabold text-primary">Net Salary</th>
                    {selectedPayroll.status === "draft" && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((slip) => (
                    <tr
                      key={slip.id}
                      className="border-b border-border hover:bg-muted/10 transition-colors"
                    >
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">
                            {slip.staff?.first_name} {slip.staff?.last_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-semibold">
                            {slip.staff?.designation || "Staff"} ({slip.staff?.employee_id})
                          </p>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-semibold text-foreground">₹{Number(slip.basic_salary).toFixed(2)}</td>
                      <td className="p-4">
                        <div className="font-mono text-rose-600 font-semibold">
                          ₹{Number(slip.unpaid_leaves_deduction ?? slip.attendance_deduction ?? 0.0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold">
                          {slip.unpaid_leaves_count ?? 0} days
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-rose-600 font-semibold">
                          ₹{Number(slip.late_penalties_deduction ?? 0.0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold">
                          {slip.late_penalties_count ?? 0} times
                        </div>
                      </td>
                      <td className="p-4 font-mono text-rose-600 font-semibold">
                        ₹{Number(slip.other_deductions).toFixed(2)}
                      </td>
                      <td className="p-4 font-mono font-extrabold text-foreground text-sm">
                        ₹{Number(slip.net_salary).toFixed(2)}
                      </td>
                      {selectedPayroll.status === "draft" && (
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleOpenEditDeductions(slip)}
                            className="px-2.5 py-1 border border-border hover:border-primary/45 rounded-lg text-[10px] font-bold text-foreground hover:text-primary transition-all cursor-pointer"
                          >
                            Adjust
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DRAFT MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => !open && setIsCreateOpen(false)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Run New Payroll</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generate monthly draft worksheet calculating salaries, PF, taxes, and attendance deductions.
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

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Select Month
                </label>
                <select
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      {getMonthName(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Select Year
                </label>
                <select
                  value={draftYear}
                  onChange={(e) => setDraftYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  {[
                    new Date().getFullYear() - 1,
                    new Date().getFullYear(),
                    new Date().getFullYear() + 1,
                  ].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2 text-xs">
              <h4 className="font-bold text-foreground flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-primary" /> Auto-Calculation Rules
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Draft payroll will fetch the base salary and sync against attendance and leave records for the selected month to calculate:
              </p>
              <ul className="list-disc list-inside text-[10px] text-muted-foreground space-y-0.5 pl-1.5 font-semibold">
                <li>Daily Rate = Base Salary / Standard Working Days</li>
                <li>Unpaid Leaves = Days × Daily Rate deduction</li>
                <li>Late Penalty = Flat penalty per late check-in OR Hourly penalty based on exact minutes late</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2.5 pt-3.5 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-accent text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDraft}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Generate Draft Sheet
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DEDUCTIONS DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={(open) => !open && setIsEditOpen(false)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-2xl p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Edit & Adjust Payslip</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify salary details, unpaid leaves, late penalties, or other adjustments for this staff member.
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

          {activePayslip && (
            <div className="space-y-4 mt-4 text-xs">
              <div className="border border-border rounded-xl p-4 bg-muted/20">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Staff Member</span>
                <span className="font-bold text-foreground text-sm">{activePayslip.staff?.first_name} {activePayslip.staff?.last_name}</span>
                <span className="text-[10px] text-muted-foreground block font-semibold mt-0.5">{activePayslip.staff?.designation || "Staff"} ({activePayslip.staff?.employee_id})</span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                    Base Salary (₹)
                  </label>
                  <input
                    type="number"
                    value={basicSalaryInput}
                    onChange={(e) => {
                      setBasicSalaryInput(e.target.value);
                      handleUnpaidLeavesDaysChange(unpaidLeavesCountInput, e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden font-mono"
                    min="0"
                    step="0.01"
                  />
                  <span className="text-[9px] text-muted-foreground mt-0.5 block font-semibold leading-tight">
                    * Updates staff profile permanently
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                    Other Deductions (₹)
                  </label>
                  <input
                    type="number"
                    value={otherDeductionsInput}
                    onChange={(e) => setOtherDeductionsInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden font-mono"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="border border-border rounded-xl p-4 space-y-3.5">
                <h4 className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Unpaid Leaves Override</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                      Days Count
                    </label>
                    <input
                      type="number"
                      value={unpaidLeavesCountInput}
                      onChange={(e) => handleUnpaidLeavesDaysChange(e.target.value, basicSalaryInput)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden font-mono"
                      min="0"
                      step="1"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                      Deduction (₹)
                    </label>
                    <input
                      type="number"
                      value={unpaidLeavesDeductionInput}
                      onChange={(e) => setUnpaidLeavesDeductionInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden font-mono"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-xl p-4 space-y-3.5">
                <h4 className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Late Penalties Override</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                      Late Count (times)
                    </label>
                    <input
                      type="number"
                      value={latePenaltiesCountInput}
                      onChange={(e) => setLatePenaltiesCountInput(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden font-mono"
                      min="0"
                      step="1"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                      Deduction (₹)
                    </label>
                    <input
                      type="number"
                      value={latePenaltiesDeductionInput}
                      onChange={(e) => setLatePenaltiesDeductionInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden font-mono"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 border border-primary/20 rounded-xl bg-primary/5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Computed Net salary
                </span>
                <span className="text-base font-mono font-black text-primary">
                  ₹{(() => {
                    const salary = Number(basicSalaryInput) || 0;
                    const unpaid = Number(unpaidLeavesDeductionInput) || 0;
                    const late = Number(latePenaltiesDeductionInput) || 0;
                    const other = Number(otherDeductionsInput) || 0;
                    return Math.max(0, salary - (unpaid + late + other));
                  })().toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-border mt-5">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-accent text-foreground transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAdjustments}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
