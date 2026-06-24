"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification-actions";

// Instantiate the service role admin client to bypass RLS for administrative actions
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
  const { data: year, error } = await supabaseAdmin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (year) {
    return year.id;
  }

  // Auto-provision an academic year for the current year
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

// Helper to resolve or auto-create leave settings for a school
async function getOrCreateLeaveSettings(schoolId: string) {
  const { data: settings, error } = await supabaseAdmin
    .from("leave_settings")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (settings) {
    return settings;
  }

  // Insert default settings
  const { data: newSettings, error: insertError } = await supabaseAdmin
    .from("leave_settings")
    .insert({
      school_id: schoolId,
      casual_default: 10,
      sick_default: 8,
      earned_default: 5,
    })
    .select("*")
    .single();

  if (insertError || !newSettings) {
    throw new Error(`Failed to initialize school leave settings: ${insertError?.message}`);
  }

  return newSettings;
}

// Helper to auto-initialize leave balances for a staff member if they don't exist
async function ensureLeaveBalancesInitialized(
  staffId: string,
  schoolId: string,
  academicYearId: string
) {
  const { data: balances, error } = await supabaseAdmin
    .from("leave_balances")
    .select("*")
    .eq("staff_id", staffId)
    .eq("academic_year_id", academicYearId);

  if (balances && balances.length > 0) {
    return balances;
  }

  // Fetch school defaults
  const settings = await getOrCreateLeaveSettings(schoolId);

  const initialBalances = [
    { leave_type: "casual", allocated: settings.casual_default, used: 0 },
    { leave_type: "sick", allocated: settings.sick_default, used: 0 },
    { leave_type: "earned", allocated: settings.earned_default, used: 0 },
  ];

  const insertData = initialBalances.map((b) => ({
    staff_id: staffId,
    academic_year_id: academicYearId,
    leave_type: b.leave_type,
    allocated: b.allocated,
    used: b.used,
  }));

  const { data: newBalances, error: insertError } = await supabaseAdmin
    .from("leave_balances")
    .insert(insertData)
    .select("*");

  if (insertError) {
    throw new Error(`Failed to initialize staff leave balances: ${insertError.message}`);
  }

  return newBalances;
}

export async function getStaffLeaveDashboardAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Get staff profile
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (staffError || !staff) {
      return { success: false, error: "Staff profile not found." };
    }

    // Get or create active academic year
    const activeAcadYear = await getOrCreateActiveAcademicYear(staff.school_id);

    // Ensure balances are initialized
    const balances = await ensureLeaveBalancesInitialized(
      user.id,
      staff.school_id,
      activeAcadYear
    );

    // Fetch leave requests history
    const { data: requests, error: reqError } = await supabaseAdmin
      .from("leave_requests")
      .select("*")
      .eq("staff_id", user.id)
      .order("created_at", { ascending: false });

    if (reqError) {
      return { success: false, error: `Error fetching leave requests: ${reqError.message}` };
    }

    return {
      success: true,
      balances: balances || [],
      requests: requests || [],
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface ApplyLeaveInput {
  leaveType: "sick" | "casual" | "earned" | "maternity" | "paternity" | "unpaid";
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
}

export async function applyLeaveRequestAction(formData: ApplyLeaveInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { success: false, error: "Invalid date values provided." };
    }

    if (start > end) {
      return { success: false, error: "Start date must be before or equal to end date." };
    }

    // 1. Resolve staff details
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("first_name, last_name, school_id")
      .eq("id", user.id)
      .single();

    if (staffError || !staff) {
      return { success: false, error: "Staff profile not found." };
    }

    // 2. Resolve active academic year
    const activeAcadYear = await getOrCreateActiveAcademicYear(staff.school_id);

    // 3. Ensure balances are initialized and retrieve balance for the target type
    const balances = await ensureLeaveBalancesInitialized(
      user.id,
      staff.school_id,
      activeAcadYear
    );

    const targetBalance = balances.find((b) => b.leave_type === formData.leaveType);
    const requestedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check if the balance is sufficient for paid leaves (sick, casual, earned)
    if (formData.leaveType !== "unpaid" && targetBalance) {
      if (requestedDays > targetBalance.remaining) {
        return {
          success: false,
          error: `Insufficient leave balance. Requested: ${requestedDays} days, Remaining: ${targetBalance.remaining} days.`,
        };
      }
    }

    // Check for overlapping leaves for this staff member
    const { data: overlapping, error: overlapError } = await supabaseAdmin
      .from("leave_requests")
      .select("id")
      .eq("staff_id", user.id)
      .in("status", ["pending", "approved"])
      .lte("start_date", formData.endDate)
      .gte("end_date", formData.startDate);

    if (overlapError) {
      return { success: false, error: `Failed to check overlapping requests: ${overlapError.message}` };
    }

    if (overlapping && overlapping.length > 0) {
      return { success: false, error: "You already have a pending or approved leave request during these dates." };
    }

    // 4. Create request
    const { data: request, error: dbError } = await supabaseAdmin
      .from("leave_requests")
      .insert({
        staff_id: user.id,
        leave_type: formData.leaveType,
        start_date: formData.startDate,
        end_date: formData.endDate,
        reason: formData.reason,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      return { success: false, error: `Failed to submit leave request: ${dbError.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "leave_requested",
      table_name: "leave_requests",
      record_id: request.id,
      new_data: { leave_type: formData.leaveType, days: requestedDays },
    
      category: "leave",});

    // Notify school principals of the new leave request
    if (staff) {
      const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "Staff member";
      const { data: principals } = await supabaseAdmin
        .from("principals")
        .select("id")
        .eq("school_id", staff.school_id);

      if (principals && principals.length > 0) {
        for (const principal of principals) {
          await createNotification(
            principal.id,
            "Leave Request Submitted",
            `${staffName} applied for ${formData.leaveType} leave (${formData.startDate} to ${formData.endDate}).`,
            "leave"
          );
        }
      }
    }

    revalidatePath("/staff/leave");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getSchoolLeavesAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify Principal
    const { data: principal, error: principalError } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (principalError || !principal) {
      return { success: false, error: "Principal permissions required." };
    }

    // Fetch leave requests matching school context
    const { data: requests, error } = await supabaseAdmin
      .from("leave_requests")
      .select(`
        *,
        staff:staff_id (
          id,
          first_name,
          last_name,
          email,
          designation,
          staff_role,
          school_id,
          departments:department_id (
            name
          )
        )
      `)
      .eq("staff.school_id", principal.school_id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const filteredRequests = (requests || []).filter((r) => r.staff !== null);

    return { success: true, requests: filteredRequests };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function getSchoolLeaveSettingsAction(schoolId: string) {
  try {
    const settings = await getOrCreateLeaveSettings(schoolId);
    return { success: true, settings };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface UpdateSettingsInput {
  schoolId: string;
  casualDefault: number;
  sickDefault: number;
  earnedDefault: number;
}

export async function updateSchoolLeaveSettingsAction(formData: UpdateSettingsInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify Principal matches the school context
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal || principal.school_id !== formData.schoolId) {
      return { success: false, error: "Unauthorized access to school settings." };
    }

    const { error } = await supabaseAdmin
      .from("leave_settings")
      .upsert({
        school_id: formData.schoolId,
        casual_default: formData.casualDefault,
        sick_default: formData.sickDefault,
        earned_default: formData.earnedDefault,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id" });

    if (error) {
      return { success: false, error: `Failed to save leave settings: ${error.message}` };
    }

    // Log Audit
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "leave_settings_updated",
      table_name: "leave_settings",
      new_data: {
        casual_default: formData.casualDefault,
        sick_default: formData.sickDefault,
        earned_default: formData.earnedDefault,
      },
    
      category: "leave",});

    revalidatePath("/principal/leave");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface ProcessLeaveInput {
  requestId: string;
  action: "approved" | "rejected";
}

export async function approveLeaveRequestAction(formData: ProcessLeaveInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: principal },
    } = await supabase.auth.getUser();

    if (!principal) {
      return { success: false, error: "Authentication required." };
    }

    // 1. Verify Principal role and school_id
    const { data: principalProfile } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", principal.id)
      .single();

    if (!principalProfile) {
      return { success: false, error: "Principal permissions required." };
    }

    // 2. Fetch the leave request with requester details
    const { data: request, error: reqError } = await supabaseAdmin
      .from("leave_requests")
      .select(`
        *,
        staff:staff_id (
          school_id
        )
      `)
      .eq("id", formData.requestId)
      .single();

    if (reqError || !request) {
      return { success: false, error: "Leave request not found." };
    }

    // Verify authorized access to same school
    if (request.staff?.school_id !== principalProfile.school_id) {
      return { success: false, error: "Unauthorized access: Staff belongs to another school." };
    }

    if (request.status !== "pending") {
      return { success: false, error: `Leave request has already been processed as ${request.status}.` };
    }

    // 3. If approved, verify if their leave balance is still sufficient (unless unpaid)
    if (formData.action === "approved" && request.leave_type !== "unpaid") {
      const activeAcadYear = await getOrCreateActiveAcademicYear(principalProfile.school_id);
      const { data: balance } = await supabaseAdmin
        .from("leave_balances")
        .select("remaining")
        .eq("staff_id", request.staff_id)
        .eq("academic_year_id", activeAcadYear)
        .eq("leave_type", request.leave_type)
        .single();

      const requestedDays = Math.ceil((new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (balance && requestedDays > balance.remaining) {
        return {
          success: false,
          error: `Cannot approve request. Staff member has insufficient remaining leave balance (${balance.remaining} days) for this ${requestedDays}-day request.`,
        };
      }
    }

    // 4. Update request status
    const { error: updateError } = await supabaseAdmin
      .from("leave_requests")
      .update({
        status: formData.action,
        approved_by: principal.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", formData.requestId);

    if (updateError) {
      return { success: false, error: `Failed to process leave request: ${updateError.message}` };
    }

    // 5. Log Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: principal.id,
      action: `leave_${formData.action}`,
      table_name: "leave_requests",
      record_id: formData.requestId,
      new_data: { action: formData.action },
    
      category: "leave",});

    // Notify staff member of the leave decision
    await createNotification(
      request.staff_id,
      formData.action === "approved" ? "Leave Request Approved" : "Leave Request Rejected",
      `Your leave request for ${request.start_date} to ${request.end_date} has been ${formData.action} by the Principal.`,
      "leave"
    );

    revalidatePath("/principal/leave");
    revalidatePath("/staff/leave");
    revalidatePath("/principal/attendance");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface OverrideBalanceInput {
  staffId: string;
  leaveType: string;
  allocated: number;
}

export async function updateStaffLeaveBalanceAction(formData: OverrideBalanceInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: principal },
    } = await supabase.auth.getUser();

    if (!principal) {
      return { success: false, error: "Authentication required." };
    }

    // 1. Verify Principal role and school_id
    const { data: principalProfile } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", principal.id)
      .single();

    if (!principalProfile) {
      return { success: false, error: "Principal permissions required." };
    }

    // Verify staff belongs to same school
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("school_id")
      .eq("id", formData.staffId)
      .single();

    if (!staff || staff.school_id !== principalProfile.school_id) {
      return { success: false, error: "Unauthorized access: Staff belongs to another school." };
    }

    const activeAcadYear = await getOrCreateActiveAcademicYear(principalProfile.school_id);

    // 2. Upsert/Update the leave balance allocation
    const { error } = await supabaseAdmin
      .from("leave_balances")
      .upsert({
        staff_id: formData.staffId,
        academic_year_id: activeAcadYear,
        leave_type: formData.leaveType,
        allocated: formData.allocated,
      }, { onConflict: "staff_id,academic_year_id,leave_type" });

    if (error) {
      return { success: false, error: `Failed to override balance: ${error.message}` };
    }

    // Log Audit
    await supabaseAdmin.from("audit_logs").insert({
      user_id: principal.id,
      action: "leave_balance_overridden",
      table_name: "leave_balances",
      new_data: {
        staff_id: formData.staffId,
        leave_type: formData.leaveType,
        allocated: formData.allocated,
      },
    
      category: "leave",});

    revalidatePath("/principal/leave");
    revalidatePath(`/principal/staff/${formData.staffId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
