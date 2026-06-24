"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Search,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldAlert,
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  Edit2,
  Trash2,
  Power,
  Eye,
} from "lucide-react";
import {
  createStaffAction,
  updateStaffAction,
  deactivateStaffAction,
  archiveStaffAction,
} from "@/app/actions/staff-actions";

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

// Validation Schema
const staffSchema = z.object({
  employeeId: z.string().min(3, "Employee ID must be at least 3 characters"),
  firstName: z.string().min(2, "First Name must be at least 2 characters"),
  lastName: z.string().min(2, "Last Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone must be at least 8 digits"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  bloodGroup: z.string().min(1, "Please specify blood group"),
  emergencyContact: z.string().min(8, "Emergency contact must be at least 8 digits"),
  category: z.enum(["teaching", "non-teaching", "support"]),
  designation: z.string().min(2, "Designation must be at least 2 characters"),
  joiningDate: z.string().min(8, "Select a valid joining date"),
  passwordTemp: z.string().min(6, "Password must be at least 6 characters"),
  departmentId: z.string().optional(),
  fixedMonthlySalary: z.string()
    .min(1, "Fixed monthly salary is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a non-negative number"),
});

type StaffFormInput = z.infer<typeof staffSchema>;

interface StaffManagementClientProps {
  initialStaff: any[];
  departments: any[];
  schoolId: string;
  search: string;
  category: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function StaffManagementClient({
  initialStaff,
  departments,
  schoolId,
  search: initialSearch,
  category: initialCategory,
  currentPage,
  totalPages,
  totalCount,
}: StaffManagementClientProps) {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form Hooks
  const addForm = useForm<StaffFormInput>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      employeeId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      bloodGroup: "",
      emergencyContact: "",
      category: "teaching",
      designation: "",
      joiningDate: new Date().toISOString().split("T")[0],
      passwordTemp: "",
      departmentId: "",
      fixedMonthlySalary: "0",
    },
  });

  const editForm = useForm<Omit<StaffFormInput, "passwordTemp">>({
    resolver: zodResolver(staffSchema.omit({ passwordTemp: true })),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/principal/staff?search=${encodeURIComponent(searchVal)}&category=${categoryFilter}`
    );
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCategoryFilter(val);
    router.push(`/principal/staff?search=${encodeURIComponent(searchVal)}&category=${val}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(
      `/principal/staff?search=${encodeURIComponent(searchVal)}&category=${categoryFilter}&page=${newPage}`
    );
  };
  const handleAddSubmit = async (data: StaffFormInput) => {
    setErrorMsg(null);
    setIsLoading(true);
    const result = await createStaffAction({
      ...data,
      fixedMonthlySalary: Number(data.fixedMonthlySalary),
      schoolId,
    });
    setIsLoading(false);

    if (result.success) {
      setIsAddModalOpen(false);
      addForm.reset();
      router.refresh();
    } else {
      setErrorMsg(result.error || "Failed to create staff profile.");
    }
  };

  const handleEditClick = (staff: any) => {
    setEditingStaff(staff);
    editForm.reset({
      employeeId: staff.employee_id || "",
      firstName: staff.first_name || "",
      lastName: staff.last_name || "",
      email: staff.email || "",
      phone: staff.phone || "",
      address: staff.address || "",
      bloodGroup: staff.blood_group || "",
      emergencyContact: staff.emergency_contact || "",
      category: staff.staff_role || "teaching",
      designation: staff.designation || "",
      joiningDate: staff.join_date || "",
      departmentId: staff.department_id || "",
      fixedMonthlySalary: String(staff.fixed_monthly_salary ?? staff.base_salary ?? 0),
    });
    setIsEditModalOpen(true);
  };
  const handleEditSubmit = async (data: any) => {
    setErrorMsg(null);
    setIsLoading(true);
    const result = await updateStaffAction({
      ...data,
      fixedMonthlySalary: Number(data.fixedMonthlySalary),
      id: editingStaff.id,
    });
    setIsLoading(false);

    if (result.success) {
      setIsEditModalOpen(false);
      router.refresh();
    } else {
      setErrorMsg(result.error || "Failed to update profile.");
    }
  };

  const handleDeactivate = async (id: string, currentStatus: string) => {
    const targetStatus = currentStatus === "active" ? "inactive" : "active";
    if (confirm(`Are you sure you want to make this staff profile ${targetStatus}?`)) {
      const result = await deactivateStaffAction(id, targetStatus);
      if (result.success) router.refresh();
      else alert(result.error);
    }
  };

  const handleArchive = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to ARCHIVE this staff member? This will ban their sign-in indefinitely and hide their record."
      )
    ) {
      const result = await archiveStaffAction(id);
      if (result.success) router.refresh();
      else alert(result.error);
    }
  };

  return (
    <div className="space-y-6 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Staff Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your school's staff profiles, assign designations, and configure auth logins.
          </p>
        </div>

        {/* Add Staff Dialog */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger render={
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer shadow-xs">
              <PlusCircle className="w-4 h-4" />
              Add Staff
            </button>
          } />
          <DialogContent className="max-w-xl w-full bg-card border border-border rounded-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Register New Staff Profile</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Provision a new staff member credentials and create their database record.
              </DialogDescription>
            </DialogHeader>

            {errorMsg && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={addForm.handleSubmit(handleAddSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Employee ID</label>
                <input {...addForm.register("employeeId")} placeholder="EMP-2026-05" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.employeeId && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.employeeId.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">First Name</label>
                <input {...addForm.register("firstName")} placeholder="John" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.firstName && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.firstName.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Last Name</label>
                <input {...addForm.register("lastName")} placeholder="Doe" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.lastName && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.lastName.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Email Address</label>
                <input {...addForm.register("email")} type="email" placeholder="john.doe@school.edu" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.email && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.email.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Phone Number</label>
                <input {...addForm.register("phone")} placeholder="+1 (555) 019-2834" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.phone && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.phone.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Emergency Contact</label>
                <input {...addForm.register("emergencyContact")} placeholder="+1 (555) 092-2831" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.emergencyContact && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.emergencyContact.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Blood Group</label>
                <input {...addForm.register("bloodGroup")} placeholder="O+" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.bloodGroup && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.bloodGroup.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Category</label>
                <select {...addForm.register("category")} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer">
                  <option value="teaching">Teaching</option>
                  <option value="non-teaching">Non-Teaching</option>
                  <option value="support">Support Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Department</label>
                <select {...addForm.register("departmentId")} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer">
                  <option value="">No Department / General</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Designation</label>
                <input {...addForm.register("designation")} placeholder="Maths Teacher" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.designation && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.designation.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Joining Date</label>
                <input {...addForm.register("joiningDate")} type="date" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer" />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Temporary Password</label>
                <input {...addForm.register("passwordTemp")} type="password" placeholder="••••••••" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.passwordTemp && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.passwordTemp.message}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Fixed Monthly Salary ($)</label>
                <input {...addForm.register("fixedMonthlySalary")} type="text" placeholder="3000" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
                {addForm.formState.errors.fixedMonthlySalary && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.fixedMonthlySalary.message}</span>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Residential Address</label>
                <textarea {...addForm.register("address")} rows={2} placeholder="123 Academic Dr, Campus Town" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 resize-none" />
                {addForm.formState.errors.address && <span className="text-xs text-destructive mt-0.5 block">{addForm.formState.errors.address.message}</span>}
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={isLoading} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50">
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register Staff
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Category Filter Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 border border-border rounded-lg bg-card text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 shadow-2xs"
          />
        </form>

        <select
          value={categoryFilter}
          onChange={handleCategoryChange}
          className="w-full sm:w-48 px-3 py-2 border border-border rounded-lg bg-card text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer shadow-2xs"
        >
          <option value="all">All Categories</option>
          <option value="teaching">Teaching Staff</option>
          <option value="non-teaching">Non-Teaching Staff</option>
          <option value="support">Support Staff</option>
        </select>
      </div>

      {/* Staff Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role / Category</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialStaff.length > 0 ? (
                initialStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-semibold text-sm text-foreground">
                      {staff.first_name} {staff.last_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {staff.employee_id || "N/A"}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {staff.departments?.name || "General"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {staff.staff_role}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {staff.designation || "N/A"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {staff.email}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          staff.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {staff.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Profile Link */}
                        <Link href={`/principal/staff/${staff.id}`}>
                          <button
                            className="w-8 h-8 rounded-lg border border-border hover:bg-accent hover:text-foreground flex items-center justify-center text-muted-foreground transition-colors cursor-pointer"
                            title="View Profile Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleEditClick(staff)}
                          className="w-8 h-8 rounded-lg border border-border hover:bg-accent hover:text-foreground flex items-center justify-center text-muted-foreground transition-colors cursor-pointer"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Status Toggle (Deactivate/Activate) */}
                        <button
                          onClick={() => handleDeactivate(staff.id, staff.status)}
                          className={`w-8 h-8 rounded-lg border border-border hover:bg-accent flex items-center justify-center transition-colors cursor-pointer ${
                            staff.status === "active"
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-emerald-500 hover:text-emerald-600"
                          }`}
                          title={staff.status === "active" ? "Deactivate User" : "Activate User"}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        {/* Archive Button */}
                        <button
                          onClick={() => handleArchive(staff.id)}
                          className="w-8 h-8 rounded-lg border border-border hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
                          title="Archive Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center text-xs text-muted-foreground">
                    No active staff members registered in this school. Click "Add Staff" to register one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing page <strong className="font-semibold text-foreground">{currentPage}</strong> of{" "}
              <strong className="font-semibold text-foreground">{totalPages}</strong> ({totalCount} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Staff Dialog Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl w-full bg-card border border-border rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Edit Staff Profile</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify details for the selected staff member.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Employee ID</label>
              <input {...editForm.register("employeeId")} placeholder="EMP-2026-05" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.employeeId && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.employeeId.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">First Name</label>
              <input {...editForm.register("firstName")} placeholder="John" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.firstName && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.firstName.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Last Name</label>
              <input {...editForm.register("lastName")} placeholder="Doe" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.lastName && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.lastName.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Email Address (Read-only)</label>
              <input {...editForm.register("email")} type="email" readOnly className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-sm text-muted-foreground focus:outline-hidden opacity-70 cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Phone Number</label>
              <input {...editForm.register("phone")} placeholder="+1 (555) 019-2834" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.phone && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.phone.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Emergency Contact</label>
              <input {...editForm.register("emergencyContact")} placeholder="+1 (555) 092-2831" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.emergencyContact && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.emergencyContact.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Blood Group</label>
              <input {...editForm.register("bloodGroup")} placeholder="O+" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.bloodGroup && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.bloodGroup.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Category</label>
              <select {...editForm.register("category")} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer">
                <option value="teaching">Teaching</option>
                <option value="non-teaching">Non-Teaching</option>
                <option value="support">Support Staff</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Department</label>
              <select {...editForm.register("departmentId")} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer">
                <option value="">No Department / General</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Designation</label>
              <input {...editForm.register("designation")} placeholder="Maths Teacher" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.designation && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.designation.message}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Joining Date</label>
              <input {...editForm.register("joiningDate")} type="date" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer" />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Fixed Monthly Salary ($)</label>
              <input {...editForm.register("fixedMonthlySalary")} type="text" placeholder="3000" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60" />
              {editForm.formState.errors.fixedMonthlySalary && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.fixedMonthlySalary.message}</span>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Residential Address</label>
              <textarea {...editForm.register("address")} rows={2} placeholder="123 Academic Dr, Campus Town" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 resize-none" />
              {editForm.formState.errors.address && <span className="text-xs text-destructive mt-0.5 block">{editForm.formState.errors.address.message}</span>}
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-colors cursor-pointer">Cancel</button>
              <button type="submit" disabled={isLoading} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50">
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
