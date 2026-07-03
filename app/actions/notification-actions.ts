"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Instantiate the service role admin client to bypass RLS for administrative notifications
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

// Admin Helper: Create a notification (runs server-side, bypassing RLS)
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "attendance" | "leave" | "announcement" | "payroll"
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        message,
        type,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create notification:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Unexpected error in createNotification:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

import { UserRole } from "@/types/auth";

// Action: Fetch notifications for a user based on target role (sandbox & native login aware)
export async function getUserNotificationsAction(role: UserRole) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let targetUserId: string | null = null;
    let actualRole: UserRole | null = null;

    if (user) {
      actualRole = (user.app_metadata?.role || user.user_metadata?.role || "staff") as UserRole;
      if (actualRole === role) {
        // Native login matches target role
        targetUserId = user.id;
      } else {
        // Sandbox switched role - resolve representative user ID
        if (role === "superadmin") {
          // Fallback to first superadmin UUID
          targetUserId = "dc7fd785-c5d9-40db-bb5f-bcee58eb8dd2";
        } else if (role === "principal") {
          // If logged in as staff, get the principal of the staff's school
          if (actualRole === "staff") {
            const { data: staff } = await supabaseAdmin
              .from("staff")
              .select("school_id")
              .eq("id", user.id)
              .single();
            if (staff) {
              const { data: principal } = await supabaseAdmin
                .from("principals")
                .select("id")
                .eq("school_id", staff.school_id)
                .limit(1)
                .maybeSingle();
              targetUserId = principal?.id || "e215e384-1b0b-41e8-92c7-453c3cb3549b";
            }
          }
          if (!targetUserId) {
            // Fallback to first principal
            const { data: principal } = await supabaseAdmin
              .from("principals")
              .select("id")
              .limit(1)
              .maybeSingle();
            targetUserId = principal?.id || "e215e384-1b0b-41e8-92c7-453c3cb3549b";
          }
        } else if (role === "staff") {
          // If logged in as principal, get a staff member of the principal's school
          if (actualRole === "principal") {
            const { data: principal } = await supabaseAdmin
              .from("principals")
              .select("school_id")
              .eq("id", user.id)
              .single();
            if (principal) {
              const { data: staff } = await supabaseAdmin
                .from("staff")
                .select("id")
                .eq("school_id", principal.school_id)
                .limit(1)
                .maybeSingle();
              targetUserId = staff?.id || "82ae3166-85b8-444e-a4ba-f19b2246286f";
            }
          }
          if (!targetUserId) {
            // Fallback to first staff
            const { data: staff } = await supabaseAdmin
              .from("staff")
              .select("id")
              .limit(1)
              .maybeSingle();
            targetUserId = staff?.id || "82ae3166-85b8-444e-a4ba-f19b2246286f";
          }
        }
      }
    } else {
      // Sandbox mode bypass (no logged-in session)
      if (role === "superadmin") {
        targetUserId = "dc7fd785-c5d9-40db-bb5f-bcee58eb8dd2";
      } else if (role === "principal") {
        const { data: principal } = await supabaseAdmin
          .from("principals")
          .select("id")
          .limit(1)
          .maybeSingle();
        targetUserId = principal?.id || "e215e384-1b0b-41e8-92c7-453c3cb3549b";
      } else {
        const { data: staff } = await supabaseAdmin
          .from("staff")
          .select("id")
          .limit(1)
          .maybeSingle();
        targetUserId = staff?.id || "82ae3166-85b8-444e-a4ba-f19b2246286f";
      }
    }

    if (!targetUserId) {
      return { success: false, error: "Target user not found." };
    }

    const { data: notifications, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      notifications: notifications || [],
      userId: targetUserId,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

// Action: Mark a single notification as read
export async function markNotificationAsReadAction(notificationId: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Fetch the notification to check owner
      const { data: notif } = await supabaseAdmin
        .from("notifications")
        .select("user_id")
        .eq("id", notificationId)
        .single();

      if (notif && notif.user_id === user.id) {
        // Native owner, update with user client
        const { error } = await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", notificationId)
          .eq("user_id", user.id);
        if (error) return { success: false, error: error.message };
      } else {
        // Switched role sandbox, update with admin client
        const { error } = await supabaseAdmin
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", notificationId);
        if (error) return { success: false, error: error.message };
      }
    } else {
      // Sandbox bypass (no session) - update with admin client
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

// Action: Mark all notifications of the target user as read
export async function markAllNotificationsAsReadAction(userId?: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const targetId = userId || user?.id;
    if (!targetId) {
      return { success: false, error: "Authentication required." };
    }

    if (user && targetId === user.id) {
      // Native owner
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", targetId)
        .is("read_at", null);
      if (error) return { success: false, error: error.message };
    } else {
      // Sandbox/Admin bypass
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", targetId)
        .is("read_at", null);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

// Action: Delete a notification
export async function deleteNotificationAction(notificationId: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: notif } = await supabaseAdmin
        .from("notifications")
        .select("user_id")
        .eq("id", notificationId)
        .single();

      if (notif && notif.user_id === user.id) {
        const { error } = await supabase
          .from("notifications")
          .delete()
          .eq("id", notificationId)
          .eq("user_id", user.id);
        if (error) return { success: false, error: error.message };
      } else {
        const { error } = await supabaseAdmin
          .from("notifications")
          .delete()
          .eq("id", notificationId);
        if (error) return { success: false, error: error.message };
      }
    } else {
      const { error } = await supabaseAdmin
        .from("notifications")
        .delete()
        .eq("id", notificationId);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

export async function broadcastSystemNotificationAction(
  title: string,
  message: string,
  target: "all" | "principals" | "staff" | "school_principal" = "all",
  schoolId?: string
) {
  try {
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

    let principalIds: string[] = [];
    let staffIds: string[] = [];
    let schoolName = "";

    // 1. Fetch principal ID(s)
    if (target === "all" || target === "principals") {
      const { data: principals, error: principalsError } = await supabaseAdmin
        .from("principals")
        .select("id");

      if (principalsError) {
        return { success: false, error: `Failed to fetch principals: ${principalsError.message}` };
      }
      principalIds = principals.map((p) => p.id);
    } else if (target === "school_principal") {
      if (!schoolId) {
        return { success: false, error: "School selection is required for targeting a specific principal." };
      }

      // Fetch school details
      const { data: school, error: schoolError } = await supabaseAdmin
        .from("schools")
        .select("name")
        .eq("id", schoolId)
        .single();

      if (schoolError) {
        return { success: false, error: `Failed to fetch school info: ${schoolError.message}` };
      }
      schoolName = school?.name || "";

      // Fetch school principal
      const { data: principal, error: principalError } = await supabaseAdmin
        .from("principals")
        .select("id")
        .eq("school_id", schoolId)
        .limit(1)
        .maybeSingle();

      if (principalError) {
        return { success: false, error: `Failed to fetch school principal: ${principalError.message}` };
      }
      if (!principal) {
        return { success: false, error: `No principal assigned to ${schoolName || "the selected school"}.` };
      }
      principalIds = [principal.id];
    }

    // 2. Fetch all staff IDs (if targeting all or staff)
    if (target === "all" || target === "staff") {
      const { data: staff, error: staffError } = await supabaseAdmin
        .from("staff")
        .select("id");

      if (staffError) {
        return { success: false, error: `Failed to fetch staff: ${staffError.message}` };
      }
      staffIds = staff.map((s) => s.id);
    }

    // Gather all target user IDs (including the broadcasting Superadmin)
    const userIds = Array.from(new Set([
      user.id,
      ...principalIds,
      ...staffIds,
    ]));

    if (userIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 3. Create a notification record for each user
    const insertPayloads = userIds.map((targetUserId) => ({
      user_id: targetUserId,
      title,
      message,
      type: "announcement" as const,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(insertPayloads);

    if (insertError) {
      return { success: false, error: `Failed to insert notifications: ${insertError.message}` };
    }

    // 4. Log Audit Activity
    await supabaseAdmin.from("audit_logs").insert({
      action: "system_alert_broadcasted",
      table_name: "notifications",
      new_data: {
        title,
        message,
        target,
        school_id: schoolId || null,
        school_name: schoolName || null,
        recipient_count: userIds.length,
      },
      category: "announcement",
    });

    revalidatePath("/", "layout");
    revalidatePath("/superadmin/notifications");
    revalidatePath("/principal/notifications");
    revalidatePath("/staff/notifications");

    return { success: true, count: userIds.length };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

export async function getSystemBroadcastsAction() {
  try {
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

    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("action", "system_alert_broadcasted")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, broadcasts: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
