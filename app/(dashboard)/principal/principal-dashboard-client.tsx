"use client";

import React from "react";
import {
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  CalendarDays,
  FileSpreadsheet,
  TrendingUp,
  History,
  Building,
  AlertCircle,
} from "lucide-react";
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

interface Stats {
  present: number;
  absent: number;
  late: number;
  superLate: number;
  halfDay: number;
  leave: number;
}

interface ChartItem {
  day?: string;
  time?: string;
  name?: string;
  Rate?: number;
  Staff?: number;
  Present?: number;
}

interface PrincipalDashboardClientProps {
  schoolName: string;
  stats: Stats;
  weeklyAttendance: Array<{ day: string; Rate: number }>;
  arrivalTimes: Array<{ time: string; Staff: number }>;
  departmentPerformance: Array<{ name: string; Present: number }>;
}

export function PrincipalDashboardClient({
  schoolName,
  stats,
  weeklyAttendance,
  arrivalTimes,
  departmentPerformance,
}: PrincipalDashboardClientProps) {
  
  const cards = [
    { label: "Present", value: stats.present, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: UserCheck },
    { label: "Absent", value: stats.absent, color: "text-destructive bg-destructive/10 border-destructive/20", icon: UserX },
    { label: "Late", value: stats.late, color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Clock },
    { label: "Super Late", value: stats.superLate, color: "text-rose-500 bg-rose-500/10 border-rose-500/20", icon: AlertTriangle },
    { label: "Half Day", value: stats.halfDay, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", icon: FileSpreadsheet },
    { label: "On Leave", value: stats.leave, color: "text-purple-500 bg-purple-500/10 border-purple-500/20", icon: CalendarDays },
  ];

  const isWeeklyEmpty = weeklyAttendance.length === 0;
  const isArrivalEmpty = arrivalTimes.length === 0 || arrivalTimes.every(item => item.Staff === 0);
  const isDeptEmpty = departmentPerformance.length === 0;

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-500">
      
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Building className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {schoolName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of today's attendance logs and school staff statistics.
          </p>
        </div>
      </div>

      {/* 6 Metric Widgets Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`p-4 border border-border rounded-xl bg-card shadow-2xs flex flex-col justify-between`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {card.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Attendance Trends */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Weekly Attendance Rate (%)
            </h2>
          </div>
          
          {isWeeklyEmpty ? (
            <div className="h-64 w-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No Weekly Data</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Attendance records across this week will build the trend chart.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyAttendance} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border) / 30%)" />
                  <XAxis dataKey="day" stroke="oklch(var(--muted-foreground))" />
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

        {/* Average Arrival Time distribution */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Arrival Time Distribution
            </h2>
          </div>

          {isArrivalEmpty ? (
            <div className="h-64 w-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 p-6 text-center">
              <Clock className="w-8 h-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No Check-in Times</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Staff check-in timestamps will map the arrival distribution.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arrivalTimes} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border) / 30%)" />
                  <XAxis dataKey="time" stroke="oklch(var(--muted-foreground))" />
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

        {/* Department Performance */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Attendance by Department (%)
            </h2>
          </div>

          {isDeptEmpty ? (
            <div className="h-64 w-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 p-6 text-center">
              <Building className="w-8 h-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No Departments</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Register departments and assign staff to track group performance.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentPerformance} layout="vertical" margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(var(--border) / 30%)" />
                  <XAxis type="number" domain={[0, 100]} stroke="oklch(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" stroke="oklch(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(var(--popover))",
                      borderColor: "oklch(var(--border))",
                      borderRadius: "8px",
                      color: "oklch(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="Present" fill="oklch(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
