"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, ShieldAlert, Key, Mail, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Zod Schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginInput = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    }
  };

  const handleSandboxBypass = (role: "superadmin" | "principal" | "staff") => {
    router.push(`/${role}`);
  };

  return (
    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
      {/* Branding header */}
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center justify-center w-[220px] h-[220px] bg-transparent mb-3">
          <img src="/logo.png" alt="MPS Logo" className="w-full h-full object-contain drop-shadow-lg" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          MPS Staff Portal
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px]">
          Log in to manage attendance logs, request leaves, and review payroll sheets.
        </p>
      </div>

      {/* Display errors */}
      {errorMsg && (
        <div className="p-3 bg-destructive/15 text-destructive rounded-lg text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase">
              Password
            </label>
            <Link
              href="/auth/reset-password"
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Forgot?
            </Link>
          </div>
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Sandbox mode divider */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-border"></div>
        <span className="flex-shrink mx-3 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
          Sandbox Bypass
        </span>
        <div className="flex-grow border-t border-border"></div>
      </div>

      {/* Sandbox Quick Access Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleSandboxBypass("superadmin")}
          className="py-1.5 border border-border hover:bg-accent text-[11px] font-semibold rounded-md cursor-pointer transition-colors text-foreground text-center"
        >
          Superadmin
        </button>
        <button
          onClick={() => handleSandboxBypass("principal")}
          className="py-1.5 border border-border hover:bg-accent text-[11px] font-semibold rounded-md cursor-pointer transition-colors text-foreground text-center"
        >
          Principal
        </button>
        <button
          onClick={() => handleSandboxBypass("staff")}
          className="py-1.5 border border-border hover:bg-accent text-[11px] font-semibold rounded-md cursor-pointer transition-colors text-foreground text-center"
        >
          Staff
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4 select-none">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-6 md:p-8 flex flex-col items-center justify-center min-h-[350px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground mt-3 font-semibold">
              Loading authentication panel...
            </p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
