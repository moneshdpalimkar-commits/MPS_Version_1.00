"use client";

import React, { useState } from "react";
import { AlertCircle, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  error?: Error | string;
  reset?: () => void;
  title?: string;
  message?: string;
}

export function ErrorState({
  error,
  reset,
  title = "Something went wrong",
  message = "An error occurred while loading this section of the portal.",
  className,
  ...props
}: ErrorStateProps) {
  const [showDetail, setShowDetail] = useState(false);
  const errorMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 border border-destructive/20 rounded-lg bg-destructive/5 text-center min-h-[300px]",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-lg text-foreground tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6 leading-normal">
        {message}
      </p>

      <div className="flex flex-col gap-3 items-center">
        {reset && (
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        )}

        {errorMessage && (
          <div className="w-full max-w-md">
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showDetail ? (
                <>
                  Hide technical details <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Show technical details <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {showDetail && (
              <pre className="mt-3 p-3 text-left text-xs bg-muted/50 rounded-md border border-border text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                {errorMessage}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
