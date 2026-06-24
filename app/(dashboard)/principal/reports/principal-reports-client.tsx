"use client";

import React, { useState, useTransition } from "react";
import {
  FileText,
  Search,
  Loader2,
  FileSpreadsheet,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  UserCheck,
  AlertCircle,
  Building,
  Calendar,
  Sparkles,
  Award,
  Users,
  Percent,
  ChevronDown,
  Coins,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";
import { getReportsDataAction } from "@/app/actions/report-actions";

interface PrincipalReportsClientProps {
  initialAnalytics: {
    avgAttendanceRate: number;
    totalLogs: number;
    lateCount: number;
    attendanceTrend: any[];
    statusDistribution: any[];
    mostPunctual: any[];
    mostAbsent: any[];
  };
}

type ReportType = "attendance" | "leave" | "payroll" | "department" | "academicYear";

export function PrincipalReportsClient({ initialAnalytics }: PrincipalReportsClientProps) {
  const [isPending, startTransition] = useTransition();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"analytics" | "reports">("analytics");

  // Filter and Query States
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // Report Results
  const [reportData, setReportData] = useState<any[] | null>(null);

  // Status Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getMonthName = (monthNum: number) => {
    return new Date(2000, monthNum - 1, 1).toLocaleString("default", { month: "long" });
  };

  const handleGenerateReport = () => {
    setErrorMsg(null);
    setReportData(null);

    startTransition(async () => {
      const result = await getReportsDataAction(month, year);
      if (result.success && result.reports) {
        setReportData(result.reports[reportType] || []);
      } else {
        setErrorMsg(result.error || "Failed to query reports data.");
      }
    });
  };

  // Client-Side CSV & Excel Exporter
  const handleExportData = (excelMode = false) => {
    if (!reportData || reportData.length === 0) return;

    let headers: string[] = [];
    let keys: string[] = [];

    switch (reportType) {
      case "attendance":
        headers = ["Staff Name", "Present Days", "Late Days", "Absent Days", "Half Days", "Leave Days", "Attendance %"];
        keys = ["staffName", "presentDays", "lateDays", "absentDays", "halfDays", "leaveDays", "rate"];
        break;
      case "leave":
        headers = ["Staff Name", "Employee ID", "Designation", "CL Allocated", "CL Used", "SL Allocated", "SL Used", "EL Allocated", "EL Used", "Pending Requests"];
        keys = ["staffName", "employeeId", "designation", "casualAllocated", "casualUsed", "sickAllocated", "sickUsed", "earnedAllocated", "earnedUsed", "pendingRequests"];
        break;
      case "payroll":
        headers = ["Staff Name", "Employee ID", "Basic Salary (INR)", "Allowances (INR)", "PF Deduction (INR)", "Prof Tax (INR)", "Attendance Penalty (INR)", "Other Deduct (INR)", "Net Salary (INR)"];
        keys = ["staffName", "employeeId", "basicSalary", "allowances", "pfDeduction", "taxDeduction", "attendanceDeduction", "otherDeductions", "netSalary"];
        break;
      case "department":
        headers = ["Department Name", "Shift Start", "Shift End", "Total Employees", "Avg Attendance %"];
        keys = ["name", "startTime", "endTime", "staffCount", "avgAttendance"];
        break;
      case "academicYear":
        headers = ["Academic Year", "Start Date", "End Date", "Total Holidays", "Total Scheduled Events"];
        keys = ["name", "startDate", "endDate", "totalHolidays", "totalEvents"];
        break;
    }

    const csvContent = [
      headers.join(","),
      ...reportData.map((row) =>
        keys
          .map((k) => {
            const val = row[k];
            if (typeof val === "string" && val.includes(",")) {
              return `"${val}"`;
            }
            return val !== undefined && val !== null ? val : "";
          })
          .join(",")
      ),
    ].join("\r\n");

    const mime = excelMode ? "application/vnd.ms-excel" : "text/csv;charset=utf-8;";
    const ext = excelMode ? "xls" : "csv";

    const blob = new Blob([csvContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${reportType}_report_${getMonthName(month)}_${year}.${ext}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Render Table Columns dynamically based on selected Report Type
  const renderReportTableHeaders = () => {
    switch (reportType) {
      case "attendance":
        return (
          <>
            <th className="p-4">Staff Member</th>
            <th className="p-4">Present Days</th>
            <th className="p-4">Late Days</th>
            <th className="p-4 text-rose-500">Absent Days</th>
            <th className="p-4">Half Days</th>
            <th className="p-4">Leave Days</th>
            <th className="p-4 font-bold text-primary">Attendance Rate</th>
          </>
        );
      case "leave":
        return (
          <>
            <th className="p-4">Staff Member</th>
            <th className="p-4">Designation (ID)</th>
            <th className="p-4">CL Allocated/Used</th>
            <th className="p-4">SL Allocated/Used</th>
            <th className="p-4">EL Allocated/Used</th>
            <th className="p-4 text-center">Pending Requests</th>
          </>
        );
      case "payroll":
        return (
          <>
            <th className="p-4">Staff Member</th>
            <th className="p-4">Basic Salary</th>
            <th className="p-4">Allowances</th>
            <th className="p-4 text-muted-foreground">PF Deduct</th>
            <th className="p-4 text-muted-foreground">Prof Tax</th>
            <th className="p-4 text-rose-500">Attendance Penalty</th>
            <th className="p-4 text-rose-500">Other Deductions</th>
            <th className="p-4 font-extrabold text-primary">Net Salary Paid</th>
          </>
        );
      case "department":
        return (
          <>
            <th className="p-4">Department</th>
            <th className="p-4">Shift Schedule</th>
            <th className="p-4 text-center">Staff Count</th>
            <th className="p-4 text-right font-bold text-primary">Monthly Attendance %</th>
          </>
        );
      case "academicYear":
        return (
          <>
            <th className="p-4">Academic Period</th>
            <th className="p-4">Start Date</th>
            <th className="p-4">End Date</th>
            <th className="p-4 text-center">School Holidays</th>
            <th className="p-4 text-center">School Events</th>
          </>
        );
    }
  };

  const renderReportTableRows = () => {
    if (!reportData) return null;

    return reportData.map((row, idx) => {
      switch (reportType) {
        case "attendance":
          return (
            <tr key={idx} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="p-4 font-bold text-foreground">{row.staffName}</td>
              <td className="p-4 font-semibold text-muted-foreground">{row.presentDays} days</td>
              <td className="p-4 font-semibold text-muted-foreground">{row.lateDays} days</td>
              <td className="p-4 font-semibold text-rose-600 font-bold">{row.absentDays} days</td>
              <td className="p-4 font-semibold text-muted-foreground">{row.halfDays} days</td>
              <td className="p-4 font-semibold text-muted-foreground">{row.leaveDays} days</td>
              <td className="p-4 font-mono font-bold text-primary">{row.rate}%</td>
            </tr>
          );
        case "leave":
          return (
            <tr key={idx} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="p-4 font-bold text-foreground">{row.staffName}</td>
              <td className="p-4 text-muted-foreground font-semibold">
                {row.designation} ({row.employeeId})
              </td>
              <td className="p-4 font-semibold text-muted-foreground font-mono">
                {row.casualAllocated} / {row.casualUsed}
              </td>
              <td className="p-4 font-semibold text-muted-foreground font-mono">
                {row.sickAllocated} / {row.sickUsed}
              </td>
              <td className="p-4 font-semibold text-muted-foreground font-mono">
                {row.earnedAllocated} / {row.earnedUsed}
              </td>
              <td className="p-4 text-center font-bold text-foreground">
                <span
                  className={`px-2 py-0.5 rounded-md ${
                    row.pendingRequests > 0 ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground"
                  }`}
                >
                  {row.pendingRequests} pending
                </span>
              </td>
            </tr>
          );
        case "payroll":
          return (
            <tr key={idx} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="p-4">
                <p className="font-bold text-foreground">{row.staffName}</p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  ID: {row.employeeId}
                </p>
              </td>
              <td className="p-4 font-mono text-muted-foreground">₹{row.basicSalary.toFixed(2)}</td>
              <td className="p-4 font-mono text-muted-foreground">₹{row.allowances.toFixed(2)}</td>
              <td className="p-4 font-mono text-muted-foreground">₹{row.pfDeduction.toFixed(2)}</td>
              <td className="p-4 font-mono text-muted-foreground">₹{row.taxDeduction.toFixed(2)}</td>
              <td className="p-4 font-mono text-rose-600 font-semibold">₹{row.attendanceDeduction.toFixed(2)}</td>
              <td className="p-4 font-mono text-rose-600 font-semibold">₹{row.otherDeductions.toFixed(2)}</td>
              <td className="p-4 font-mono font-extrabold text-foreground text-sm">₹{row.netSalary.toFixed(2)}</td>
            </tr>
          );
        case "department":
          return (
            <tr key={idx} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="p-4 font-bold text-foreground">{row.name}</td>
              <td className="p-4 text-muted-foreground font-semibold">
                {row.startTime} - {row.endTime}
              </td>
              <td className="p-4 text-center text-muted-foreground font-bold">{row.staffCount} staff</td>
              <td className="p-4 text-right font-mono font-bold text-primary">{row.avgAttendance}%</td>
            </tr>
          );
        case "academicYear":
          return (
            <tr key={idx} className="border-b border-border hover:bg-muted/10 transition-colors">
              <td className="p-4 font-bold text-foreground">{row.name}</td>
              <td className="p-4 font-semibold text-muted-foreground">{row.startDate}</td>
              <td className="p-4 font-semibold text-muted-foreground">{row.endDate}</td>
              <td className="p-4 text-center font-bold text-foreground">{row.totalHolidays} holidays</td>
              <td className="p-4 text-center font-bold text-foreground">{row.totalEvents} events</td>
            </tr>
          );
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-reports-section,
          #print-reports-section * {
            visibility: visible !important;
          }
          #print-reports-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            padding: 20px !important;
          }
          .screen-only {
            display: none !important;
          }
        }
      `}</style>

      {/* Header section (Screen Only) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-xs screen-only">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-foreground font-sans flex items-center gap-2">
            <FileText className="w-5.5 h-5.5 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">
            Track average school attendance, review leave statements, audit monthly payroll, and export data sheets.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex border border-border rounded-xl bg-background p-0.5 text-xs font-bold w-full md:w-auto">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === "analytics"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Analytics Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab("reports");
              setErrorMsg(null);
            }}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg cursor-pointer transition-colors ${
              activeTab === "reports"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Report Generators
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ANALYTICS DASHBOARD                              */}
      {/* ======================================================== */}
      {activeTab === "analytics" && (
        <div className="space-y-6 screen-only">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Avg Attendance Rate
                </span>
                <span className="text-xl font-extrabold text-foreground block font-mono">
                  {initialAnalytics.avgAttendanceRate}%
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Logs Generated (This Month)
                </span>
                <span className="text-xl font-extrabold text-foreground block font-mono">
                  {initialAnalytics.totalLogs} logs
                </span>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Late Arrivals (This Month)
                </span>
                <span className="text-xl font-extrabold text-foreground block font-mono text-rose-600">
                  {initialAnalytics.lateCount} lates
                </span>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 30-Day Trend Area Chart (8 Columns) */}
            <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                30-Day Attendance Trend
              </h3>
              <div className="h-64 text-xs">
                {initialAnalytics.attendanceTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={initialAnalytics.attendanceTrend} margin={{ left: -20, right: 10, top: 10 }}>
                      <defs>
                        <linearGradient id="attendanceColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" tickLine={false} />
                      <YAxis domain={[40, 100]} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--background, #fff)",
                          border: "1px border var(--border)",
                          borderRadius: "12px",
                          fontWeight: "bold",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        name="Attendance Rate (%)"
                        stroke="var(--color-primary, #6366f1)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#attendanceColor)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No logs found in the last 30 days to chart trends.
                  </div>
                )}
              </div>
            </div>

            {/* Status Distribution Bar Chart (4 Columns) */}
            <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Status Distribution (Current Month)
              </h3>
              <div className="h-64 text-xs flex items-center justify-center">
                {initialAnalytics.totalLogs > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={initialAnalytics.statusDistribution} margin={{ left: -25, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="name" tickLine={false} />
                      <YAxis tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--background, #fff)",
                          border: "1px border var(--border)",
                          borderRadius: "12px",
                          fontWeight: "bold",
                        }}
                      />
                      <Bar dataKey="value" name="Logs Count" radius={[6, 6, 0, 0]}>
                        {initialAnalytics.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-muted-foreground">No monthly logs found.</span>
                )}
              </div>
            </div>
          </div>

          {/* Leaderboards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Punctual Leaderboard */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                Most Punctual Staff (Current Month)
              </h3>
              
              <div className="space-y-2.5">
                {initialAnalytics.mostPunctual.length > 0 ? (
                  initialAnalytics.mostPunctual.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/20 rounded-xl flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-sm text-emerald-600 w-5 text-center">#{idx + 1}</span>
                        <span className="font-bold text-foreground text-xs">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 text-xs">{item.rate}% rate</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-6">No data available.</p>
                )}
              </div>
            </div>

            {/* Absent Warning List */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                Most Absent Staff (Current Month)
              </h3>

              <div className="space-y-2.5">
                {initialAnalytics.mostAbsent.length > 0 ? (
                  initialAnalytics.mostAbsent.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/20 rounded-xl flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-sm text-rose-600 w-5 text-center">#{idx + 1}</span>
                        <span className="font-bold text-foreground text-xs">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-rose-600 text-xs">
                        {item.absentDays} {item.absentDays === 1 ? "day" : "days"} absent
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-6">
                    Zero absents logged this month! Excellent attendance.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: REPORTS WORKsheet GENERATOR                       */}
      {/* ======================================================== */}
      {activeTab === "reports" && (
        <div id="print-reports-section" className="space-y-6">
          
          {/* Query Filter Area (Screen Only) */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs screen-only space-y-4">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Query Settings
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Report Category
                </label>
                <select
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value as ReportType);
                    setReportData(null);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-xs text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="attendance">Attendance Summary</option>
                  <option value="leave">Leaves & Balances</option>
                  <option value="payroll">Monthly Payroll Register</option>
                  <option value="department">Departments Metrics</option>
                  <option value="academicYear">Academic Year Configuration</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Month Period
                </label>
                <select
                  value={month}
                  onChange={(e) => {
                    setMonth(Number(e.target.value));
                    setReportData(null);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-xs text-foreground focus:outline-hidden cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      {getMonthName(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 tracking-wider">
                  Year Period
                </label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    setReportData(null);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background text-xs text-foreground focus:outline-hidden cursor-pointer"
                >
                  {[
                    new Date().getFullYear() - 1,
                    new Date().getFullYear(),
                    new Date().getFullYear() + 1,
                  ].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2.5 border-t border-border">
              <button
                onClick={handleGenerateReport}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Generate Report
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-destructive/10 text-destructive border border-destructive/25 rounded-lg text-xs font-semibold flex items-center gap-2 screen-only">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Printable Report Header */}
          <div className="hidden print:flex items-center justify-between pb-4 border-b-2 border-primary mb-6">
            <div>
              <h1 className="text-base font-black uppercase text-foreground">
                School Report Sheet
              </h1>
              <p className="text-xs text-muted-foreground font-semibold">
                Category: {reportType.toUpperCase()} — Period: {getMonthName(month)} {year}
              </p>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>MPS Portal System Circular</p>
            </div>
          </div>

          {/* Reports Results Table Grid */}
          {reportData ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs space-y-4">
              
              {/* Header Actions (Screen Only) */}
              <div className="p-5 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 screen-only">
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Circular Sheets Summary ({reportData.length} entries)
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => handleExportData(false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-border hover:border-primary/50 bg-background text-[10px] font-bold rounded-lg text-foreground hover:text-primary transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={() => handleExportData(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-border hover:border-emerald-500/50 bg-background text-[10px] font-bold rounded-lg text-foreground hover:text-emerald-600 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg text-[10px] hover:bg-primary/95 transition-all shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print / PDF
                  </button>
                </div>
              </div>

              {/* Table Data list */}
              {reportData.length > 0 ? (
                <div className="overflow-x-auto p-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 font-bold text-muted-foreground uppercase text-[9px] tracking-wider">
                        {renderReportTableHeaders()}
                      </tr>
                    </thead>
                    <tbody>{renderReportTableRows()}</tbody>
                  </table>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-center p-6 text-muted-foreground font-semibold">
                  No records exist for the selected period query.
                </div>
              )}
            </div>
          ) : (
            /* Helper Welcome (Screen Only) */
            <div className="border border-dashed border-border rounded-2xl h-60 flex flex-col items-center justify-center text-center p-6 bg-card/20 screen-only">
              <FileText className="w-10 h-10 text-muted-foreground/45 mb-2.5 animate-pulse" />
              <p className="text-sm font-extrabold text-foreground">Generate School Report Sheets</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                Configure your category filters above and click "Generate Report" to compile school-wide data sheets.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
