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

interface RegisterPoseInput {
  pose: "front" | "left" | "right" | "up" | "down";
  base64Image: string;
  descriptor?: number[];
}

export async function registerFaceTemplateAction(formData: RegisterPoseInput) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // Verify user is active staff
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("id, status, face_registration_attempts")
      .eq("id", user.id)
      .single();

    if (staffError || !staff) {
      return { success: false, error: "Staff profile not found." };
    }

    if (staff.status !== "active") {
      return { success: false, error: "Staff account is not active." };
    }

    if (staff.face_registration_attempts >= 5) {
      return { success: false, error: "Registration locked. Exceeded maximum attempts (5)." };
    }

    // Decode base64 image data
    const base64Data = formData.base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const filePath = `templates/${user.id}/${formData.pose}.jpg`;

    // Upload to Supabase Storage bucket face-templates
    const { error: uploadError } = await supabaseAdmin.storage
      .from("face-templates")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Generate public URL
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/face-templates/${filePath}`;

    // Upsert into face_templates mapping table
    const { error: dbError } = await supabaseAdmin
      .from("face_templates")
      .upsert(
        {
          staff_id: user.id,
          pose: formData.pose,
          image_url: publicUrl,
          descriptor: formData.descriptor || null,
        },
        { onConflict: "staff_id,pose" }
      );

    if (dbError) {
      return { success: false, error: `Database save failed: ${dbError.message}` };
    }

    // Check if all 5 poses are registered
    const { data: templates } = await supabaseAdmin
      .from("face_templates")
      .select("pose")
      .eq("staff_id", user.id);

    const registeredPoses = templates?.map((t) => t.pose) || [];
    const requiredPoses = ["front", "left", "right", "up", "down"];
    const allCompleted = requiredPoses.every((p) => registeredPoses.includes(p));

    return {
      success: true,
      pose: formData.pose,
      allCompleted,
      registeredCount: registeredPoses.length,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function completeFaceRegistrationAction(success: boolean) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    if (success) {
      // Set face_registered = true
      const { error } = await supabaseAdmin
        .from("staff")
        .update({ face_registered: true })
        .eq("id", user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      await supabaseAdmin.from("audit_logs").insert({
        user_id: user.id,
        action: "face_registration_completed",
        table_name: "staff",
        record_id: user.id,
      
      category: "attendance",});

      revalidatePath("/staff");
      return { success: true };
    } else {
      // Increment attempts
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("first_name, last_name, school_id, face_registration_attempts")
        .eq("id", user.id)
        .single();

      const newAttempts = (staff?.face_registration_attempts || 0) + 1;

      const { error } = await supabaseAdmin
        .from("staff")
        .update({ face_registration_attempts: newAttempts })
        .eq("id", user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      await supabaseAdmin.from("audit_logs").insert({
        user_id: user.id,
        action: `face_registration_failed_attempt_${newAttempts}`,
        table_name: "staff",
        record_id: user.id,
      
      category: "attendance",});

      // Notify school principals of the calibration failure
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
              "Face Setup Wizard Failure",
              `${staffName} failed biometric calibration (Attempt ${newAttempts}/5).`,
              "attendance"
            );
          }
        }
      }

      return { success: true, attempts: newAttempts, locked: newAttempts >= 5 };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function resetFaceBiometricsAction(staffId: string) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: principal },
    } = await supabase.auth.getUser();

    if (!principal) {
      return { success: false, error: "Authentication required." };
    }

    // Verify authorized user is principal of the same school
    const { data: principalProfile } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", principal.id)
      .single();

    if (!principalProfile) {
      return { success: false, error: "Only school principals can reset biometrics." };
    }

    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("school_id")
      .eq("id", staffId)
      .single();

    if (!staff || staff.school_id !== principalProfile.school_id) {
      return { success: false, error: "Unauthorized access to student/staff profile." };
    }

    // 1. Delete templates from db
    const { error: dbError } = await supabaseAdmin
      .from("face_templates")
      .delete()
      .eq("staff_id", staffId);

    if (dbError) {
      return { success: false, error: `Reset failed in templates: ${dbError.message}` };
    }

    // 2. Clear flags in staff table
    const { error: staffError } = await supabaseAdmin
      .from("staff")
      .update({
        face_registered: false,
        face_registration_attempts: 0,
      })
      .eq("id", staffId);

    if (staffError) {
      return { success: false, error: `Reset failed in staff: ${staffError.message}` };
    }

    // 3. Clear templates folder in storage (optional but clean)
    const requiredPoses = ["front", "left", "right", "up", "down"];
    const filePaths = requiredPoses.map((p) => `templates/${staffId}/${p}.jpg`);
    await supabaseAdmin.storage.from("face-templates").remove(filePaths);

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: principal.id,
      action: "face_registration_reset",
      table_name: "staff",
      record_id: staffId,
    
      category: "attendance",});

    revalidatePath(`/principal/staff/${staffId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
