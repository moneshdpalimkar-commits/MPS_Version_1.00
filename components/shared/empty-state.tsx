import React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}

export function EmptyState({
  title = "No data found",
  description = "There are no records to display at this moment.",
  icon: Icon = FolderOpen,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/30 min-h-[300px]",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted/30 text-muted-foreground mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-lg text-foreground tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6 leading-normal">
        {description}
      </p>
      {action}
    </div>
  );
}
