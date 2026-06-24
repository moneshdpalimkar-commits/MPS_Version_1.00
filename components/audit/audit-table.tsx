"use client";

import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  User, 
  Clock, 
  Database,
  Globe,
  Tag
} from "lucide-react";
import { AuditLogItem } from "@/app/actions/audit-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuditTableProps {
  items: AuditLogItem[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  attendance: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", label: "Attendance" },
  leave: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: "Leave" },
  payroll: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", label: "Payroll" },
  holiday: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", label: "Holidays" },
  announcement: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", label: "Announcements" },
  settings: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", label: "Settings" },
  system: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", label: "System" },
};

export function AuditTable({
  items,
  isLoading,
  page,
  totalPages,
  onPageChange,
}: AuditTableProps) {
  const [selectedItem, setSelectedItem] = useState<AuditLogItem | null>(null);

  const formatActionName = (action: string) => {
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full bg-card/65 backdrop-blur-md border border-border/60 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Source Table</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-muted rounded-sm w-32 mb-1" />
                      <div className="h-3 bg-muted rounded-sm w-48" />
                    </td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded-sm w-36" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-muted rounded-full w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded-sm w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded-sm w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded-sm w-28" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-8 bg-muted rounded-lg w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Database className="w-8 h-8 text-muted-foreground/50" />
                      <span className="font-medium text-base">No audit logs found</span>
                      <span className="text-xs max-w-sm">Try adjusting your filters, search criteria, or date range.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const catStyle = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.system;
                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-muted/20 transition-colors duration-150 group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase">
                            {item.userName.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              {item.userName}
                              {item.userRole && item.userRole !== "system" && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.25 rounded-md font-medium capitalize">
                                  {item.userRole}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-light">{item.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-foreground">
                          {formatActionName(item.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.75 rounded-full text-xs font-medium ${catStyle.bg} ${catStyle.text}`}>
                          <Tag className="w-3 h-3" />
                          {catStyle.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {item.tableName}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 opacity-60" />
                          <span>{item.ipAddress || "Internal"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-light">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 opacity-60" />
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 shadow-2xs group-hover:scale-102"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1 || isLoading}
                className="p-1.5 border border-border hover:bg-muted/80 rounded-lg text-muted-foreground disabled:opacity-50 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages || isLoading}
                className="p-1.5 border border-border hover:bg-muted/80 rounded-lg text-muted-foreground disabled:opacity-50 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <span>Audit Log Details</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-lg border border-border/40">
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold">User</span>
                  <span className="text-foreground font-medium">{selectedItem.userName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold">Action</span>
                  <span className="text-foreground font-medium font-mono">{selectedItem.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold">Table</span>
                  <span className="text-foreground font-medium font-mono">{selectedItem.tableName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold">Timestamp</span>
                  <span className="text-foreground font-medium">{formatDate(selectedItem.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold">IP Address</span>
                  <span className="text-foreground font-medium">{selectedItem.ipAddress || "Internal/Local"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-semibold">Category</span>
                  <span className="text-foreground font-medium capitalize">{selectedItem.category}</span>
                </div>
              </div>

              {selectedItem.newData && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">New Data Payload</h4>
                  <pre className="bg-neutral-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-neutral-800 shadow-inner max-h-[180px]">
                    {JSON.stringify(selectedItem.newData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedItem.oldData && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Previous Data Payload</h4>
                  <pre className="bg-neutral-900 text-amber-500 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-neutral-800 shadow-inner max-h-[180px]">
                    {JSON.stringify(selectedItem.oldData, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 border-t border-border/50 pt-3 flex justify-end">
              <Button onClick={() => setSelectedItem(null)} variant="outline">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
