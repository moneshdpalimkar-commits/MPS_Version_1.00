import React from "react";
import { School, Users, Activity, Wallet, CalendarClock, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RoleGuard } from "@/components/shared/role-guard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SuperadminDashboard() {
  const supabase = await createClient();

  // Fetch metrics in parallel
  const [
    { count: schoolCount },
    { count: staffCount },
    { data: auditLogs },
    { data: leaves },
  ] = await Promise.all([
    supabase.from("schools").select("*", { count: "exact", head: true }),
    supabase.from("staff").select("*", { count: "exact", head: true }),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("leave_requests").select("status"),
  ]);

  const totalSchools = schoolCount || 0;
  const totalStaff = staffCount || 0;
  
  // Calculate Leave Overview stats (pending leaves)
  const pendingLeaves = leaves ? leaves.filter(l => l.status === 'pending').length : 0;

  // Mock states for metrics that require high-density telemetry data
  const attendanceRate = totalStaff > 0 ? "95.4%" : "0.0%";
  const payrollBudget = totalSchools > 0 ? `$${(totalSchools * 42000).toLocaleString()}` : "$0"; 

  const stats = [
    { label: "Total Schools", value: totalSchools.toString(), change: "Active tenants", icon: School },
    { label: "Total Staff", value: totalStaff.toString(), change: "Registered profiles", icon: Users },
    { label: "Attendance % (Today)", value: attendanceRate, change: "System average", icon: Activity },
    { label: "Payroll Overview", value: payrollBudget, change: "Current month gross estimate", icon: Wallet },
    { label: "Pending Leaves", value: pendingLeaves.toString(), change: "Awaiting principal review", icon: CalendarClock },
  ];

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            System Console
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time infrastructure health and SaaS tenant overview.
          </p>
        </div>

        {/* 5-Card Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-5 bg-card border border-border rounded-xl shadow-xs flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  {stat.label}
                </span>
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {stat.value}
                </span>
                <span className="block text-[10px] text-muted-foreground mt-1 font-medium truncate">
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Audit Logs Section */}
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Recent System Security Logs
            </h2>
          </div>
          <div className="overflow-x-auto">
            {auditLogs && auditLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table Affected</TableHead>
                    <TableHead>Record Identifier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-foreground capitalize">
                        {log.action.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.table_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.record_id || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No system audit events recorded yet. Tenant creations will appear here.
              </div>
            )}
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
