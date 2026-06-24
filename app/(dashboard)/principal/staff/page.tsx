import React from "react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { StaffManagementClient } from "./staff-management-client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    page?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function PrincipalStaffPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let schoolId: string | null = null;

  if (user) {
    const { data: principal } = await supabase
      .from("principals")
      .select("school_id")
      .eq("id", user.id)
      .single();
    if (principal) {
      schoolId = principal.school_id;
    }
  }

  // Await search parameters (Next.js 15 requirement)
  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const category = resolvedParams.category || "";
  const page = Number(resolvedParams.page) || 1;
  const limit = 8;
  const offset = (page - 1) * limit;

  let staffList: any[] = [];
  let departments: any[] = [];
  let totalCount = 0;
  let totalPages = 0;

  if (schoolId) {
    // 1. Fetch departments
    const { data: deptData } = await supabase
      .from("departments")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    departments = deptData || [];

    // 2. Build Query
    let query = supabase
      .from("staff")
      .select("*, departments(name)", { count: "exact" })
      .eq("school_id", schoolId)
      .neq("status", "archived");

    if (search) {
      // Search by first_name, last_name or email
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    if (category && category !== "all") {
      query = query.eq("staff_role", category);
    }

    // 3. Fetch paginated records
    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    staffList = data || [];
    totalCount = count || 0;
    totalPages = Math.ceil(totalCount / limit);
  }

  return (
    <RoleGuard allowedRoles={["principal"]}>
      <StaffManagementClient
        initialStaff={staffList}
        departments={departments}
        schoolId={schoolId || ""}
        search={search}
        category={category}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
      />
    </RoleGuard>
  );
}
