"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification-actions";

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

interface UpdateSettingsInput {
  gpsRadiusMeters: number;
  sessionTimeoutHours: number;
  backupInterval: string;
}

export async function getSystemSettingsAction() {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      return { success: false, error: `Failed to fetch system settings: ${error.message}` };
    }

    return { success: true, settings: data };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function updateSystemSettingsAction(formData: UpdateSettingsInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const userRole = user.app_metadata?.role || user.user_metadata?.role || "staff";
    if (userRole !== "superadmin") {
      return { success: false, error: "Unauthorized. Superadmin role required." };
    }

    // Since we seed one row, we update that row or insert if not exists
    const { data: existing } = await supabaseAdmin
      .from("system_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      result = await supabaseAdmin
        .from("system_settings")
        .update({
          gps_radius_meters: formData.gpsRadiusMeters,
          session_timeout_hours: formData.sessionTimeoutHours,
          backup_interval: formData.backupInterval,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from("system_settings")
        .insert({
          gps_radius_meters: formData.gpsRadiusMeters,
          session_timeout_hours: formData.sessionTimeoutHours,
          backup_interval: formData.backupInterval,
        })
        .select()
        .single();
    }

    if (result.error) {
      return { success: false, error: `Failed to update settings: ${result.error.message}` };
    }

    // Write to audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "system_settings_updated",
      table_name: "system_settings",
      record_id: result.data.id,
      new_data: {
        gps_radius_meters: formData.gpsRadiusMeters,
        session_timeout_hours: formData.sessionTimeoutHours,
        backup_interval: formData.backupInterval,
      },
      category: "settings",
    });

    // Create notification for the Superadmin
    await createNotification(
      user.id,
      "System Settings Updated",
      "Global SaaS threshold configs and GPS validation parameters have been updated.",
      "announcement"
    );

    revalidatePath("/superadmin/settings");
    return { success: true, settings: result.data };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
