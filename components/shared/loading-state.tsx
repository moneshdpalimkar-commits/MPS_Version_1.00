import React from "react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent text-primary",
        {
          "h-4 w-4 border-2": size === "sm",
          "h-8 w-8 border-2": size === "md",
          "h-12 w-12 border-3": size === "lg",
        },
        className
      )}
      {...props}
    />
  );
}

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "circle" | "rect" | "text";
}

export function Skeleton({
  variant = "rect",
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted/40",
        {
          "rounded-full": variant === "circle",
          "rounded-md": variant === "rect",
          "h-4 rounded-xs w-3/4": variant === "text",
        },
        className
      )}
      {...props}
    />
  );
}

export function LoadingPage() {
  return (
    <div className="flex h-full w-full items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">
          Loading portal data...
        </p>
      </div>
    </div>
  );
}
