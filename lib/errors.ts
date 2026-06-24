/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { logger } from "@/lib/logger";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export class AppError extends Error {
  public code: number;
  public details?: any;

  constructor(message: string, code: number = 500, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
  }
}

export class AuthError extends AppError {
  constructor(message: string = "Authentication required.") {
    super(message, 401);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = "Permission denied.") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests. Please try again later.", details?: any) {
    super(message, 429, details);
  }
}

export type ActionResponse<R> = R extends Record<string, any>
  ? R & { success: boolean; error?: string; code?: number; requestId?: string; details?: any }
  : { success: true; data: R } | { success: false; error: string; code?: number; requestId?: string; details?: any };

export function withErrorHandling<Args extends any[], R>(
  actionName: string,
  fn: (...args: Args) => Promise<R>
): (...args: Args) => Promise<ActionResponse<R>> {
  return async (...args: Args): Promise<ActionResponse<R>> => {
    const requestId = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    try {
      logger.info(`Starting server action: ${actionName}`, { requestId });

      // Run Rate Limiter
      let identifier = "127.0.0.1";
      let role = "anonymous";

      try {
        const headersList = await headers();
        identifier = headersList.get("x-forwarded-for")?.split(",")[0] || 
                     headersList.get("x-real-ip") || 
                     "127.0.0.1";
        
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          identifier = user.id;
          role = user.app_metadata?.role || user.user_metadata?.role || "staff";
        }
      } catch (e) {
        // Fallback for environment context where headers/cookies might be unavailable
      }

      const limitResult = rateLimit(identifier, role);
      if (!limitResult.success) {
        throw new RateLimitError("Too many requests. Please try again later.", {
          reset: limitResult.reset,
          limit: limitResult.limit,
        });
      }

      const result = await fn(...args);
      logger.info(`Successfully completed server action: ${actionName}`, { requestId });

      if (result && typeof result === "object") {
        return {
          ...result,
          success: true,
        } as any;
      }
      return { success: true, data: result } as any;
    } catch (error: any) {
      const isAppError = error instanceof AppError;
      const code = isAppError ? error.code : 500;
      const message = error?.message || "An unexpected error occurred.";
      const details = isAppError ? error.details : undefined;

      logger.error(`Error in server action: ${actionName}`, error, {
        requestId,
        code,
        details,
      });

      return {
        success: false,
        error: code === 500 ? "Internal Server Error" : message,
        code,
        requestId,
        details,
      } as any;
    }
  };
}
