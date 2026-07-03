"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createNotification } from "./notification-actions";

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

interface CreateSchoolInput {
  name: string;
  address: string;
  principalEmail: string;
  passwordTemp: string;
}

export async function createSchoolAction(formData: CreateSchoolInput) {
  try {
    // Auth and role check
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (
      !user ||
      (user.app_metadata?.role !== "superadmin" &&
        user.user_metadata?.role !== "superadmin")
    ) {
      return { success: false, error: "Unauthorized. Superadmin privilege required." };
    }

    // 1. Provision School Record
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: formData.name,
        address: formData.address,
        email: formData.principalEmail,
      })
      .select()
      .single();

    if (schoolError) {
      return {
        success: false,
        error: `School creation failed: ${schoolError.message}`,
      };
    }

    // 2. Provision Principal Auth Account (Does not disrupt current user session)
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: formData.principalEmail,
        password: formData.passwordTemp,
        email_confirm: true,
        user_metadata: {
          role: "principal",
          must_change_password: true,
          full_name: `${formData.name} Principal`,
        },
        app_metadata: {
          role: "principal",
        },
      });

    if (authError) {
      // Rollback school insertion
      await supabaseAdmin.from("schools").delete().eq("id", school.id);
      return {
        success: false,
        error: `Principal Auth registration failed: ${authError.message}`,
      };
    }

    // 3. Provision Principal DB Profile Link
    const { error: profileError } = await supabaseAdmin
      .from("principals")
      .insert({
        id: authUser.user.id,
        school_id: school.id,
        full_name: `${formData.name} Principal`,
        email: formData.principalEmail,
        is_active: true,
      });

    if (profileError) {
      // Rollback auth account & school record
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from("schools").delete().eq("id", school.id);
      return {
        success: false,
        error: `Principal Database Profile mapping failed: ${profileError.message}`,
      };
    }

    // 4. Log Audit Activity
    await supabaseAdmin.from("audit_logs").insert({
      action: "school_created",
      table_name: "schools",
      record_id: school.id,
      new_data: {
        school_name: school.name,
        principal_id: authUser.user.id,
      },
    
      category: "settings",});

    // 5. Create notification for the Superadmin
    await createNotification(
      user.id,
      "School Tenant Created",
      `School "${formData.name}" and principal account "${formData.principalEmail}" have been successfully created.`,
      "announcement"
    );

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/schools");
    return { success: true, schoolId: school.id };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred.",
    };
  }
}

export async function togglePrincipalStatusAction(principalId: string, isActive: boolean) {
  try {
    // Auth and role check
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (
      !user ||
      (user.app_metadata?.role !== "superadmin" &&
        user.user_metadata?.role !== "superadmin")
    ) {
      return { success: false, error: "Unauthorized. Superadmin privilege required." };
    }

    // 1. Update principal active status
    const { data: principal, error: updateError } = await supabaseAdmin
      .from("principals")
      .update({ is_active: isActive })
      .eq("id", principalId)
      .select()
      .single();

    if (updateError) {
      return {
        success: false,
        error: `Failed to update principal status: ${updateError.message}`,
      };
    }

    // 2. Log Audit Activity
    await supabaseAdmin.from("audit_logs").insert({
      action: isActive ? "principal_activated" : "principal_deactivated",
      table_name: "principals",
      record_id: principalId,
      new_data: {
        principal_id: principalId,
        is_active: isActive,
        school_id: principal.school_id,
      },
      category: "settings",
    });

    // 3. Create notification for the Superadmin
    await createNotification(
      user.id,
      isActive ? "Principal Activated" : "Principal Deactivated",
      `Principal ${principal.full_name} (${principal.email}) has been ${isActive ? "activated" : "deactivated"}.`,
      "announcement"
    );

    revalidatePath("/superadmin");
    revalidatePath("/superadmin/schools");
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred.",
    };
  }
}

export async function getSchoolsAction() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("schools")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, schools: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
