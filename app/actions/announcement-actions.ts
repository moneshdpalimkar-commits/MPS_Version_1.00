"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validate } from "@/lib/validation";
import { withErrorHandling, AuthError, PermissionError } from "@/lib/errors";

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

export const getAnnouncementsAction = withErrorHandling(
  "getAnnouncements",
  async () => {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthError();
    }

    // 1. Check if user is a Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();

    if (principal) {
      // Principal fetches all announcements for their school
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .select(`
          *,
          departments:department_id (
            name
          )
        `)
        .eq("school_id", principal.school_id)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch announcements: ${error.message}`);
      }

      return { announcements: data || [] };
    }

    // 2. User is Staff
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("school_id, staff_role, department_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!staff) {
      throw new PermissionError("Profile context not found.");
    }

    // Prepare query for staff based on target audience conditions
    let query = supabaseAdmin
      .from("announcements")
      .select(`
        *,
        departments:department_id (
          name
        )
      `)
      .eq("school_id", staff.school_id);

    // Apply audience filters
    if (staff.staff_role === "teaching") {
      if (staff.department_id) {
        query = query.or(`audience.eq.all,audience.eq.teaching,and(audience.eq.department,department_id.eq.${staff.department_id})`);
      } else {
        query = query.or("audience.eq.all,audience.eq.teaching");
      }
    } else {
      // non-teaching or support
      if (staff.department_id) {
        query = query.or(`audience.eq.all,audience.eq.non-teaching,and(audience.eq.department,department_id.eq.${staff.department_id})`);
      } else {
        query = query.or("audience.eq.all,audience.eq.non-teaching");
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch announcements: ${error.message}`);
    }

    return { announcements: data || [] };
  }
);

const CreateAnnouncementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().min(5, "Description must be at least 5 characters"),
  type: z.enum(["general", "holiday", "meeting", "exam", "emergency"]),
  audience: z.enum(["all", "teaching", "non-teaching", "department"]),
  departmentId: z.string().uuid().optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable().or(z.literal("")),
  attachmentName: z.string().optional().nullable(),
});

type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

export const createAnnouncementAction = withErrorHandling(
  "createAnnouncement",
  async (rawInput: CreateAnnouncementInput) => {
    const formData = validate(CreateAnnouncementSchema, rawInput);
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthError();
    }

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      throw new PermissionError("Principal permissions required.");
    }

    const { data: announcement, error } = await supabaseAdmin
      .from("announcements")
      .insert({
        school_id: principal.school_id,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        audience: formData.audience,
        department_id: formData.audience === "department" ? formData.departmentId : null,
        attachment_url: formData.attachmentUrl || null,
        attachment_name: formData.attachmentName || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to publish announcement: ${error.message}`);
    }

    // Insert into audit logs with category
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "announcement_created",
      table_name: "announcements",
      record_id: announcement.id,
      new_data: { title: announcement.title, type: announcement.type },
      category: "announcement",
    });

    revalidatePath("/principal/announcements");
    revalidatePath("/staff/announcements");
    return { success: true };
  }
);

export const deleteAnnouncementAction = withErrorHandling(
  "deleteAnnouncement",
  async (announcementId: string) => {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthError();
    }

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      throw new PermissionError("Principal permissions required.");
    }

    const { error } = await supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", announcementId)
      .eq("school_id", principal.school_id);

    if (error) {
      throw new Error(`Failed to delete announcement: ${error.message}`);
    }

    // Insert into audit logs with category
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "announcement_deleted",
      table_name: "announcements",
      record_id: announcementId,
      category: "announcement",
    });

    revalidatePath("/principal/announcements");
    revalidatePath("/staff/announcements");
    return { success: true };
  }
);
