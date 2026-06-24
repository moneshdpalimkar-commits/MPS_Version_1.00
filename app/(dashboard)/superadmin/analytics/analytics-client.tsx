"use client";

import React from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, BarChart3, LineChart as LineIcon, AlertCircle } from "lucide-react";

interface AnalyticsClientProps {
  attendanceData: Array<{ name: string; Rate: number }>;
  tenantStaffData: Array<{ name: string; Staff: number }>;
  payrollData: Array<{ name: string; Budget: number }>;
}

export function AnalyticsClient({
  attendanceData,
  tenantStaffData,
  payrollData,
}: AnalyticsClientProps) {
  const isAttendanceEmpty = attendanceData.length === 0;
  const isStaffEmpty = tenantStaffData.length === 0;
  const isPayrollEmpty = payrollData.length === 0;

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-500">
      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Chart 1: Attendance Trends */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Average Daily Attendance Rate (%)
            </h2>
          </div>
          
          {isAttendanceEmpty ? (
            <div className="h-72 w-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No Attendance Data</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Daily attendance logs will generate monthly average charts here.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border) / 30%)" />
                  <XAxis dataKey="name" stroke="oklch(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} stroke="oklch(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(var(--popover))",
                      borderColor: "oklch(var(--border))",
                      borderRadius: "8px",
                      color: "oklch(var(--popover-foreground))",
                    }}
                  />
                  <Line type="monotone" dataKey="Rate" stroke="oklch(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Staff Sizes per School */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Staff Profiles per School Tenant
            </h2>
          </div>

          {isStaffEmpty ? (
            <div className="h-72 w-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 p-6 text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No School Data</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Create school tenants and register staff to populate the tenant size comparison chart.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenantStaffData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border) / 30%)" />
                  <XAxis dataKey="name" stroke="oklch(var(--muted-foreground))" />
                  <YAxis stroke="oklch(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(var(--popover))",
                      borderColor: "oklch(var(--border))",
                      borderRadius: "8px",
                      color: "oklch(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="Staff" fill="oklch(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 3: System-Wide Budget Area */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col md:col-span-2 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <LineIcon className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Monthly System-wide Payroll Expenditure ($)
            </h2>
          </div>

          {isPayrollEmpty ? (
            <div className="h-72 w-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 p-6 text-center">
              <LineIcon className="w-8 h-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No Payroll Data</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Expenditure will compile here once payroll cycles are generated and approved by school principals.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={payrollData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border) / 30%)" />
                  <XAxis dataKey="name" stroke="oklch(var(--muted-foreground))" />
                  <YAxis stroke="oklch(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(var(--popover))",
                      borderColor: "oklch(var(--border))",
                      borderRadius: "8px",
                      color: "oklch(var(--popover-foreground))",
                    }}
                  />
                  <Area type="monotone" dataKey="Budget" stroke="oklch(var(--primary))" fillOpacity={1} fill="url(#colorBudget)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
