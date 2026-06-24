"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function getCalendarDataAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    // 1. Resolve role and school_id
    let schoolId = "";
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();

    if (principal) {
      schoolId = principal.school_id;
    } else {
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("school_id")
        .eq("id", user.id)
        .single();
      if (staff) {
        schoolId = staff.school_id;
      }
    }

    if (!schoolId) {
      return { success: false, error: "User school context not found." };
    }

    // 2. Query holidays and events
    const [holidaysResult, eventsResult] = await Promise.all([
      supabaseAdmin
        .from("holidays")
        .select("*")
        .eq("school_id", schoolId)
        .order("start_date", { ascending: true }),
      supabaseAdmin
        .from("events")
        .select(`
          *,
          departments:department_id (
            name
          )
        `)
        .eq("school_id", schoolId)
        .order("date", { ascending: true }),
    ]);

    if (holidaysResult.error) {
      return { success: false, error: `Holidays query failed: ${holidaysResult.error.message}` };
    }
    if (eventsResult.error) {
      return { success: false, error: `Events query failed: ${eventsResult.error.message}` };
    }

    // 3. Map into unified calendar items format
    const calendarItems = [
      ...(holidaysResult.data || []).map((h) => ({
        id: h.id,
        type: "holiday",
        title: h.name,
        startDate: h.start_date,
        endDate: h.end_date,
        isHalfDay: h.is_half_day,
        holidayType: h.holiday_type,
        category: "holiday",
        description: `${h.name} (${h.holiday_type === "indian" ? "Indian National Holiday" : "Custom School Holiday"})`,
      })),
      ...(eventsResult.data || []).map((e) => ({
        id: e.id,
        type: "event",
        title: e.name,
        startDate: e.date,
        endDate: e.date,
        startTime: e.start_time,
        endTime: e.end_time,
        category: e.category,
        audience: e.audience,
        departmentName: e.departments?.name || null,
        description: e.description || "",
      })),
    ];

    return { success: true, items: calendarItems };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface CreateEventInput {
  name: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  audience: "all" | "teaching" | "non-teaching" | "department";
  departmentId?: string;
  category: "exam" | "sports" | "meeting" | "ptm" | "annual_day";
}

