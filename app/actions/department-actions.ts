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

interface CreateDeptInput {
  schoolId: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  gracePeriodMins: number;
  lateThresholdMins: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsRadiusMeters: number;
  attendanceWindowMins: number;
}

export async function createDepartmentAction(formData: CreateDeptInput) {
  try {
    const { data: dept, error } = await supabaseAdmin
      .from("departments")
      .insert({
        school_id: formData.schoolId,
        name: formData.name,
        description: formData.description,
        start_time: formData.startTime,
        end_time: formData.endTime,
        grace_period_mins: formData.gracePeriodMins,
        late_threshold_mins: formData.lateThresholdMins,
        gps_latitude: formData.gpsLatitude || null,
        gps_longitude: formData.gpsLongitude || null,
        gps_radius_meters: formData.gpsRadiusMeters,
        attendance_window_mins: formData.attendanceWindowMins,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: `Department creation failed: ${error.message}` };
    }

    // Log Audit
    await supabaseAdmin.from("audit_logs").insert({
      action: "department_created",
      table_name: "departments",
      record_id: dept.id,
      new_data: { name: dept.name },
    
      category: "settings",});

    revalidatePath("/principal/departments");
    revalidatePath("/principal/staff");
    return { success: true, departmentId: dept.id };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface UpdateDeptInput extends Omit<CreateDeptInput, "schoolId"> {
  id: string;
}

export async function updateDepartmentAction(formData: UpdateDeptInput) {
  try {
    const { error } = await supabaseAdmin
      .from("departments")
      .update({
        name: formData.name,
        description: formData.description,
        start_time: formData.startTime,
        end_time: formData.endTime,
        grace_period_mins: formData.gracePeriodMins,
        late_threshold_mins: formData.lateThresholdMins,
        gps_latitude: formData.gpsLatitude || null,
        gps_longitude: formData.gpsLongitude || null,
        gps_radius_meters: formData.gpsRadiusMeters,
        attendance_window_mins: formData.attendanceWindowMins,
      })
      .eq("id", formData.id);

    if (error) {
      return { success: false, error: `Settings update failed: ${error.message}` };
    }

    // Log Audit
    await supabaseAdmin.from("audit_logs").insert({
      action: "department_updated",
      table_name: "departments",
      record_id: formData.id,
    
      category: "settings",});

    revalidatePath("/principal/departments");
    revalidatePath("/principal/staff");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function deleteDepartmentAction(id: string) {
  try {
    const { error } = await supabaseAdmin
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: `Deletion failed: ${error.message}` };
    }

    // Log Audit
    await supabaseAdmin.from("audit_logs").insert({
      action: "department_deleted",
      table_name: "departments",
      record_id: id,
    
      category: "settings",});

    revalidatePath("/principal/departments");
    revalidatePath("/principal/staff");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
