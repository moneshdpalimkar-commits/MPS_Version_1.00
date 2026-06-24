"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Instantiate the service role admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface CreateStaffInput {
  schoolId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
  category: "teaching" | "non-teaching" | "support";
  designation: string;
  joiningDate: string;
  passwordTemp: string;
  departmentId?: string;
  fixedMonthlySalary: number;
}

export async function createStaffAction(formData: CreateStaffInput) {
  try {
    // 1. Provision Auth User (Does not disrupt principal session)
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.passwordTemp,
        email_confirm: true,
        user_metadata: {
          role: "staff",
          must_change_password: true,
          full_name: `${formData.firstName} ${formData.lastName}`,
        },
        app_metadata: {
          role: "staff",
        },
      });

    if (authError) {
      return {
        success: false,
        error: `Staff Auth registration failed: ${authError.message}`,
      };
    }

    // 2. Provision Staff DB Profile
    const { error: profileError } = await supabaseAdmin.from("staff").insert({
      id: authUser.user.id,
      school_id: formData.schoolId,
      department_id: formData.departmentId || null,
      employee_id: formData.employeeId,
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      blood_group: formData.bloodGroup,
      emergency_contact: formData.emergencyContact,
      staff_role: formData.category,
      designation: formData.designation,
      join_date: formData.joiningDate,
      status: "active",
      fixed_monthly_salary: formData.fixedMonthlySalary || 0,
      base_salary: formData.fixedMonthlySalary || 0, // sync to legacy base_salary
    });

    if (profileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return {
        success: false,
        error: `Staff Profile mapping failed: ${profileError.message}`,
      };
    }

    // 3. Log Audit Activity
    await supabaseAdmin.from("audit_logs").insert({
      action: "staff_created",
      table_name: "staff",
      record_id: authUser.user.id,
      new_data: {
        employee_id: formData.employeeId,
        school_id: formData.schoolId,
      },
    
      category: "settings",});

    revalidatePath("/principal/staff");
    return { success: true, staffId: authUser.user.id };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred.",
    };
  }
}

interface UpdateStaffInput {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
  category: "teaching" | "non-teaching" | "support";
  designation: string;
  joiningDate: string;
  departmentId?: string;
  fixedMonthlySalary: number;
}

export async function updateStaffAction(formData: UpdateStaffInput) {
  try {
    const { error } = await supabaseAdmin
      .from("staff")
      .update({
        employee_id: formData.employeeId,
        department_id: formData.departmentId || null,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        address: formData.address,
        blood_group: formData.bloodGroup,
        emergency_contact: formData.emergencyContact,
        staff_role: formData.category,
        designation: formData.designation,
        join_date: formData.joiningDate,
        fixed_monthly_salary: formData.fixedMonthlySalary || 0,
        base_salary: formData.fixedMonthlySalary || 0, // sync to legacy base_salary
      })
      .eq("id", formData.id);

    if (error) {
      return { success: false, error: `Profile update failed: ${error.message}` };
    }

    // Log Audit Activity
    await supabaseAdmin.from("audit_logs").insert({
      action: "staff_profile_edited",
      table_name: "staff",
      record_id: formData.id,
    
      category: "settings",});

    revalidatePath("/principal/staff");
    revalidatePath(`/principal/staff/${formData.id}`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred.",
    };
  }
}

export async function deactivateStaffAction(id: string, status: "active" | "inactive") {
  try {
    const { error } = await supabaseAdmin
      .from("staff")
      .update({ status })
      .eq("id", id);

    if (error) {
      return { success: false, error: `Deactivation failed: ${error.message}` };
    }

    // Log Audit Activity
    await supabaseAdmin.from("audit_logs").insert({
      action: "staff_status_changed",
      table_name: "staff",
      record_id: id,
      new_data: { status },
    
      category: "settings",});

    revalidatePath("/principal/staff");
    revalidatePath(`/principal/staff/${id}`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred.",
    };
  }
}

export async function archiveStaffAction(id: string) {
  try {
    const { error } = await supabaseAdmin
      .from("staff")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) {
      return { success: false, error: `Archival failed: ${error.message}` };
    }

    // Optionally ban from signing into Supabase Auth
    await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: "87600h", // ban indefinitely (10 years)
    });

    // Log Audit Activity
    await supabaseAdmin.from("audit_logs").insert({
      action: "staff_archived",
      table_name: "staff",
      record_id: id,
    
      category: "settings",});

    revalidatePath("/principal/staff");
    revalidatePath(`/principal/staff/${id}`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred.",
    };
  }
}
