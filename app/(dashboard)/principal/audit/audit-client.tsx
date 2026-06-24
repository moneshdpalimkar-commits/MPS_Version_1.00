"use client";

import React, { useState, useEffect, startTransition } from "react";
import { getAuditLogsAction, getAuditStatsAction, AuditLogItem } from "@/app/actions/audit-actions";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditTable } from "@/components/audit/audit-table";
import { AuditChart } from "@/components/audit/audit-chart";
import { 
  ShieldCheck, 
  Activity, 
  Users, 
  Zap,
  RotateCw
} from "lucide-react";

export function AuditClient() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [filters, setFilters] = useState({
    category: "all",
    startDate: "",
    endDate: "",
    search: "",
  });

  const [stats, setStats] = useState<{
    totalLogs: number;
    recentCount: number;
    categoryCounts: Record<string, number>;
    trendData: { date: string; count: number }[];
  }>({
    totalLogs: 0,
    recentCount: 0,
    categoryCounts: {},
    trendData: [],
  });

  const fetchStats = async () => {
    const res = await getAuditStatsAction();
    if (res.success) {
      setStats({
        totalLogs: res.totalLogs,
        recentCount: res.recentCount,
        categoryCounts: res.categoryCounts,
        trendData: res.trendData,
      });
    }
  };

  const fetchLogs = async (currentPage: number, activeFilters: typeof filters) => {
    setIsLoading(true);
    const res = await getAuditLogsAction({
      page: currentPage,
      limit: 10,
      ...activeFilters,
    });
    if (res.success) {
      setLogs(res.items);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    }
    setIsLoading(false);
  };

  const loadAllData = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchLogs(page, filters)]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1); // reset to page 1 on filter change
    fetchLogs(1, newFilters);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(newPage, filters);
  };

  const getTopModule = () => {
    if (Object.keys(stats.categoryCounts).length === 0) return "None";
    return Object.entries(stats.categoryCounts).sort((a, b) => b[1] - a[1])[0][0];
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            <span>Audit Logging System</span>
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            Track user actions, changes, and system modifications across all modules.
          </p>
        </div>

        <button
          onClick={loadAllData}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        {/* Card 1 */}
        <div className="bg-card/65 backdrop-blur-md border border-border/60 rounded-xl p-5 shadow-xs flex items-center gap-4 hover:shadow-sm transition-all duration-200">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Logs</span>
            <h4 className="text-xl font-bold text-foreground mt-0.5">
              {isLoading && stats.totalLogs === 0 ? "..." : stats.totalLogs}
            </h4>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-card/65 backdrop-blur-md border border-border/60 rounded-xl p-5 shadow-xs flex items-center gap-4 hover:shadow-sm transition-all duration-200">
          <div className="p-3 rounded-lg bg-orange-500/10 text-orange-500">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Last 24 Hours</span>
            <h4 className="text-xl font-bold text-foreground mt-0.5">
              {isLoading && stats.recentCount === 0 ? "..." : stats.recentCount}
            </h4>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-card/65 backdrop-blur-md border border-border/60 rounded-xl p-5 shadow-xs flex items-center gap-4 hover:shadow-sm transition-all duration-200">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Top Module</span>
            <h4 className="text-xl font-bold text-foreground mt-0.5 capitalize">
              {isLoading && stats.totalLogs === 0 ? "..." : getTopModule()}
            </h4>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-card/65 backdrop-blur-md border border-border/60 rounded-xl p-5 shadow-xs flex items-center gap-4 hover:shadow-sm transition-all duration-200">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Unique Actions</span>
            <h4 className="text-xl font-bold text-foreground mt-0.5">
              {isLoading ? "..." : totalCount}
            </h4>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <AuditChart trendData={stats.trendData} categoryCounts={stats.categoryCounts} />

      {/* Filter Section */}
      <AuditFilters onFilterChange={handleFilterChange} />

      {/* Table Section */}
      <AuditTable
        items={logs}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
