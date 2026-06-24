"use client";

import React, { useState } from "react";
import {
  CircleDollarSign,
  Download,
  FileText,
  Calendar,
  Clock,
  TrendingDown,
  Percent,
  Coins,
  X,
  Printer,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StaffPayrollClientProps {
  initialPayslips: any[];
}

export function StaffPayrollClient({ initialPayslips }: StaffPayrollClientProps) {
  const [payslips] = useState<any[]>(initialPayslips);
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null);

  const getMonthName = (monthNum: number) => {
    return new Date(2000, monthNum - 1, 1).toLocaleString("default", { month: "long" });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* Hide all screen-only elements */
          body * {
            visibility: hidden !important;
          }
          /* Show only the printable payslip area */
          #print-payslip-area,
          #print-payslip-area * {
            visibility: visible !important;
          }
          #print-payslip-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Header section */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
        <h1 className="text-xl font-extrabold text-foreground font-sans flex items-center gap-2">
          <CircleDollarSign className="w-5.5 h-5.5 text-primary" />
          My Payslips
        </h1>
        <p className="text-xs text-muted-foreground font-semibold mt-1">
          View your monthly earnings statement, tax summaries, and download vector payslips.
        </p>
      </div>

      {/* Payslips Feed List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-border">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Salary Statements ({payslips.length})
          </h2>
        </div>

        {payslips.length > 0 ? (
          <div className="divide-y divide-border">
            {payslips.map((slip) => (
              <div
                key={slip.id}
                onClick={() => setSelectedSlip(slip)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Salary Statement — {getMonthName(slip.payroll.month)} {slip.payroll.year}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      Released on {new Date(slip.payroll.approved_at).toLocaleDateString([], { dateStyle: "medium" })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6">
                  <div className="text-left sm:text-right">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">
                      Net Payout
                    </span>
                    <span className="text-sm font-extrabold text-foreground font-mono">
                      ₹{Number(slip.net_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-60 flex flex-col items-center justify-center text-center p-6">
            <CircleDollarSign className="w-10 h-10 text-muted-foreground/45 mb-2.5 animate-pulse" />
            <p className="text-sm font-extrabold text-foreground">No Payslips Released Yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Your payslips will display here once the school principal approves and publishes the monthly payroll.
            </p>
          </div>
        )}
      </div>

      {/* PAYSLIP DETAIL & PRINT PREVIEW DIALOG */}
      <Dialog open={!!selectedSlip} onOpenChange={(open) => !open && setSelectedSlip(null)}>
        <DialogContent className="max-w-2xl w-full bg-card border border-border rounded-2xl p-6 overflow-y-auto max-h-[90vh]">
          {selectedSlip && (
            <div className="space-y-6">
              
              {/* Screen Only Actions */}
              <div className="flex justify-between items-center pb-2.5 border-b border-border">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Payslip Preview
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 bg-background text-[10px] font-bold rounded-lg text-foreground hover:text-primary transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print / PDF
                  </button>
                  <button
                    onClick={() => setSelectedSlip(null)}
                    className="p-1.5 border border-border hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Payslip Invoice Area */}
              <div
                id="print-payslip-area"
                className="bg-background border border-border rounded-xl p-6 space-y-6 text-foreground font-sans text-xs"
              >
                {/* School Header */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b-2 border-primary">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <GraduationCap className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                        {selectedSlip.staff?.school?.name || "MPS Staff Portal"}
                      </h2>
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        Monthly Earnings Statement
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest">
                      Salary Slip
                    </h3>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Ref: PS-{selectedSlip.id.substring(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-muted/20 border border-border rounded-xl p-4">
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">Employee ID</span>
                    <span className="font-bold text-foreground uppercase">{selectedSlip.staff?.employee_id || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">Pay Period</span>
                    <span className="font-bold text-foreground">
                      {getMonthName(selectedSlip.payroll.month)} {selectedSlip.payroll.year}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">Staff Member</span>
                    <span className="font-bold text-foreground">
                      {selectedSlip.staff?.first_name} {selectedSlip.staff?.last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">Payment Mode</span>
                    <span className="font-bold text-foreground">Bank Transfer</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">Designation</span>
                    <span className="font-bold text-foreground capitalize">
                      {selectedSlip.staff?.designation || "Staff"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">Disbursement Date</span>
                    <span className="font-bold text-foreground">
                      {new Date(selectedSlip.payroll.approved_at).toLocaleDateString([], {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>
                </div>

                {/* Earnings & Deductions Tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Earnings */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="bg-muted/30 p-2.5 border-b border-border font-bold uppercase text-[9px] tracking-wider text-foreground">
                      Earnings
                    </div>
                    <table className="w-full text-left text-xs">
                      <tbody>
                        <tr className="border-b border-border hover:bg-muted/10">
                          <td className="p-3 text-muted-foreground font-semibold">Base Salary</td>
                          <td className="p-3 font-mono font-bold text-right">
                            ₹{Number(selectedSlip.basic_salary).toFixed(2)}
                          </td>
                        </tr>
                        <tr className="bg-muted/10 font-bold">
                          <td className="p-3 text-foreground">Total Earnings (Gross)</td>
                          <td className="p-3 font-mono text-right text-primary">
                            ₹{Number(selectedSlip.basic_salary).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Deductions */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="bg-muted/30 p-2.5 border-b border-border font-bold uppercase text-[9px] tracking-wider text-foreground">
                      Deductions
                    </div>
                    <table className="w-full text-left text-xs">
                      <tbody>
                        <tr className="border-b border-border hover:bg-muted/10">
                          <td className="p-3 text-rose-500 font-semibold">Unpaid Leaves ({selectedSlip.unpaid_leaves_count ?? 0} days)</td>
                          <td className="p-3 font-mono font-bold text-right text-rose-600">
                            ₹{Number(selectedSlip.unpaid_leaves_deduction ?? selectedSlip.attendance_deduction ?? 0.0).toFixed(2)}
                          </td>
                        </tr>
                        <tr className="border-b border-border hover:bg-muted/10">
                          <td className="p-3 text-rose-500 font-semibold">Late Penalties ({selectedSlip.late_penalties_count ?? 0} times)</td>
                          <td className="p-3 font-mono font-bold text-right text-rose-600">
                            ₹{Number(selectedSlip.late_penalties_deduction ?? 0.0).toFixed(2)}
                          </td>
                        </tr>
                        <tr className="border-b border-border hover:bg-muted/10">
                          <td className="p-3 text-rose-500 font-semibold">Adjustments / Other</td>
                          <td className="p-3 font-mono font-bold text-right text-rose-600">
                            ₹{Number(selectedSlip.other_deductions).toFixed(2)}
                          </td>
                        </tr>
                        <tr className="bg-muted/10 font-bold">
                          <td className="p-3 text-foreground">Total Deductions</td>
                          <td className="p-3 font-mono text-right text-rose-600">
                            ₹{
                              (
                                Number(selectedSlip.unpaid_leaves_deduction ?? selectedSlip.attendance_deduction ?? 0.0) +
                                Number(selectedSlip.late_penalties_deduction ?? 0.0) +
                                Number(selectedSlip.other_deductions)
                              ).toFixed(2)
                            }
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Salary Block */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border border-primary/20 rounded-xl bg-primary/5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block tracking-wider">
                      Net Take-Home Salary
                    </span>
                    <span className="text-xs font-bold text-foreground capitalize">
                      {numberToWords(Number(selectedSlip.net_salary))}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-primary font-mono block">
                      ₹{Number(selectedSlip.net_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="pt-4 border-t border-border flex justify-between items-center text-[9px] text-muted-foreground font-semibold uppercase">
                  <span>Generates automatically by school system</span>
                  <span>Requires no signature</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Indian Rupee Number to Words Generator
function numberToWords(num: number): string {
  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const cleanNum = Math.floor(num);
  if (cleanNum === 0) return "zero";

  function g(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  }

  function h(n: number): string {
    if (n < 100) return g(n);
    return a[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + g(n % 100) : "");
  }

  let n = cleanNum;
  let str = "";

  if (Math.floor(n / 10000000)) {
    str += h(Math.floor(n / 10000000)) + " crore ";
    n %= 10000000;
  }
  if (Math.floor(n / 100000)) {
    str += h(Math.floor(n / 100000)) + " lakh ";
    n %= 100000;
  }
  if (Math.floor(n / 1000)) {
    str += h(Math.floor(n / 1000)) + " thousand ";
    n %= 1000;
  }
  if (n) {
    str += h(n);
  }

  return str.trim() + " Rupees only";
}
