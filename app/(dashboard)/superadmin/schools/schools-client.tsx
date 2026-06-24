"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { School, User, Mail, ShieldAlert, Key, Search, PlusCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { createSchoolAction, togglePrincipalStatusAction } from "@/app/actions/school-actions";

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

// Form Validation Schema
const createSchoolSchema = z.object({
  name: z.string().min(3, "School Name must be at least 3 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  principalEmail: z.string().email("Please enter a valid email address"),
  passwordTemp: z.string().min(6, "Password must be at least 6 characters"),
});

type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

interface SchoolClientProps {
  initialSchools: any[];
  search: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function SchoolManagementClient({
  initialSchools,
  search: initialSearch,
  currentPage,
  totalPages,
  totalCount,
}: SchoolClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchVal, setSearchVal] = useState(initialSearch);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSchoolInput>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { name: "", address: "", principalEmail: "", passwordTemp: "" },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/superadmin/schools?search=${encodeURIComponent(searchVal)}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/superadmin/schools?search=${encodeURIComponent(searchVal)}&page=${newPage}`);
  };

  const onSubmit = async (data: CreateSchoolInput) => {
    setErrorMsg(null);
    const result = await createSchoolAction(data);

    if (result.success) {
      setIsModalOpen(false);
      reset();
      router.refresh();
    } else {
      setErrorMsg(result.error || "Failed to create school.");
    }
  };

  const handleToggleStatus = (principalId: string, currentStatus: boolean) => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await togglePrincipalStatusAction(principalId, !currentStatus);
      if (result.success) {
        router.refresh();
      } else {
        setErrorMsg(result.error || "Failed to update status.");
      }
    });
  };

  return (
    <div className="space-y-6 select-none">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            School Register
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Register new school tenants and configure their administrative credentials.
          </p>
        </div>

        {/* Create School Modal Trigger */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer shadow-xs">
              <PlusCircle className="w-4 h-4" />
              Add School
            </button>
          } />
          <DialogContent className="max-w-md w-full bg-card border border-border rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Add New School Tenant</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Provision a new school tenant and register its Principal credentials.
              </DialogDescription>
            </DialogHeader>

            {errorMsg && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  School Name
                </label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    {...register("name")}
                    type="text"
                    placeholder="Grand Academy School"
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                </div>
                {errors.name && (
                  <span className="block text-xs text-destructive mt-1 font-medium">
                    {errors.name.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Address
                </label>
                <textarea
                  {...register("address")}
                  placeholder="123 Main St, New York, NY"
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 resize-none"
                />
                {errors.address && (
                  <span className="block text-xs text-destructive mt-1 font-medium">
                    {errors.address.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Principal Username (Email)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    {...register("principalEmail")}
                    type="email"
                    placeholder="principal@academy.edu"
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                </div>
                {errors.principalEmail && (
                  <span className="block text-xs text-destructive mt-1 font-medium">
                    {errors.principalEmail.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Temporary Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    {...register("passwordTemp")}
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                </div>
                {errors.passwordTemp && (
                  <span className="block text-xs text-destructive mt-1 font-medium">
                    {errors.passwordTemp.message}
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-accent text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search schools..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 border border-border rounded-lg bg-card text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60 shadow-2xs"
          />
        </form>
      </div>

      {/* School Register Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Principal Email</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead>Registered At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialSchools.length > 0 ? (
                initialSchools.map((school) => {
                  const principal = school.principals?.[0];
                  return (
                    <TableRow key={school.id}>
                      <TableCell className="font-semibold text-sm text-foreground">
                        {school.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {school.address || "No Address Provided"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {principal?.email || "No Principal Email"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {principal ? (
                            <button
                              onClick={() => handleToggleStatus(principal.id, !!principal.is_active)}
                              disabled={isPending}
                              className="group flex items-center gap-2.5 cursor-pointer focus:outline-hidden disabled:opacity-60"
                              aria-label={`Toggle school status to ${principal.is_active ? "Inactive" : "Active"}`}
                            >
                              {/* Toggle Track */}
                              <div
                                className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative ${
                                  principal.is_active
                                    ? "bg-emerald-500 dark:bg-emerald-600"
                                    : "bg-slate-300 dark:bg-slate-700"
                                }`}
                              >
                                {/* Toggle Thumb */}
                                <div
                                  className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                                    principal.is_active ? "translate-x-4.5" : "translate-x-0"
                                  }`}
                                >
                                  {isPending && (
                                    <span className="w-2.5 h-2.5 border-1.5 border-slate-500 border-t-transparent rounded-full animate-spin" />
                                  )}
                                </div>
                              </div>
                              {/* Toggle Label */}
                              <span
                                className={`text-xs font-semibold select-none transition-colors duration-200 ${
                                  principal.is_active
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {principal.is_active ? "Active" : "Inactive"}
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">
                              No Account
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(school.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-xs text-muted-foreground">
                    No school tenants registered yet. Click "Add School" to get started.
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

    </div>
  );
}
