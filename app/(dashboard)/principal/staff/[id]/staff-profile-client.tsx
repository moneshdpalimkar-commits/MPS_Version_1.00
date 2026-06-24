"use client";

import React, { useState, useTransition } from "react";
import { User, Phone, MapPin, Activity, ShieldAlert, Heart, CalendarDays, Wallet, UserCheck, Landmark, Camera, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BiometricsClient } from "./biometrics-client";
import { updateStaffLeaveBalanceAction } from "@/app/actions/leave-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StaffProfileClientProps {
  staff: any;
  attendance: any[];
  leaves: any[];
  templates: any[];
}

type TabType = "personal" | "employment" | "attendance" | "leave" | "payroll" | "biometrics";

export function StaffProfileClient({ staff, attendance, leaves, templates }: StaffProfileClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [isPending, startTransition] = useTransition();

  // Edit balance state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [casualAlloc, setCasualAlloc] = useState(
    leaves.find((l) => l.leave_type === "casual")?.allocated ?? 10
  );
  const [sickAlloc, setSickAlloc] = useState(
    leaves.find((l) => l.leave_type === "sick")?.allocated ?? 8
  );
  const [earnedAlloc, setEarnedAlloc] = useState(
    leaves.find((l) => l.leave_type === "earned")?.allocated ?? 5
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const results = await Promise.all([
        updateStaffLeaveBalanceAction({
          staffId: staff.id,
          leaveType: "casual",
          allocated: casualAlloc,
        }),
        updateStaffLeaveBalanceAction({
          staffId: staff.id,
          leaveType: "sick",
          allocated: sickAlloc,
        }),
        updateStaffLeaveBalanceAction({
          staffId: staff.id,
          leaveType: "earned",
          allocated: earnedAlloc,
        }),
      ]);

      const failed = results.find((r) => !r.success);

      if (failed) {
        setErrorMsg(failed.error || "Failed to save customized allocations.");
      } else {
        setSuccessMsg("Allocated balances updated successfully!");
        setTimeout(() => {
          setIsEditOpen(false);
          window.location.reload();
        }, 1500);
      }
    });
  };

  const tabs = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "employment", label: "Employment", icon: Landmark },
    { id: "attendance", label: "Attendance Log", icon: Activity },
    { id: "leave", label: "Leaves Balance", icon: CalendarDays },
    { id: "payroll", label: "Payroll Details", icon: Wallet },
    { id: "biometrics", label: "Face Biometrics", icon: Camera },
  ] as const;

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-300">
      
      {/* Profile Header Banner */}
      <div className="bg-card border border-border rounded-xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
          {staff.first_name.charAt(0)}{staff.last_name.charAt(0)}
        </div>
        <div className="text-center md:text-left flex-1 space-y-1">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              {staff.first_name} {staff.last_name}
            </h1>
            <span className={cn(
              "inline-flex items-center self-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize",
              staff.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
            )}>
              {staff.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {staff.designation || "No Designation"} — <span className="capitalize">{staff.staff_role} Staff</span>
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">
            {staff.email}
          </p>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex border-b border-border overflow-x-auto no-scrollbar gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all cursor-pointer whitespace-nowrap",
                isActive && "border-primary text-primary font-bold"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab Body content */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-2xs min-h-[300px]">
        
        {/* Personal Info Tab */}
        {activeTab === "personal" && (
          <div className="space-y-6">
            <h2 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              Contact & Biological Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</span>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {staff.phone || "N/A"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Blood Group</span>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  {staff.blood_group || "N/A"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Emergency Contact</span>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
                  {staff.emergency_contact || "N/A"}
                </p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Residential Address</span>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  {staff.address || "No Address registered"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Employment Tab */}
        {activeTab === "employment" && (
          <div className="space-y-6">
            <h2 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-primary" />
              Contract Details & Status
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Employee ID</span>
                <p className="text-sm font-mono font-medium text-foreground">{staff.employee_id || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Department</span>
                <p className="text-sm font-medium text-foreground">{staff.departments?.name || "General / No Department"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Designation</span>
                <p className="text-sm font-medium text-foreground">{staff.designation || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Contract Category</span>
                <p className="text-sm font-medium text-foreground capitalize">{staff.staff_role}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Joining Date</span>
                <p className="text-sm font-medium text-foreground">
                  {staff.join_date ? new Date(staff.join_date).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Log Tab */}
        {activeTab === "attendance" && (
          <div className="space-y-6">
            <h2 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-primary" />
              Monthly Attendance Tracker (Rollup View)
            </h2>
            {attendance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month/Year</TableHead>
                    <TableHead>Present Days</TableHead>
                    <TableHead>Late Days</TableHead>
                    <TableHead>Absent Days</TableHead>
                    <TableHead>Half Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((rollup, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold text-xs text-foreground">
                        {new Date(rollup.year, rollup.month - 1).toLocaleString("default", { month: "long" })} {rollup.year}
                      </TableCell>
                      <TableCell className="text-xs text-emerald-600 font-semibold">{rollup.present_days}</TableCell>
                      <TableCell className="text-xs text-amber-600 font-medium">{rollup.late_days}</TableCell>
                      <TableCell className="text-xs text-destructive font-medium">{rollup.absent_days}</TableCell>
                      <TableCell className="text-xs text-blue-600 font-medium">{rollup.half_days}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-xs text-muted-foreground p-8">
                No monthly attendance logs found for this staff member.
              </div>
            )}
          </div>
        )}

        {/* Leaves Balance Tab */}
        {activeTab === "leave" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-primary" />
                Current Leaves Status
              </h2>
              {leaves.length > 0 && (
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border hover:border-primary/50 rounded-lg bg-muted/50 hover:bg-primary/10 text-xs font-semibold text-foreground hover:text-primary transition-all cursor-pointer"
                >
                  Edit Allocations
                </button>
              )}
            </div>
            {leaves.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Allocated Limit</TableHead>
                    <TableHead>Days Used</TableHead>
                    <TableHead>Remaining Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((bal) => (
                    <TableRow key={bal.id}>
                      <TableCell className="font-semibold text-xs text-foreground capitalize">{bal.leave_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{bal.allocated}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{bal.used}</TableCell>
                      <TableCell className="text-xs text-emerald-600 font-bold">{bal.remaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-xs text-muted-foreground p-8">
                No leave balance limits initialized for the current academic year.
              </div>
            )}
          </div>
        )}

        {/* Payroll Details Tab */}
        {activeTab === "payroll" && (
          <div className="space-y-6">
            <h2 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-primary" />
              Base Salary Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Base Monthly Salary</span>
                <p className="text-sm font-semibold text-foreground">${Number(staff.base_salary).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Monthly Allowances</span>
                <p className="text-sm font-semibold text-foreground">${Number(staff.allowance).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Provident Fund (PF) Rate</span>
                <p className="text-sm font-semibold text-foreground">{staff.pf_pct}%</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Professional Tax Deductions</span>
                <p className="text-sm font-semibold text-foreground">${Number(staff.professional_tax).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Face Biometrics Tab */}
        {activeTab === "biometrics" && (
          <BiometricsClient
            staffId={staff.id}
            faceRegistered={staff.face_registered}
            attempts={staff.face_registration_attempts}
            templates={templates}
          />
        )}

      </div>

      {/* Edit Balances Dialog Modal */}
      <Dialog open={isEditOpen} onOpenChange={(open) => !open && setIsEditOpen(false)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Customize Staff Leaves
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Override allocated leave days for {staff.first_name} {staff.last_name}.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleOverrideSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Casual (CL)
                </label>
                <input
                  type="number"
                  value={casualAlloc}
                  onChange={(e) => setCasualAlloc(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Sick (SL)
                </label>
                <input
                  type="number"
                  value={sickAlloc}
                  onChange={(e) => setSickAlloc(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Earned (EL)
                </label>
                <input
                  type="number"
                  value={earnedAlloc}
                  onChange={(e) => setEarnedAlloc(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
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
                Save Allocations
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
