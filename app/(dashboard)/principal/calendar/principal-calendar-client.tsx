"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Users,
  Building,
  Flag,
  FileText,
  Import,
} from "lucide-react";
import {
  createEventAction,
  createHolidayAction,
  deleteEventAction,
  deleteHolidayAction,
  importIndianHolidaysAction,
} from "@/app/actions/calendar-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const holidaySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isHalfDay: z.boolean(),
  holidayType: z.enum(["indian", "custom"]),
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
  message: "End date must be greater than or equal to start date",
  path: ["endDate"],
});

type HolidayFormInput = z.infer<typeof holidaySchema>;

const eventSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  audience: z.enum(["all", "teaching", "non-teaching", "department"]),
  departmentId: z.string().optional(),
  category: z.enum(["exam", "sports", "meeting", "ptm", "annual_day"]),
}).refine((data) => {
  const [startH, startM] = data.startTime.split(":").map(Number);
  const [endH, endM] = data.endTime.split(":").map(Number);
  return startH * 60 + startM < endH * 60 + endM;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type EventFormInput = z.infer<typeof eventSchema>;

interface PrincipalCalendarClientProps {
  initialItems: any[];
  departments: any[];
}

export function PrincipalCalendarClient({
  initialItems,
  departments,
}: PrincipalCalendarClientProps) {
  const [isPending, startTransition] = useTransition();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [items, setItems] = useState<any[]>(initialItems);

  // Modals Open/Close States
  const [isHolidayOpen, setIsHolidayOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);

  // Status Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Hooks
  const holidayForm = useForm<HolidayFormInput>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
      isHalfDay: false,
      holidayType: "custom",
    },
  });

  const eventForm = useForm<EventFormInput>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: "",
      description: "",
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      audience: "all",
      departmentId: "",
      category: "meeting",
    },
  });

  // Fetch helper
  const handleImportIndianHolidays = () => {
    if (confirm("Import standard Indian public holidays for the current year? Existing duplicates will be skipped.")) {
      startTransition(async () => {
        const result = await importIndianHolidaysAction();
        if (result.success) {
          alert(`Successfully imported ${result.count} Indian holidays!`);
          window.location.reload();
        } else {
          alert(result.error || "Failed to import holidays.");
        }
      });
    }
  };

  const handleCreateHoliday = (data: HolidayFormInput) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await createHolidayAction({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isHalfDay: data.isHalfDay,
        holidayType: data.holidayType,
      });

      if (result.success) {
        setSuccessMsg("Holiday created and synced to attendance logs!");
        setTimeout(() => {
          setIsHolidayOpen(false);
          window.location.reload();
        }, 1500);
      } else {
        setErrorMsg(result.error || "Failed to create holiday.");
      }
    });
  };

  const handleCreateEvent = (data: EventFormInput) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await createEventAction({
        name: data.name,
        description: data.description,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        audience: data.audience,
        departmentId: data.departmentId || undefined,
        category: data.category,
      });

      if (result.success) {
        setSuccessMsg("School event scheduled successfully!");
        setTimeout(() => {
          setIsEventOpen(false);
          window.location.reload();
        }, 1500);
      } else {
        setErrorMsg(result.error || "Failed to create event.");
      }
    });
  };

  const handleDeleteItem = async (itemId: string, type: "event" | "holiday") => {
    if (confirm(`Are you sure you want to delete this ${type}? This action is irreversible.`)) {
      startTransition(async () => {
        const result =
          type === "event"
            ? await deleteEventAction(itemId)
            : await deleteHolidayAction(itemId);

        if (result.success) {
          // Remove from local list
          setItems((prev) => prev.filter((i) => i.id !== itemId));
          alert(`${type.toUpperCase()} deleted successfully.`);
        } else {
          alert(result.error || `Failed to delete ${type}.`);
        }
      });
    }
  };

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

  const openHolidayModal = () => {
    const dStr = getLocalDateString(selectedDate);
    holidayForm.reset({
      name: "",
      startDate: dStr,
      endDate: dStr,
      isHalfDay: false,
      holidayType: "custom",
    });
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsHolidayOpen(true);
  };

  const openEventModal = () => {
    eventForm.reset({
      name: "",
      description: "",
      date: getLocalDateString(selectedDate),
      startTime: "09:00",
      endTime: "10:00",
      audience: "all",
      departmentId: "",
      category: "meeting",
    });
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEventOpen(true);
  };

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

          {/* Views Tabbing & Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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

            <button
              onClick={handleImportIndianHolidays}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:border-primary/50 bg-background text-xs font-semibold text-foreground hover:text-primary transition-all cursor-pointer"
              title="Import Indian Public Holidays for Current Year"
            >
              <Import className="w-3.5 h-3.5" />
              Import Holidays
            </button>
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

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={openEventModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Event
            </button>
            <button
              onClick={openHolidayModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border hover:border-rose-500/30 rounded-lg hover:bg-rose-500/10 text-xs font-bold text-foreground hover:text-rose-600 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Holiday
            </button>
          </div>
        </div>

        {/* Selected Day Inspector */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Timeline ({selectedDayItems.length} items)
          </h3>

          <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
            {selectedDayItems.length > 0 ? (
              selectedDayItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-muted/40 border border-border rounded-xl flex items-start justify-between gap-2 group hover:border-primary/30 transition-all"
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
                  {item.isVirtual !== true && (
                    <button
                      onClick={() => handleDeleteItem(item.id, item.type)}
                      className="p-1 text-muted-foreground hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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

      {/* CREATE HOLIDAY MODAL */}
      <Dialog open={isHolidayOpen} onOpenChange={(open) => !open && setIsHolidayOpen(false)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Add School Holiday</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define holiday limits. Triggers automatic attendance updates for all active school staff.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={holidayForm.handleSubmit(handleCreateHoliday)} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Holiday Name
              </label>
              <input
                {...holidayForm.register("name")}
                type="text"
                placeholder="e.g. Summer Vacation, Diwali, Christmas"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
              />
              {holidayForm.formState.errors.name && (
                <span className="text-xs text-destructive mt-0.5 block">
                  {holidayForm.formState.errors.name.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Start Date
                </label>
                <input
                  {...holidayForm.register("startDate")}
                  type="date"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  End Date
                </label>
                <input
                  {...holidayForm.register("endDate")}
                  type="date"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
                {holidayForm.formState.errors.endDate && (
                  <span className="text-xs text-destructive mt-0.5 block">
                    {holidayForm.formState.errors.endDate.message}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input
                {...holidayForm.register("isHalfDay")}
                type="checkbox"
                id="isHalfDay"
                className="w-4 h-4 border border-border rounded bg-background focus:ring-primary text-primary"
              />
              <label htmlFor="isHalfDay" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                Is this holiday a Half Day?
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setIsHolidayOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add Holiday
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE EVENT MODAL */}
      <Dialog open={isEventOpen} onOpenChange={(open) => !open && setIsEventOpen(false)}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Schedule School Event</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define operational event settings, categories, timings, and targeted audiences.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-semibold mt-3 flex items-center gap-2">
              <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={eventForm.handleSubmit(handleCreateEvent)} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Event Name
                </label>
                <input
                  {...eventForm.register("name")}
                  type="text"
                  placeholder="e.g. Mid-term Exam, Annual Athletic Meet"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
                {eventForm.formState.errors.name && (
                  <span className="text-xs text-destructive mt-0.5 block">
                    {eventForm.formState.errors.name.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Category
                </label>
                <select
                  {...eventForm.register("category")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="exam">Exam</option>
                  <option value="sports">Sports</option>
                  <option value="meeting">Meeting / Conference</option>
                  <option value="ptm">PTM (Parent Teacher Meet)</option>
                  <option value="annual_day">Annual Day</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Date
                </label>
                <input
                  {...eventForm.register("date")}
                  type="date"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Start Time
                </label>
                <input
                  {...eventForm.register("startTime")}
                  type="time"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  End Time
                </label>
                <input
                  {...eventForm.register("endTime")}
                  type="time"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden"
                />
                {eventForm.formState.errors.endTime && (
                  <span className="text-xs text-destructive mt-0.5 block">
                    {eventForm.formState.errors.endTime.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Target Audience
                </label>
                <select
                  {...eventForm.register("audience")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All School Staff</option>
                  <option value="teaching">Teaching Staff only</option>
                  <option value="non-teaching">Non-teaching Staff only</option>
                  <option value="department">Specific Department</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Department (if applicable)
                </label>
                <select
                  {...eventForm.register("departmentId")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Description / Remarks
              </label>
              <textarea
                {...eventForm.register("description")}
                rows={3}
                placeholder="Brief description of the scheduled event..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-5">
              <button
                type="button"
                onClick={() => setIsEventOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add Event
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
