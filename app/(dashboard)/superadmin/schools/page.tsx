import React from "react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { SchoolManagementClient } from "./schools-client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function SchoolsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  
  // Await search parameters (Next.js 15 requirement)
  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = Number(resolvedParams.page) || 1;
  const limit = 8;
  const offset = (page - 1) * limit;

  // 1. Fetch schools with counts and pagination
  let query = supabase
    .from("schools")
    .select("*, principals(id, full_name, email, is_active)", { count: "exact" });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: schools, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const totalSchools = count || 0;
  const totalPages = Math.ceil(totalSchools / limit);

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <SchoolManagementClient
        initialSchools={schools || []}
        search={search}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalSchools}
      />
    </RoleGuard>
  );
}
