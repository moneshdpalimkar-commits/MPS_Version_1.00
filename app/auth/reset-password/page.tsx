"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const resetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ResetInput = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ResetInput) => {
    setIsLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4 select-none">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-4 shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Reset Password
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px]">
            Enter your email address to receive a password reset link.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-primary/10 text-primary rounded-xl flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-primary" />
              <span className="font-semibold text-sm">Check your inbox</span>
              <p className="text-xs text-muted-foreground leading-normal max-w-xs mt-1">
                We have sent a secure password reset link to your email address.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="teacher@mps.edu"
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                />
              </div>
              {errors.email && (
                <span className="block text-xs text-destructive mt-1 font-medium">
                  {errors.email.message}
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
                "Send Reset Link"
              )}
            </button>

            <div className="text-center mt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
