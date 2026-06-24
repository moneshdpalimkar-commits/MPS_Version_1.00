"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarDays,
  CircleDollarSign,
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
} from "lucide-react";
import { saveSchoolPayrollSettingsAction } from "@/app/actions/payroll-actions";

const payrollSettingsSchema = z.object({
  standardWorkingDays: z.string()
    .min(1, "Standard working days is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 31, "Must be between 1 and 31"),
  latePenaltyType: z.enum(["flat", "hourly"]),
  latePenaltyAmount: z.string()
    .min(1, "Penalty amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a positive number"),
});

type PayrollSettingsInput = z.infer<typeof payrollSettingsSchema>;

interface SchoolSettingsClientProps {
  initialSettings: any;
}

export function SchoolSettingsClient({ initialSettings }: SchoolSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PayrollSettingsInput>({
    resolver: zodResolver(payrollSettingsSchema),
    defaultValues: {
      standardWorkingDays: String(initialSettings?.standard_working_days ?? 30),
      latePenaltyType: initialSettings?.late_penalty_type ?? "flat",
      latePenaltyAmount: String(initialSettings?.late_penalty_amount ?? 0),
    },
  });

  const penaltyType = watch("latePenaltyType");

  const onSubmit = (data: PayrollSettingsInput) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await saveSchoolPayrollSettingsAction({
        standardWorkingDays: Number(data.standardWorkingDays),
        latePenaltyType: data.latePenaltyType,
        latePenaltyAmount: Number(data.latePenaltyAmount),
      });

      if (result.success) {
        setSuccessMsg("Payroll settings updated successfully!");
        router.refresh();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(result.error || "Failed to update settings.");
      }
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-12 max-w-5xl">
      {/* Settings Card */}
      <div className="md:col-span-8 bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Payroll & Penalty Rules</h2>
              <p className="text-xs text-muted-foreground">Configure standard working month parameters and late-arrival deduction rules.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-300">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Standard Working Days */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Standard Working Days in Month
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <CalendarDays className="w-4 h-4" />
              </div>
              <input
                {...register("standardWorkingDays")}
                type="text"
                placeholder="30"
                className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 font-medium"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Standard number of working days used to calculate the per-day salary rate: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Salary / Working Days</code>.
            </p>
            {errors.standardWorkingDays && (
              <span className="text-xs text-rose-500 block">{errors.standardWorkingDays.message}</span>
            )}
          </div>

          <hr className="border-border" />

          {/* Late Penalty Rule */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
              Late Check-In Penalties
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Penalty Type */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">
                  Penalty Calculation Type
                </label>
                <select
                  {...register("latePenaltyType")}
                  className="w-full px-3 py-2.5 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary font-medium"
                >
                  <option value="flat">Flat Amount (Per Late Day)</option>
                  <option value="hourly">Hourly Rate (Based on Minutes Late)</option>
                </select>
              </div>

              {/* Penalty Value */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">
                  {penaltyType === "flat" ? "Flat Deduction Amount ($)" : "Hourly Penalty Rate ($)"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <CircleDollarSign className="w-4 h-4" />
                  </div>
                  <input
                    {...register("latePenaltyAmount")}
                    type="text"
                    placeholder="10.00"
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 font-mono font-medium"
                  />
                </div>
                {errors.latePenaltyAmount && (
                  <span className="text-xs text-rose-500 block">{errors.latePenaltyAmount.message}</span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {penaltyType === "flat" ? (
                <span><strong>Flat Rule:</strong> A flat penalty will be deducted for every day the employee checks in late/super-late.</span>
              ) : (
                <span><strong>Hourly Rule:</strong> Deducts based on exact minutes late relative to scheduled start time: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">(Minutes Late / 60) * Hourly Rate</code>.</span>
              )}
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving settings...
                </>
              ) : (
                "Save Payroll Configuration"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info Card */}
      <div className="md:col-span-4 space-y-4">
        <div className="p-5 border border-border rounded-2xl bg-card/60 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CircleDollarSign className="w-4.5 h-4.5 text-primary" />
            Active Formulas
          </h3>
          <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed font-medium">
            <div>
              <span className="block text-foreground font-bold mb-0.5">Per-Day Salary</span>
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Monthly Salary / Working Days</code>
            </div>
            <div>
              <span className="block text-foreground font-bold mb-0.5">Unpaid Leave Deduction</span>
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Leaves Count * Per-Day Salary</code>
            </div>
            <div>
              <span className="block text-foreground font-bold mb-0.5">Late Deduction (Flat)</span>
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Late Days * Flat Amount</code>
            </div>
            <div>
              <span className="block text-foreground font-bold mb-0.5">Late Deduction (Hourly)</span>
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">(Minutes Late / 60) * Rate</code>
            </div>
            <div>
              <span className="block text-foreground font-bold mb-0.5">Final Net Gross Pay</span>
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Salary - (Leaves + Late)</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
