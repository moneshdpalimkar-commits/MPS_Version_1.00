"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, ShieldAlert, Key, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordInput = z.infer<typeof passwordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: PasswordInput) => {
    setIsLoading(true);
    setErrorMsg(null);

    // Update password
    const { error: passError } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (passError) {
      setErrorMsg(passError.message);
      setIsLoading(false);
      return;
    }

    // Update user metadata to clear must_change_password flag
    const { error: metaError } = await supabase.auth.updateUser({
      data: { must_change_password: false },
    });

    setIsLoading(false);

    if (metaError) {
      setErrorMsg(metaError.message);
    } else {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4 select-none">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
        
        {/* Branding Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center w-[220px] h-[220px] bg-transparent mb-3">
            <img src="/logo.png" alt="MPS Logo" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Update Your Password
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px]">
            For security reasons, you must update your temporary password before accessing the staff portal.
          </p>
        </div>

        {isSuccess ? (
          <div className="p-4 bg-primary/10 text-primary rounded-xl flex flex-col items-center gap-2 text-center animate-pulse">
            <CheckCircle2 className="w-8 h-8 text-primary" />
            <span className="font-semibold text-sm">Password Updated!</span>
            <p className="text-xs text-muted-foreground leading-normal max-w-xs mt-1">
              Your credentials have been securely updated. Redirecting to your dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                New Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                />
              </div>
              {errors.password && (
                <span className="block text-xs text-destructive mt-1 font-medium">
                  {errors.password.message}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  {...register("confirmPassword")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                />
              </div>
              {errors.confirmPassword && (
                <span className="block text-xs text-destructive mt-1 font-medium">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
