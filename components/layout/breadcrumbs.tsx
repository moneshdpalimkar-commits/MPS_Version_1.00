"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter((s) => s);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm font-medium">
      <ol className="flex items-center space-x-1.5 md:space-x-2">
        <li className="flex items-center">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          const label = segment
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <li key={href} className="flex items-center">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
              <Link
                href={href}
                className={cn(
                  "ml-1.5 md:ml-2 text-xs md:text-sm transition-colors",
                  isLast
                    ? "font-semibold text-foreground pointer-events-none"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
