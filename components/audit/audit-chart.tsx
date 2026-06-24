"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity, ShieldAlert, BarChart3 } from "lucide-react";

interface AuditChartProps {
  trendData: { date: string; count: number }[];
  categoryCounts: Record<string, number>;
}

const CATEGORY_COLORS: Record<string, { fill: string; border: string; label: string }> = {
  attendance: { fill: "bg-teal-500", border: "border-teal-500", label: "Attendance" },
  leave: { fill: "bg-amber-500", border: "border-amber-500", label: "Leave" },
  payroll: { fill: "bg-emerald-500", border: "border-emerald-500", label: "Payroll" },
  holiday: { fill: "bg-rose-500", border: "border-rose-500", label: "Holidays" },
  announcement: { fill: "bg-blue-500", border: "border-blue-500", label: "Announcements" },
  settings: { fill: "bg-purple-500", border: "border-purple-500", label: "Settings" },
  system: { fill: "bg-slate-500", border: "border-slate-500", label: "System/Other" },
};

export function AuditChart({ trendData, categoryCounts }: AuditChartProps) {
  const totalLogs = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  // Parse categories to list
  const categoryData = Object.entries(categoryCounts)
    .map(([category, count]) => {
      const percentage = totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0;
      return {
        category,
        count,
        percentage,
        style: CATEGORY_COLORS[category] || CATEGORY_COLORS.system,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
      {/* Activity Trend (Line/Area Chart) */}
      <div className="lg:col-span-2 bg-card/65 backdrop-blur-md border border-border/60 rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            <h3 className="font-semibold text-foreground text-sm tracking-wide uppercase">
              System Activity Trend
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-light">Last 7 Days</span>
        </div>

        <div className="w-full h-[220px] pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: "var(--muted-foreground, #888)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: "var(--muted-foreground, #888)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "var(--card, #fff)", 
                  borderColor: "var(--border, #ddd)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--foreground, #000)"
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-primary, #6366f1)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="bg-card/65 backdrop-blur-md border border-border/60 rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm tracking-wide uppercase">
            Distribution by Module
          </h3>
        </div>

        <div className="flex-1 flex flex-col gap-3 justify-center">
          {categoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground gap-1.5">
              <ShieldAlert className="w-6 h-6 text-muted-foreground/45" />
              <span className="text-xs font-medium">No distribution details available</span>
            </div>
          ) : (
            categoryData.slice(0, 5).map((item) => (
              <div key={item.category} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">{item.style.label}</span>
                  <span className="text-muted-foreground">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.style.fill} transition-all duration-500`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
