"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification-actions";

// Instantiate the service role admin client
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper to resolve or auto-create an active academic year for a school
async function getOrCreateActiveAcademicYear(schoolId: string): Promise<string> {
  const { data: year } = await supabaseAdmin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (year) {
    return year.id;
  }

  const currentYear = new Date().getFullYear();
  const { data: newYear, error: insertError } = await supabaseAdmin
    .from("academic_years")
    .insert({
      school_id: schoolId,
      name: `Academic Year ${currentYear}`,
      start_date: `${currentYear}-01-01`,
      end_date: `${currentYear}-12-31`,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !newYear) {
    throw new Error(`Failed to auto-create academic year: ${insertError?.message}`);
  }

  return newYear.id;
}

export async function getPayrollHistoryAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    const { data, error } = await supabaseAdmin
      .from("payroll")
      .select(`
        *,
        payslips (
          id,
          net_salary
        )
      `)
      .eq("school_id", principal.school_id)
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      return { success: false, error: `Failed to fetch payroll history: ${error.message}` };
    }

    const history = (data || []).map((p) => {
      const slips = p.payslips || [];
      const totalNetSalary = slips.reduce((sum: number, s: any) => sum + Number(s.net_salary), 0);
      return {
        id: p.id,
        month: p.month,
        year: p.year,
        status: p.status,
        approvedAt: p.approved_at,
        employeeCount: slips.length,
        totalNetSalary: Number(totalNetSalary.toFixed(2)),
      };
    });

    return { success: true, history };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function createDraftPayrollAction(month: number, year: number) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    // Check if payroll already exists
    const { data: existing } = await supabaseAdmin
      .from("payroll")
      .select("id")
      .eq("school_id", principal.school_id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `Payroll sheet already exists for ${month}/${year}.` };
    }

    const academicYearId = await getOrCreateActiveAcademicYear(principal.school_id);

    // Fetch school payroll settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("school_payroll_settings")
      .select("*")
      .eq("school_id", principal.school_id)
      .maybeSingle();

    if (settingsError) {
      return { success: false, error: `Failed to query payroll settings: ${settingsError.message}` };
    }

    const standardWorkingDays = settings?.standard_working_days ?? 30;
    const latePenaltyType = settings?.late_penalty_type ?? "flat";
    const latePenaltyAmount = Number(settings?.late_penalty_amount ?? 0.0);

    // Fetch all active staff with department info
    const { data: staffList, error: staffError } = await supabaseAdmin
      .from("staff")
      .select(`
        *,
        departments:department_id (
          id,
          name,
          start_time,
          end_time,
          grace_period_mins,
          late_threshold_mins
        )
      `)
      .eq("school_id", principal.school_id)
      .eq("status", "active");

    if (staffError) {
      return { success: false, error: `Failed to query staff list: ${staffError.message}` };
    }

    if (!staffList || staffList.length === 0) {
      return { success: false, error: "No active staff members found to generate payroll." };
    }

    // Calculate calendar parameters
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${totalDaysInMonth}`;

    // Fetch approved unpaid leaves overlapping target month
    const { data: unpaidLeaves, error: leavesError } = await supabaseAdmin
      .from("leave_requests")
      .select("staff_id, start_date, end_date")
      .eq("leave_type", "unpaid")
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    if (leavesError) {
      return { success: false, error: `Failed to query unpaid leaves: ${leavesError.message}` };
    }

    // Fetch all attendance logs for this school's active staff in target month
    const staffIds = staffList.map(s => s.id);
    const { data: attendanceList, error: attendanceError } = await supabaseAdmin
      .from("attendance")
      .select("staff_id, status, check_in_time, date")
      .in("staff_id", staffIds)
      .gte("date", startDate)
      .lte("date", endDate);

    if (attendanceError) {
      return { success: false, error: `Failed to query attendance logs: ${attendanceError.message}` };
    }

    // Create the Payroll Draft
    const { data: newPayroll, error: prError } = await supabaseAdmin
      .from("payroll")
      .insert({
        school_id: principal.school_id,
        academic_year_id: academicYearId,
        month,
        year,
        status: "draft",
      })
      .select()
      .single();

    if (prError || !newPayroll) {
      return { success: false, error: `Failed to initialize payroll run: ${prError?.message}` };
    }

    // Generate payslips
    const payslipInserts = [];

    for (const s of staffList) {
      const basicSalary = Number(s.fixed_monthly_salary || s.base_salary || 0.0);
      const daysInMonth = standardWorkingDays > 0 ? standardWorkingDays : 30;
      const dailyRate = basicSalary / daysInMonth;

      // 1. Calculate approved unpaid leaves count & deduction
      const staffLeaves = (unpaidLeaves || []).filter(l => l.staff_id === s.id);
      let unpaidLeavesCount = 0;
      
      const monthStart = new Date(startDate);
      const monthEnd = new Date(endDate);
      
      for (const leave of staffLeaves) {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        
        const overlapStart = leaveStart > monthStart ? leaveStart : monthStart;
        const overlapEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;
        
        if (overlapStart <= overlapEnd) {
          const diffMs = overlapEnd.getTime() - overlapStart.getTime();
          const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
          unpaidLeavesCount += days;
        }
      }
      const unpaidLeavesDeduction = Number((unpaidLeavesCount * dailyRate).toFixed(2));

      // 2. Calculate late penalty count & deduction
      const staffAttendance = (attendanceList || []).filter(a => a.staff_id === s.id);
      let latePenaltiesCount = 0;
      let totalLatePenaltiesAmount = 0;
      const dept = (s as any).departments;

      for (const att of staffAttendance) {
        if (att.status === "late" || att.status === "super_late") {
          latePenaltiesCount++;
          
          let minutesLate = 0;
          if (att.check_in_time) {
            const checkIn = new Date(att.check_in_time);
            const shiftStart = new Date(checkIn);
            const [sh, sm, ss] = (dept?.start_time || "08:00:00").split(":").map(Number);
            shiftStart.setHours(sh, sm, ss || 0, 0);
            minutesLate = Math.max(0, Math.round((checkIn.getTime() - shiftStart.getTime()) / 60000));
          } else {
            if (att.status === "late") {
              minutesLate = (dept?.grace_period_mins || 15) + 1;
            } else if (att.status === "super_late") {
              minutesLate = (dept?.late_threshold_mins || 30) + 1;
            }
          }
          
          let penaltyForDay = 0;
          if (latePenaltyType === "flat") {
            penaltyForDay = latePenaltyAmount;
          } else {
            const hourlyRate = dailyRate / 8;
            penaltyForDay = (minutesLate / 60) * hourlyRate;
          }
          totalLatePenaltiesAmount += penaltyForDay;
        }
      }
      const latePenaltiesDeduction = Number(totalLatePenaltiesAmount.toFixed(2));

      // Net Salary = fixed_monthly_salary - (leaves_deduction + late_penalty)
      const netSalary = Math.max(
        0,
        Number((basicSalary - (unpaidLeavesDeduction + latePenaltiesDeduction)).toFixed(2))
      );

      payslipInserts.push({
        payroll_id: newPayroll.id,
        staff_id: s.id,
        basic_salary: basicSalary,
        allowances: 0.0,
        pf_deduction: 0.0,
        tax_deduction: 0.0,
        attendance_deduction: unpaidLeavesDeduction, // keep legacy field synced
        other_deductions: 0.0,
        net_salary: netSalary,
        status: "draft",
        unpaid_leaves_count: unpaidLeavesCount,
        unpaid_leaves_deduction: unpaidLeavesDeduction,
        late_penalties_count: latePenaltiesCount,
        late_penalties_deduction: latePenaltiesDeduction,
      });
    }

    const { error: psError } = await supabaseAdmin.from("payslips").insert(payslipInserts);

    if (psError) {
      // Rollback payroll run
      await supabaseAdmin.from("payroll").delete().eq("id", newPayroll.id);
      return { success: false, error: `Failed to insert payslip sheets: ${psError.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "payroll_draft_created",
      table_name: "payroll",
      record_id: newPayroll.id,
      new_data: { month, year, count: payslipInserts.length },
    
      category: "payroll",});

    revalidatePath("/principal/payroll");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getPayrollDetailsAction(payrollId: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    const { data: payroll, error: prError } = await supabaseAdmin
      .from("payroll")
      .select("*")
      .eq("id", payrollId)
      .eq("school_id", principal.school_id)
      .single();

    if (prError || !payroll) {
      return { success: false, error: "Payroll run sheet not found." };
    }

    const { data: payslips, error: psError } = await supabaseAdmin
      .from("payslips")
      .select(`
        *,
        staff:staff_id (
          id,
          first_name,
          last_name,
          designation,
          employee_id
        )
      `)
      .eq("payroll_id", payrollId)
      .order("created_at", { ascending: true });

    if (psError) {
      return { success: false, error: `Failed to query payslips: ${psError.message}` };
    }

    // Fetch school settings standard working days
    const { data: settings } = await supabaseAdmin
      .from("school_payroll_settings")
      .select("standard_working_days")
      .eq("school_id", principal.school_id)
      .maybeSingle();

    const standardWorkingDays = settings?.standard_working_days ?? 30;

    return {
      success: true,
      payroll,
      payslips: payslips || [],
      standardWorkingDays,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface UpdatePayslipDetailsInput {
  payslipId: string;
  basicSalary: number;
  unpaidLeavesCount: number;
  unpaidLeavesDeduction: number;
  latePenaltiesCount: number;
  latePenaltiesDeduction: number;
  otherDeductions: number;
}

export async function updatePayslipDetailsAction(input: UpdatePayslipDetailsInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    const { data: payslip, error: psFindError } = await supabaseAdmin
      .from("payslips")
      .select(`
        *,
        payroll:payroll_id!inner (
          school_id,
          status
        )
      `)
      .eq("id", input.payslipId)
      .single();

    if (psFindError || !payslip || payslip.payroll.school_id !== principal.school_id) {
      return { success: false, error: "Payslip sheet not found." };
    }

    if (payslip.payroll.status !== "draft") {
      return { success: false, error: "Adjustments can only be made on draft payroll runs." };
    }

    // 1. Sync salary change permanently to Staff Profile if it changed
    if (Number(payslip.basic_salary) !== input.basicSalary) {
      const { error: staffUpdateError } = await supabaseAdmin
        .from("staff")
        .update({
          fixed_monthly_salary: input.basicSalary,
          base_salary: input.basicSalary, // legacy sync
        })
        .eq("id", payslip.staff_id);

      if (staffUpdateError) {
        return { success: false, error: `Failed to update staff permanent salary: ${staffUpdateError.message}` };
      }
    }

    // 2. Re-calculate net salary based on the overrides
    const allowances = Number(payslip.allowances || 0.0);
    const pfDeduction = Number(payslip.pf_deduction || 0.0);
    const taxDeduction = Number(payslip.tax_deduction || 0.0);

    const netSalary = Math.max(
      0,
      Number((input.basicSalary + allowances - pfDeduction - taxDeduction - input.unpaidLeavesDeduction - input.latePenaltiesDeduction - input.otherDeductions).toFixed(2))
    );

    const { error: updateError } = await supabaseAdmin
      .from("payslips")
      .update({
        basic_salary: input.basicSalary,
        unpaid_leaves_count: input.unpaidLeavesCount,
        unpaid_leaves_deduction: input.unpaidLeavesDeduction,
        attendance_deduction: input.unpaidLeavesDeduction, // keep legacy synced
        late_penalties_count: input.latePenaltiesCount,
        late_penalties_deduction: input.latePenaltiesDeduction,
        other_deductions: input.otherDeductions,
        net_salary: netSalary,
      })
      .eq("id", input.payslipId);

    if (updateError) {
      return { success: false, error: `Failed to update adjustments: ${updateError.message}` };
    }

    revalidatePath("/principal/payroll");
    revalidatePath("/staff/payroll");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function approvePayrollAction(payrollId: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    // Update payroll to approved
    const { error: prError } = await supabaseAdmin
      .from("payroll")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", payrollId)
      .eq("school_id", principal.school_id);

    if (prError) {
      return { success: false, error: `Failed to approve payroll: ${prError.message}` };
    }

    // Update all payslips status to generated
    const { error: psError } = await supabaseAdmin
      .from("payslips")
      .update({ status: "generated" })
      .eq("payroll_id", payrollId);

    if (psError) {
      return { success: false, error: `Failed to publish payslips: ${psError.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "payroll_approved",
      table_name: "payroll",
      record_id: payrollId,
    
      category: "payroll",});

    // Notify all active staff members in the school that their payslip is ready
    const { data: payrollInfo } = await supabaseAdmin
      .from("payroll")
      .select("month, year")
      .eq("id", payrollId)
      .single();

    if (payrollInfo) {
      const { data: staffList } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("school_id", principal.school_id)
        .eq("status", "active");

      if (staffList && staffList.length > 0) {
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const monthStr = monthNames[payrollInfo.month - 1] || payrollInfo.month.toString();

        for (const member of staffList) {
          await createNotification(
            member.id,
            "Monthly Salary Slip Issued",
            `Your payslip for ${monthStr} ${payrollInfo.year} is ready and has been published.`,
            "payroll"
          );
        }
      }
    }

    revalidatePath("/principal/payroll");
    revalidatePath("/staff/payroll");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function deletePayrollAction(payrollId: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    // Delete (cascade removes payslips)
    const { error } = await supabaseAdmin
      .from("payroll")
      .delete()
      .eq("id", payrollId)
      .eq("school_id", principal.school_id)
      .eq("status", "draft");

    if (error) {
      return { success: false, error: `Failed to delete draft: ${error.message}` };
    }

    revalidatePath("/principal/payroll");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getStaffPayslipsAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data, error } = await supabaseAdmin
      .from("payslips")
      .select(`
        *,
        payroll:payroll_id!inner (
          month,
          year,
          status,
          approved_at
        ),
        staff:staff_id (
          first_name,
          last_name,
          designation,
          employee_id,
          schools:school_id (
            name
          )
        )
      `)
      .eq("staff_id", user.id)
      .eq("payroll.status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: `Failed to retrieve payslips: ${error.message}` };
    }

    return { success: true, payslips: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getSchoolPayrollSettingsAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    const { data: settings, error } = await supabaseAdmin
      .from("school_payroll_settings")
      .select("*")
      .eq("school_id", principal.school_id)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!settings) {
      // Seed default settings row
      const { data: seeded, error: seedError } = await supabaseAdmin
        .from("school_payroll_settings")
        .insert({
          school_id: principal.school_id,
          standard_working_days: 30,
          late_penalty_type: "flat",
          late_penalty_amount: 0.00,
        })
        .select()
        .single();

      if (seedError) {
        return { success: false, error: `Failed to initialize payroll settings: ${seedError.message}` };
      }
      return { success: true, settings: seeded };
    }

    return { success: true, settings };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface SavePayrollSettingsInput {
  standardWorkingDays: number;
  latePenaltyType: "flat" | "hourly";
  latePenaltyAmount: number;
}

export async function saveSchoolPayrollSettingsAction(input: SavePayrollSettingsInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    const { error } = await supabaseAdmin
      .from("school_payroll_settings")
      .upsert({
        school_id: principal.school_id,
        standard_working_days: input.standardWorkingDays,
        late_penalty_type: input.latePenaltyType,
        late_penalty_amount: input.latePenaltyAmount,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id" });

    if (error) {
      return { success: false, error: `Failed to save payroll settings: ${error.message}` };
    }

    revalidatePath("/principal/settings");
    revalidatePath("/principal/payroll");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