export async function createEventAction(formData: CreateEventInput) {
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

    const { data: event, error } = await supabaseAdmin
      .from("events")
      .insert({
        school_id: principal.school_id,
        name: formData.name,
        description: formData.description || null,
        date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        audience: formData.audience,
        department_id: formData.audience === "department" ? formData.departmentId : null,
        category: formData.category,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: `Failed to create event: ${error.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "event_created",
      table_name: "events",
      record_id: event.id,
      new_data: { name: event.name, category: event.category },
    });

    revalidatePath("/principal/calendar");
    revalidatePath("/staff/calendar");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function deleteEventAction(eventId: string) {
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
      .from("events")
      .delete()
      .eq("id", eventId)
      .eq("school_id", principal.school_id);

    if (error) {
      return { success: false, error: `Failed to delete event: ${error.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "event_deleted",
      table_name: "events",
      record_id: eventId,
    
      category: "holiday",});

    revalidatePath("/principal/calendar");
    revalidatePath("/staff/calendar");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

interface CreateHolidayInput {
  name: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  holidayType: "indian" | "custom";
}

export async function createHolidayAction(formData: CreateHolidayInput) {
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

    const activeAcadYear = await getOrCreateActiveAcademicYear(principal.school_id);

    const { data: holiday, error } = await supabaseAdmin
      .from("holidays")
      .insert({
        school_id: principal.school_id,
        academic_year_id: activeAcadYear,
        name: formData.name,
        start_date: formData.startDate,
        end_date: formData.endDate,
        is_half_day: formData.isHalfDay,
        holiday_type: formData.holidayType,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: `Failed to create holiday: ${error.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "holiday_created",
      table_name: "holidays",
      record_id: holiday.id,
      new_data: { name: holiday.name, type: holiday.holiday_type },
    
      category: "holiday",});

    revalidatePath("/principal/calendar");
    revalidatePath("/staff/calendar");
    revalidatePath("/principal/attendance");
    revalidatePath("/staff/attendance");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

export async function deleteHolidayAction(holidayId: string) {
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
      .from("holidays")
      .delete()
      .eq("id", holidayId)
      .eq("school_id", principal.school_id);

    if (error) {
      return { success: false, error: `Failed to delete holiday: ${error.message}` };
    }

    // Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "holiday_deleted",
      table_name: "holidays",
      record_id: holidayId,
    
      category: "holiday",});

    revalidatePath("/principal/calendar");
    revalidatePath("/staff/calendar");
    revalidatePath("/principal/attendance");
    revalidatePath("/staff/attendance");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

// Action to import Indian Holidays for the current academic year
export async function importIndianHolidaysAction() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) {
      return { success: false, error: "Principal permissions required." };
    }

    const activeAcadYear = await getOrCreateActiveAcademicYear(principal.school_id);
    const currentYear = new Date().getFullYear();

    // Standard fallback list of standard Indian national and popular holidays for 2026
    const indianHolidaysFallback = [
      { name: "Republic Day", start_date: `${currentYear}-01-26`, end_date: `${currentYear}-01-26` },
      { name: "Maha Shivratri", start_date: `${currentYear}-03-15`, end_date: `${currentYear}-03-15` },
      { name: "Holi Festival", start_date: `${currentYear}-03-23`, end_date: `${currentYear}-03-23` },
      { name: "Good Friday", start_date: `${currentYear}-04-03`, end_date: `${currentYear}-04-03` },
      { name: "Dr. Ambedkar Jayanti", start_date: `${currentYear}-04-14`, end_date: `${currentYear}-04-14` },
      { name: "Eid al-Fitr", start_date: `${currentYear}-04-10`, end_date: `${currentYear}-04-10` },
      { name: "Independence Day", start_date: `${currentYear}-08-15`, end_date: `${currentYear}-08-15` },
      { name: "Gandhi Jayanti", start_date: `${currentYear}-10-02`, end_date: `${currentYear}-10-02` },
      { name: "Dussehra", start_date: `${currentYear}-10-20`, end_date: `${currentYear}-10-20` },
      { name: "Diwali (Festival of Lights)", start_date: `${currentYear}-11-08`, end_date: `${currentYear}-11-08` },
      { name: "Guru Nanak Jayanti", start_date: `${currentYear}-11-24`, end_date: `${currentYear}-11-24` },
      { name: "Christmas Day", start_date: `${currentYear}-12-25`, end_date: `${currentYear}-12-25` },
    ];

    let importedList = indianHolidaysFallback;

    // Fetch a holiday from Open Holidays API as well using the user's provided endpoint
    try {
      const openHolidaysUrl = `https://openholidaysapi.org/SchoolHolidaysByDate?date=${currentYear}-12-25&languageIsoCode=IN`;
      const responseOpen = await fetch(openHolidaysUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (responseOpen.ok) {
        const dataOpen = await responseOpen.json();
        if (Array.isArray(dataOpen) && dataOpen.length > 0) {
          const xmas = dataOpen.find((item: any) => 
            item.name && item.name.some((n: any) => n.text && n.text.toLowerCase().includes("christmas"))
          );
          if (xmas) {
            const xmasName = xmas.name.find((n: any) => n.language === "EN")?.text || "Christmas Holidays";
            const exists = importedList.some((h) => h.start_date === `${currentYear}-12-25`);
            if (!exists) {
              importedList.push({
                name: xmasName,
                start_date: `${currentYear}-12-25`,
                end_date: `${currentYear}-12-25`,
              });
            } else {
              importedList = importedList.map((h) => 
                h.start_date === `${currentYear}-12-25` ? { ...h, name: xmasName } : h
              );
            }
          }
        }
      }
    } catch (e) {
      console.warn("Open Holidays API fetch failed or timed out:", e);
    }

    // Insert holidays checking for duplicates by name & start_date
    let count = 0;
    for (const h of importedList) {
      const { data: existing } = await supabaseAdmin
        .from("holidays")
        .select("id")
        .eq("school_id", principal.school_id)
        .eq("start_date", h.start_date)
        .eq("name", h.name)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("holidays").insert({
          school_id: principal.school_id,
          academic_year_id: activeAcadYear,
          name: h.name,
          start_date: h.start_date,
          end_date: h.end_date,
          is_half_day: false,
          holiday_type: "indian",
        });
        count++;
      }
    }

    // Log Audit
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "indian_holidays_imported",
      table_name: "holidays",
      new_data: { count, year: currentYear },
    
      category: "holiday",});

    revalidatePath("/principal/calendar");
    revalidatePath("/staff/calendar");
    revalidatePath("/principal/attendance");
    revalidatePath("/staff/attendance");
    return { success: true, count };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
