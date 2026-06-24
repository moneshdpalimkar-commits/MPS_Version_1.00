"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  CalendarDays,
  FileText,
} from "lucide-react";

interface StaffCalendarClientProps {
  initialItems: any[];
}

export function StaffCalendarClient({ initialItems }: StaffCalendarClientProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [items] = useState<any[]>(initialItems);

  // Calendar Engine: Month Details
  const getMonthWeeks = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const weeks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = Array(7).fill(null);

    // Padding for previous month
    for (let i = 0; i < firstDayIndex; i++) {
      currentWeek[i] = null;
    }

    let colIndex = firstDayIndex;
    for (let day = 1; day <= totalDays; day++) {
      if (colIndex === 7) {
        weeks.push(currentWeek);
        currentWeek = Array(7).fill(null);
        colIndex = 0;
      }
      currentWeek[colIndex] = new Date(year, month, day);
      colIndex++;
    }

    if (colIndex > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  };

  // Calendar Engine: Week Details
  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day; // Adjust to Sunday
    startOfWeek.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Filter items matching a specific date YYYY-MM-DD
  const getItemsForDate = (date: Date) => {
    const dStr = getLocalDateString(date);
    const filtered = items.filter((item) => {
      if (item.type === "holiday") {
        return dStr >= item.startDate && dStr <= item.endDate;
      } else {
        return dStr === item.startDate; // Event date
      }
    });

    // Add virtual non-working day item for Sundays
    if (date.getDay() === 0) {
      filtered.push({
        id: `sunday-${dStr}`,
        type: "holiday",
        title: "Sunday (Non-working)",
        startDate: dStr,
        endDate: dStr,
        category: "holiday",
        description: "Weekly non-working day",
        isVirtual: true,
      });
    }

    return filtered;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "holiday":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "exam":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "sports":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "ptm":
        return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
      case "annual_day":
        return "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20";
      default: // meeting
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      setSelectedDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
      setSelectedDate(d);
    }
  };

  const selectedDayItems = getItemsForDate(selectedDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Calendar Grid (9 columns) */}
      <div className="lg:col-span-9 bg-card border border-border rounded-2xl p-5 shadow-xs space-y-5">
        
        {/* Calendar Header Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground font-sans">
              {currentDate.toLocaleString("default", { month: "long" })}{" "}
              {currentDate.getFullYear()}
            </h2>
            <div className="flex border border-border rounded-lg overflow-hidden bg-background">
              <button
                onClick={handlePrev}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  setCurrentDate(today);
                  setSelectedDate(today);
                }}
                className="px-3 py-1.5 text-[11px] font-bold uppercase hover:bg-muted text-muted-foreground hover:text-foreground border-x border-border cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Views Tabbing */}
          <div className="flex border border-border rounded-lg bg-background p-0.5 text-xs font-semibold">
            {(["month", "week", "day"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setViewMode(view)}
                className={`px-3 py-1 rounded-md capitalize cursor-pointer transition-colors ${
                  viewMode === view
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* MONTH VIEW GRID */}
        {viewMode === "month" && (
          <div className="space-y-1">
            {/* Weekdays row */}
            <div className="grid grid-cols-7 text-center font-bold text-xs text-muted-foreground uppercase border-b border-border pb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Dates grid */}
            <div className="grid grid-cols-7 gap-1.5 min-h-[360px]">
              {getMonthWeeks(currentDate).map((week, weekIdx) =>
                week.map((day, dayIdx) => {
                  if (!day) {
                    return <div key={`empty-${weekIdx}-${dayIdx}`} className="bg-muted/10 border border-transparent rounded-xl" />;
                  }

                  const isSelected =
                    getLocalDateString(day) === getLocalDateString(selectedDate);
                  const isToday =
                    getLocalDateString(day) === getLocalDateString(new Date());
                  const dayItems = getItemsForDate(day);
                  const isSunday = day.getDay() === 0;
 
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`h-16 p-1.5 border rounded-xl flex flex-col justify-between items-start transition-all hover:bg-muted/30 cursor-pointer text-left ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : isSunday
                          ? "border-rose-100 bg-rose-500/5 dark:bg-rose-950/10 dark:border-rose-950/20"
                          : "border-border bg-background"
                      }`}
                    >
                      <span
                        className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : isSelected
                            ? "text-primary"
                            : isSunday
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-foreground"
                        }`}
                      >
                        {day.getDate()}
                      </span>

                      {/* Item Badges */}
                      <div className="w-full flex gap-1 overflow-hidden">
                        {dayItems.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.type === "holiday" ? "bg-rose-500" : "bg-primary"
                            }`}
                            title={item.title}
                          />
                        ))}
                        {dayItems.length > 3 && (
                          <span className="text-[8px] text-muted-foreground font-bold">
                            +{dayItems.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* WEEK VIEW GRID */}
        {viewMode === "week" && (
          <div className="grid grid-cols-7 gap-3 min-h-[360px]">
            {getWeekDays(currentDate).map((day) => {
              const isSelected =
                getLocalDateString(day) === getLocalDateString(selectedDate);
              const isToday =
                getLocalDateString(day) === getLocalDateString(new Date());
              const dayItems = getItemsForDate(day);
              const isSunday = day.getDay() === 0;
 
              return (
                <div
                  key={day.toISOString()}
                  className={`border rounded-xl p-3 flex flex-col gap-3 min-h-[320px] transition-all bg-card ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : isSunday
                      ? "border-rose-100 bg-rose-500/5 dark:bg-rose-950/10 dark:border-rose-950/20"
                      : "border-border bg-background"
                  }`}
                >
                  <button
                    onClick={() => {
                      setCurrentDate(day);
                      setSelectedDate(day);
                    }}
                    className="w-full text-left cursor-pointer"
                  >
                    <span className={`block text-[10px] font-bold uppercase ${
                      isSunday ? "text-rose-500" : "text-muted-foreground"
                    }`}>
                      {day.toLocaleString("default", { weekday: "short" })}
                    </span>
                    <span
                      className={`text-sm font-extrabold w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : isSunday
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </button>

                  <hr className="border-border" />

                  {/* List items */}
                  <div className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedDate(day)}
                        className={`p-1.5 border rounded-lg text-[9px] font-bold leading-normal cursor-pointer hover:scale-[1.02] transition-transform ${getCategoryColor(
                          item.category
                        )}`}
                      >
                        <p className="truncate" title={item.title}>{item.title}</p>
                        {item.type === "event" && item.startTime && (
                          <span className="text-[8px] opacity-70 font-mono block mt-0.5">
                            {item.startTime}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* DAY VIEW LISTING */}
        {viewMode === "day" && (
          <div className="space-y-4 min-h-[320px] bg-muted/10 p-4 rounded-xl border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                {selectedDate.toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <hr className="border-border" />

            {selectedDayItems.length > 0 ? (
              <div className="space-y-3">
                {selectedDayItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 border rounded-xl flex items-center justify-between gap-4 shadow-2xs ${getCategoryColor(
                      item.category
                    )}`}
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider block">
                        {getLeaveTypeLabel(item.category)}
                      </span>
                      <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>

                      {item.type === "event" && (
                        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground font-semibold pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {item.startTime} - {item.endTime}
                          </span>
                          <span className="flex items-center gap-1 uppercase">
                            <Users className="w-3.5 h-3.5" />
                            Audience: {item.audience} {item.departmentName ? `(${item.departmentName})` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Clock className="w-8 h-8 text-muted-foreground/50 mb-2 animate-pulse" />
                <p className="text-xs font-semibold">No school events or holidays scheduled for this date.</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Selected Day Inspector Sidebar (3 columns) */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* Selected date display */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Selected Date
            </span>
            <span className="text-xl font-extrabold text-foreground block mt-1">
              {selectedDate.toLocaleDateString([], {
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Selected Day Inspector */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Timeline ({selectedDayItems.length} items)
          </h3>

          <div className="space-y-3 max-h-[360px] overflow-y-auto no-scrollbar">
            {selectedDayItems.length > 0 ? (
              selectedDayItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-muted/40 border border-border rounded-xl flex items-start justify-between gap-2 hover:border-primary/30 transition-all"
                >
                  <div className="space-y-1 min-w-0">
                    <span className="text-[9px] font-bold text-primary uppercase block">
                      {getLeaveTypeLabel(item.category)}
                    </span>
                    <h4 className="text-xs font-bold text-foreground truncate">{item.title}</h4>
                    {item.type === "event" && (
                      <span className="text-[9px] font-mono text-muted-foreground block">
                        {item.startTime} - {item.endTime}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground font-semibold italic text-center py-6">
                No events scheduled.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function getLeaveTypeLabel(category: string) {
  switch (category) {
    case "holiday":
      return "School Holiday";
    case "exam":
      return "Academic Exam";
    case "sports":
      return "Sports / Athletics";
    case "ptm":
      return "PTM (Parent Teacher Meet)";
    case "annual_day":
      return "Annual Function";
    default:
      return "Meeting / Conference";
  }
}
