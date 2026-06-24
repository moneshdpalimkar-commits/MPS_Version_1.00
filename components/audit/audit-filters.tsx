"use client";

import React, { useState, useEffect } from "react";
import { Search, Calendar, RotateCcw, Filter } from "lucide-react";

interface AuditFiltersProps {
  onFilterChange: (filters: {
    category: string;
    startDate: string;
    endDate: string;
    search: string;
  }) => void;
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave Management" },
  { value: "payroll", label: "Payroll & Salary" },
  { value: "holiday", label: "Holidays & Events" },
  { value: "announcement", label: "Announcements" },
  { value: "settings", label: "System Settings" },
];

export function AuditFilters({ onFilterChange }: AuditFiltersProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ search, category, startDate, endDate });
    }, 400);

    return () => clearTimeout(timer);
  }, [search, category, startDate, endDate]);

  const handleReset = () => {
    setSearch("");
    setCategory("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="w-full bg-card/65 backdrop-blur-md border border-border/60 rounded-xl p-5 shadow-xs flex flex-col gap-4 transition-all duration-200">
      <div className="flex items-center gap-2 text-foreground font-semibold text-sm tracking-wide uppercase border-b border-border/40 pb-2.5">
        <Filter className="w-4 h-4 text-primary" />
        <span>Filter Audit Logs</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search user, email, action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border/80 rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
            From Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-background border border-border/80 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
            To Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-background border border-border/80 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>

      {(search || category !== "all" || startDate || endDate) && (
        <div className="flex justify-end pt-1">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium rounded-lg transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        </div>
      )}
    </div>
  );
}
