"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { AuthError, PermissionError, withErrorHandling } from "@/lib/errors";

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

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  tableName: string;
  recordId: string | null;
  oldData: any;
  newData: any;
  ipAddress: string | null;
  createdAt: string;
  category: string;
}

export interface AuditLogsFilters {
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const getAuditLogsAction = withErrorHandling(
  "getAuditLogs",
  async (filters: AuditLogsFilters = {}) => {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AuthError("Authentication required.");

    // Verify Principal
    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) throw new PermissionError("Principal permissions required.");

    const {
      category,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
    } = filters;

    const offset = (page - 1) * limit;

    // 1. Get all staff in school to restrict logs
    const { data: staffList } = await supabaseAdmin
      .from("staff")
      .select("id, first_name, last_name, email")
      .eq("school_id", principal.school_id);

    const { data: principalList } = await supabaseAdmin
      .from("principals")
      .select("id, full_name, email")
      .eq("school_id", principal.school_id);

    const staffIds = (staffList || []).map(s => s.id);
    const principalIds = (principalList || []).map(p => p.id);
    const allowedUserIds = [...staffIds, ...principalIds];

    // Create a mapping of userId -> details for quick lookup
    const userMap = new Map<string, { name: string; email: string; role: string }>();
    staffList?.forEach(s => {
      userMap.set(s.id, {
        name: `${s.first_name} ${s.last_name}`,
        email: s.email,
        role: "staff"
      });
    });
    principalList?.forEach(p => {
      userMap.set(p.id, {
        name: p.full_name,
        email: p.email,
        role: "principal"
      });
    });

    // 2. Build the query
    let query = supabaseAdmin
      .from("audit_logs")
      .select("*", { count: "exact" });

    // Restrict logs to this school's users or system logs (where user_id is null)
    if (allowedUserIds.length > 0) {
      // Build a string for the 'or' filter: 'user_id.is.null,user_id.in.(id1,id2,...)'
      const idsString = allowedUserIds.join(",");
      query = query.or(`user_id.is.null,user_id.in.(${idsString})`);
    } else {
      query = query.is("user_id", null);
    }

    // Apply category filter
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Apply date range filters
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      // Add end-of-day time if only date is provided
      const endDateTime = endDate.includes("T") ? endDate : `${endDate}T23:59:59.999Z`;
      query = query.lte("created_at", endDateTime);
    }

    // Apply search filter (action, table_name, or matched user names/emails)
    if (search) {
      const searchLower = search.toLowerCase();
      
      // Find user ids matching the search query
      const matchedUserIds: string[] = [];
      userMap.forEach((details, uId) => {
        if (
          details.name.toLowerCase().includes(searchLower) ||
          details.email.toLowerCase().includes(searchLower) ||
          details.role.toLowerCase().includes(searchLower)
        ) {
          matchedUserIds.push(uId);
        }
      });

      let orConditions = `action.ilike.%${search}%,table_name.ilike.%${search}%`;
      if (matchedUserIds.length > 0) {
        orConditions += `,user_id.in.(${matchedUserIds.join(",")})`;
      }
      query = query.or(orConditions);
    }

    // Ordering and pagination
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    const items: AuditLogItem[] = (data || []).map(log => {
      const uInfo = log.user_id ? userMap.get(log.user_id) : null;
      return {
        id: log.id,
        userId: log.user_id,
        userName: uInfo ? uInfo.name : log.user_id ? "Unknown User" : "System",
        userEmail: uInfo ? uInfo.email : log.user_id ? "unknown@mps.edu" : "system@mps.edu",
        userRole: uInfo ? uInfo.role : log.user_id ? "unknown" : "system",
        action: log.action,
        tableName: log.table_name,
        recordId: log.record_id,
        oldData: log.old_data,
        newData: log.new_data,
        ipAddress: log.ip_address,
        createdAt: log.created_at,
        category: log.category || "system",
      };
    });

    return {
      items,
      totalCount: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }
);

export const getAuditStatsAction = withErrorHandling(
  "getAuditStats",
  async () => {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AuthError("Authentication required.");

    const { data: principal } = await supabaseAdmin
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!principal) throw new PermissionError("Principal permissions required.");

    // Get school staff IDs
    const { data: staffList } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("school_id", principal.school_id);
    const { data: principalList } = await supabaseAdmin
      .from("principals")
      .select("id")
      .eq("school_id", principal.school_id);

    const staffIds = (staffList || []).map(s => s.id);
    const principalIds = (principalList || []).map(p => p.id);
    const allowedUserIds = [...staffIds, ...principalIds];

    let query = supabaseAdmin.from("audit_logs").select("category, created_at");

    if (allowedUserIds.length > 0) {
      query = query.or(`user_id.is.null,user_id.in.(${allowedUserIds.join(",")})`);
    } else {
      query = query.is("user_id", null);
    }

    const { data: logs, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch audit stats: ${error.message}`);
    }

    const totalLogs = logs.length;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentLogs = logs.filter(l => new Date(l.created_at) >= last24h);
    const recentCount = recentLogs.length;

    // Calculate category distribution
    const categoryCounts: Record<string, number> = {};
    logs.forEach(l => {
      const cat = l.category || "system";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Activity trend for last 7 days
    const dailyActivity: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyActivity[dateString] = 0;
    }

    logs.forEach(l => {
      const lDate = new Date(l.created_at);
      const dateString = lDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (dateString in dailyActivity) {
        dailyActivity[dateString]++;
      }
    });

    const trendData = Object.entries(dailyActivity).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      totalLogs,
      recentCount,
      categoryCounts,
      trendData,
    };
  }
);
