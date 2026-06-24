import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Instantiate the service role admin client to bypass RLS
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

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the cron request via Bearer token
    const authHeader = request.headers.get("Authorization");
    const secret = process.env.CRON_SECRET || "super_secret_cron_token_2026_mps";

    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Define the threshold date (15 days ago)
    const thresholdDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // 3. Query attendance records older than 15 days that still reference check-in or check-out photos
    const { data: records, error: queryError } = await supabaseAdmin
      .from("attendance")
      .select("id, check_in_face_url, check_out_face_url")
      .lt("date", thresholdDate)
      .or("check_in_face_url.not.is.null,check_out_face_url.not.is.null");

    if (queryError) {
      console.error("[cleanup-photos] Query error:", queryError);
      return Response.json({ success: false, error: queryError.message }, { status: 500 });
    }

    if (!records || records.length === 0) {
      return Response.json({
        success: true,
        message: "No expired photos found to clean up.",
        filesDeleted: 0,
        recordsUpdated: 0,
      });
    }

    // 4. Collect file paths to remove from the storage bucket
    const filePathsToDelete: string[] = [];
    const recordIdsToUpdate: string[] = [];

    // Pattern to extract the relative file path from the public URL
    // e.g. URL: https://.../storage/v1/object/public/attendance-snapshots/snapshots/user_id/date_checkin.jpg
    // Captures: snapshots/user_id/date_checkin.jpg
    const urlPattern = /\/attendance-snapshots\/(.+)$/;

    records.forEach((rec) => {
      let recordContainsPhoto = false;

      if (rec.check_in_face_url) {
        const match = rec.check_in_face_url.match(urlPattern);
        if (match && match[1]) {
          filePathsToDelete.push(decodeURIComponent(match[1]));
          recordContainsPhoto = true;
        }
      }

      if (rec.check_out_face_url) {
        const match = rec.check_out_face_url.match(urlPattern);
        if (match && match[1]) {
          filePathsToDelete.push(decodeURIComponent(match[1]));
          recordContainsPhoto = true;
        }
      }

      if (recordContainsPhoto) {
        recordIdsToUpdate.push(rec.id);
      }
    });

    let storageDeletedCount = 0;
    let dbUpdatedCount = 0;

    // 5. Remove the physical photo assets from Supabase Storage
    if (filePathsToDelete.length > 0) {
      const { data: deletedFiles, error: storageError } = await supabaseAdmin.storage
        .from("attendance-snapshots")
        .remove(filePathsToDelete);

      if (storageError) {
        console.error("[cleanup-photos] Storage deletion error:", storageError);
      } else {
        storageDeletedCount = deletedFiles ? deletedFiles.length : 0;
      }
    }

    // 6. Update database rows to set photo URL columns to NULL
    if (recordIdsToUpdate.length > 0) {
      const { error: dbError } = await supabaseAdmin
        .from("attendance")
        .update({
          check_in_face_url: null,
          check_out_face_url: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", recordIdsToUpdate);

      if (dbError) {
        console.error("[cleanup-photos] Database update error:", dbError);
        return Response.json({ success: false, error: dbError.message }, { status: 500 });
      }
      dbUpdatedCount = recordIdsToUpdate.length;
    }

    // 7. Write an audit log event
    await supabaseAdmin.from("audit_logs").insert({
      action: "cron_attendance_photos_cleanup",
      table_name: "attendance",
      new_data: {
        threshold_date: thresholdDate,
        records_updated: dbUpdatedCount,
        files_deleted: storageDeletedCount,
        file_paths: filePathsToDelete,
      },
      category: "attendance",
    });

    return Response.json({
      success: true,
      message: `Successfully deleted ${storageDeletedCount} photos from storage and updated ${dbUpdatedCount} database records.`,
      thresholdDate,
      filesDeleted: storageDeletedCount,
      recordsUpdated: dbUpdatedCount,
    });
  } catch (err: any) {
    console.error("[cleanup-photos] Server error:", err);
    return Response.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
