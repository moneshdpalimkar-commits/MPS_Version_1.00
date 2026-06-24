"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building,
  PlusCircle,
  Loader2,
  ShieldAlert,
  Edit2,
  Trash2,
  MapPin,
  Clock,
  Navigation,
} from "lucide-react";
import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "@/app/actions/department-actions";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Validation Schema using string inputs for HTML form compatibility
const departmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  description: z.string().optional().or(z.literal("")),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  gracePeriodMins: z.string()
    .min(1, "Grace period is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a non-negative number"),
  lateThresholdMins: z.string()
    .min(1, "Late threshold is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a non-negative number"),
  gpsLatitude: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= -90 && Number(val) <= 90), "Must be a valid latitude between -90 and 90"),
  gpsLongitude: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= -180 && Number(val) <= 180), "Must be a valid longitude between -180 and 180"),
  gpsRadiusMeters: z.string()
    .min(1, "Check-in radius is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 10, "Radius must be at least 10 meters"),
  attendanceWindowMins: z.string()
    .min(1, "Attendance window offset is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 5, "Window offset must be at least 5 minutes"),
});

type DepartmentFormInput = z.infer<typeof departmentSchema>;

interface DepartmentsClientProps {
  initialDepartments: any[];
  schoolId: string;
  defaultGpsRadius: number;
}

export function DepartmentsClient({
  initialDepartments,
  schoolId,
  defaultGpsRadius,
}: DepartmentsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [editingDept, setEditingDept] = useState<any>(null);
  const [deletingDept, setDeletingDept] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Form Hooks
  const addForm = useForm<DepartmentFormInput>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      description: "",
      startTime: "08:00",
      endTime: "14:00",
      gracePeriodMins: "15",
      lateThresholdMins: "30",
      gpsLatitude: "",
      gpsLongitude: "",
      gpsRadiusMeters: String(defaultGpsRadius),
      attendanceWindowMins: "120",
    },
  });

  const editForm = useForm<DepartmentFormInput>({
    resolver: zodResolver(departmentSchema),
  });

  const handleAddSubmit = async (data: DepartmentFormInput) => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await createDepartmentAction({
        schoolId,
        name: data.name,
        description: data.description || "",
        startTime: data.startTime,
        endTime: data.endTime,
        gracePeriodMins: Number(data.gracePeriodMins),
        lateThresholdMins: Number(data.lateThresholdMins),
        gpsLatitude: data.gpsLatitude ? Number(data.gpsLatitude) : undefined,
        gpsLongitude: data.gpsLongitude ? Number(data.gpsLongitude) : undefined,
        gpsRadiusMeters: Number(data.gpsRadiusMeters),
        attendanceWindowMins: Number(data.attendanceWindowMins),
      });

      if (result.success) {
        setIsAddModalOpen(false);
        addForm.reset();
        router.refresh();
      } else {
        setErrorMsg(result.error || "Failed to create department.");
      }
    });
  };

  const handleEditClick = (dept: any) => {
    setEditingDept(dept);
    setErrorMsg(null);
    editForm.reset({
      name: dept.name || "",
      description: dept.description || "",
      // Trim seconds from time representation "08:00:00" -> "08:00"
      startTime: dept.start_time ? dept.start_time.substring(0, 5) : "08:00",
      endTime: dept.end_time ? dept.end_time.substring(0, 5) : "14:00",
      gracePeriodMins: String(dept.grace_period_mins ?? 15),
      lateThresholdMins: String(dept.late_threshold_mins ?? 30),
      gpsLatitude: dept.gps_latitude !== null && dept.gps_latitude !== undefined ? String(dept.gps_latitude) : "",
      gpsLongitude: dept.gps_longitude !== null && dept.gps_longitude !== undefined ? String(dept.gps_longitude) : "",
      gpsRadiusMeters: String(dept.gps_radius_meters ?? 150),
      attendanceWindowMins: String(dept.attendance_window_mins ?? 120),
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (data: DepartmentFormInput) => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await updateDepartmentAction({
        id: editingDept.id,
        name: data.name,
        description: data.description || "",
        startTime: data.startTime,
        endTime: data.endTime,
        gracePeriodMins: Number(data.gracePeriodMins),
        lateThresholdMins: Number(data.lateThresholdMins),
        gpsLatitude: data.gpsLatitude ? Number(data.gpsLatitude) : undefined,
        gpsLongitude: data.gpsLongitude ? Number(data.gpsLongitude) : undefined,
        gpsRadiusMeters: Number(data.gpsRadiusMeters),
        attendanceWindowMins: Number(data.attendanceWindowMins),
      });

      if (result.success) {
        setIsEditModalOpen(false);
        router.refresh();
      } else {
        setErrorMsg(result.error || "Failed to update department settings.");
      }
    });
  };

  const handleDeleteClick = (dept: any) => {
    setDeletingDept(dept);
    setErrorMsg(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDept) return;
    setErrorMsg(null);
    startTransition(async () => {
      const result = await deleteDepartmentAction(deletingDept.id);
      if (result.success) {
        setIsDeleteModalOpen(false);
        setDeletingDept(null);
        router.refresh();
      } else {
        setErrorMsg(result.error || "Failed to delete department.");
      }
    });
  };

  // Fetch coordinates from browser Geolocation API
  const handleFetchLocation = (type: "add" | "edit") => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        
        if (type === "add") {
          addForm.setValue("gpsLatitude", lat);
          addForm.setValue("gpsLongitude", lng);
        } else {
          editForm.setValue("gpsLatitude", lat);
          editForm.setValue("gpsLongitude", lng);
        }
      },
      (error) => {
        setIsLocating(false);
        alert(`Failed to retrieve location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building className="w-6 h-6 text-primary" />
            Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure department parameters, timings, late policies, and geofencing coordinates.
          </p>
        </div>

        {/* Add Department Dialog */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger
            render={
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer shadow-xs">
                <PlusCircle className="w-4 h-4" />
                Create Department
              </button>
            }
          />
          <DialogContent className="max-w-xl w-full bg-card border border-border rounded-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Create New Department
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure basic details, check-in timings, grace limits, and geolocation radius.
              </DialogDescription>
            </DialogHeader>

            {errorMsg && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form
              onSubmit={addForm.handleSubmit(handleAddSubmit)}
              className="space-y-5"
            >
              {/* Basic Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Department Name
                    </label>
                    <input
                      {...addForm.register("name")}
                      placeholder="Science Department"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                    {addForm.formState.errors.name && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.name.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Description
                    </label>
                    <input
                      {...addForm.register("description")}
                      placeholder="Faculty and staff for science courses"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Working Hours & Grace Limits */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                  Shift Schedule & Limits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Shift Start Time
                    </label>
                    <input
                      {...addForm.register("startTime")}
                      type="time"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                    />
                    {addForm.formState.errors.startTime && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.startTime.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Shift End Time
                    </label>
                    <input
                      {...addForm.register("endTime")}
                      type="time"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                    />
                    {addForm.formState.errors.endTime && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.endTime.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Grace Period (Minutes)
                    </label>
                    <input
                      {...addForm.register("gracePeriodMins")}
                      type="text"
                      placeholder="15"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                    {addForm.formState.errors.gracePeriodMins && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.gracePeriodMins.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Late Threshold (Minutes)
                    </label>
                    <input
                      {...addForm.register("lateThresholdMins")}
                      type="text"
                      placeholder="30"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                    {addForm.formState.errors.lateThresholdMins && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.lateThresholdMins.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Attendance Window Offset (Minutes)
                    </label>
                    <input
                      {...addForm.register("attendanceWindowMins")}
                      type="text"
                      placeholder="120"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                    {addForm.formState.errors.attendanceWindowMins && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.attendanceWindowMins.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              {/* Geofencing Config */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                    Geofencing Settings (Optional)
                  </h3>
                  <button
                    type="button"
                    disabled={isLocating}
                    onClick={() => handleFetchLocation("add")}
                    className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isLocating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    Use Current Location
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      GPS Latitude
                    </label>
                    <input
                      {...addForm.register("gpsLatitude")}
                      type="text"
                      placeholder="e.g. 37.7749"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                    {addForm.formState.errors.gpsLatitude && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.gpsLatitude.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      GPS Longitude
                    </label>
                    <input
                      {...addForm.register("gpsLongitude")}
                      type="text"
                      placeholder="e.g. -122.4194"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                    {addForm.formState.errors.gpsLongitude && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.gpsLongitude.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                      Check-in Radius (m)
                    </label>
                    <input
                      {...addForm.register("gpsRadiusMeters")}
                      type="text"
                      placeholder="150"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                    />
                    {addForm.formState.errors.gpsRadiusMeters && (
                      <span className="text-xs text-destructive mt-0.5 block">
                        {addForm.formState.errors.gpsRadiusMeters.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register Department
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Departments Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Shift Timings</TableHead>
                <TableHead>Grace / Late Limits</TableHead>
                <TableHead>Geofence Details</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialDepartments.length > 0 ? (
                initialDepartments.map((dept) => {
                  const hasGeofence =
                    dept.gps_latitude !== null && dept.gps_longitude !== null;
                  return (
                    <TableRow key={dept.id}>
                      <TableCell className="font-semibold text-sm text-foreground">
                        {dept.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {dept.description || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-mono">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {dept.start_time.substring(0, 5)} - {dept.end_time.substring(0, 5)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>
                          Grace: <strong className="text-foreground">{dept.grace_period_mins} mins</strong>
                        </div>
                        <div>
                          Late limit: <strong className="text-foreground">{dept.late_threshold_mins} mins</strong>
                        </div>
                        <div>
                          Window offset: <strong className="text-foreground">±{dept.attendance_window_mins ?? 120} mins</strong>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {hasGeofence ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-foreground">
                              <MapPin className="w-3 h-3 text-primary" />
                              {Number(dept.gps_latitude).toFixed(4)},{" "}
                              {Number(dept.gps_longitude).toFixed(4)}
                            </span>
                            <span className="text-[10px]">
                              Radius: <strong>{dept.gps_radius_meters}m</strong>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">
                            No Geofencing
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleEditClick(dept)}
                            className="w-8 h-8 rounded-lg border border-border hover:bg-accent hover:text-foreground flex items-center justify-center text-muted-foreground transition-colors cursor-pointer"
                            title="Edit Settings"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteClick(dept)}
                            className="w-8 h-8 rounded-lg border border-border hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
                            title="Delete Department"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-40 text-center text-xs text-muted-foreground"
                  >
                    No departments created. Click "Create Department" to add one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Department Settings Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl w-full bg-card border border-border rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Edit Department Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify shift timings, grace parameters, and geofencing values.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form
            onSubmit={editForm.handleSubmit(handleEditSubmit)}
            className="space-y-5"
          >
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Department Name
                  </label>
                  <input
                    {...editForm.register("name")}
                    placeholder="Science Department"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  {editForm.formState.errors.name && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.name.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Description
                  </label>
                  <input
                    {...editForm.register("description")}
                    placeholder="Faculty and staff for science courses"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Timings & Grace Limits */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                Shift Schedule & Limits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Shift Start Time
                  </label>
                  <input
                    {...editForm.register("startTime")}
                    type="time"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                  />
                  {editForm.formState.errors.startTime && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.startTime.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Shift End Time
                  </label>
                  <input
                    {...editForm.register("endTime")}
                    type="time"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                  />
                  {editForm.formState.errors.endTime && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.endTime.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Grace Period (Minutes)
                  </label>
                  <input
                    {...editForm.register("gracePeriodMins")}
                    type="text"
                    placeholder="15"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  {editForm.formState.errors.gracePeriodMins && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.gracePeriodMins.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Late Threshold (Minutes)
                  </label>
                  <input
                    {...editForm.register("lateThresholdMins")}
                    type="text"
                    placeholder="30"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  {editForm.formState.errors.lateThresholdMins && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.lateThresholdMins.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Attendance Window Offset (Minutes)
                  </label>
                  <input
                    {...editForm.register("attendanceWindowMins")}
                    type="text"
                    placeholder="120"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  {editForm.formState.errors.attendanceWindowMins && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.attendanceWindowMins.message}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Geofencing Config */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                  Geofencing Settings (Optional)
                </h3>
                <button
                  type="button"
                  disabled={isLocating}
                  onClick={() => handleFetchLocation("edit")}
                  className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline cursor-pointer disabled:opacity-50"
                >
                  {isLocating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Navigation className="w-3 h-3" />
                  )}
                  Use Current Location
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    GPS Latitude
                  </label>
                  <input
                    {...editForm.register("gpsLatitude")}
                    type="text"
                    placeholder="e.g. 37.7749"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  {editForm.formState.errors.gpsLatitude && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.gpsLatitude.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    GPS Longitude
                  </label>
                  <input
                    {...editForm.register("gpsLongitude")}
                    type="text"
                    placeholder="e.g. -122.4194"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  {editForm.formState.errors.gpsLongitude && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.gpsLongitude.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Check-in Radius (m)
                  </label>
                  <input
                    {...editForm.register("gpsRadiusMeters")}
                    type="text"
                    placeholder="150"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  {editForm.formState.errors.gpsRadiusMeters && (
                    <span className="text-xs text-destructive mt-0.5 block">
                      {editForm.formState.errors.gpsRadiusMeters.message}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Delete Department
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete the department{" "}
              <strong className="text-foreground">
                "{deletingDept?.name}"
              </strong>
              ? This action cannot be undone. Staff members in this department
              will have their department assignment cleared.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold mt-3">
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-destructive text-destructive-foreground font-semibold rounded-lg text-sm hover:bg-destructive/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete Department
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
