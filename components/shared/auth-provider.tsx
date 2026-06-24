"use client";

import React, { createContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { UserRole, UserProfile } from "@/types/auth";
import { LoadingPage } from "@/components/shared/loading-state";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  mustChangePassword: boolean;
  isSuspended: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  mustChangePassword: false,
  isSuspended: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const fetchProfile = async (sessionUser: User) => {
    try {
      const userRole = (sessionUser.app_metadata?.role ||
        sessionUser.user_metadata?.role ||
        "staff") as UserRole;

      let fullName = sessionUser.user_metadata?.full_name || "School Employee";
      let schoolId = undefined;
      let departmentId = undefined;
      let accountSuspended = false;

      // Fetch database details based on role
      if (userRole === "principal") {
        const { data } = await supabase
          .from("principals")
          .select("full_name, school_id, is_active")
          .eq("id", sessionUser.id)
          .single();
        if (data) {
          fullName = data.full_name;
          schoolId = data.school_id;
          accountSuspended = !data.is_active;
        }
      } else if (userRole === "staff") {
        const { data } = await supabase
          .from("staff")
          .select("first_name, last_name, school_id, department_id, status")
          .eq("id", sessionUser.id)
          .single();
        if (data) {
          fullName = `${data.first_name} ${data.last_name}`;
          schoolId = data.school_id;
          departmentId = data.department_id;
          
          let principalIsActive = true;
          if (schoolId) {
            const { data: principalData } = await supabase
              .from("principals")
              .select("is_active")
              .eq("school_id", schoolId)
              .maybeSingle();
            if (principalData) {
              principalIsActive = principalData.is_active;
            }
          }
          accountSuspended = data.status !== "active" || !principalIsActive;
        }
      }

      const userProfile: UserProfile = {
        id: sessionUser.id,
        email: sessionUser.email!,
        role: userRole,
        fullName,
        schoolId,
        departmentId,
      };

      setProfile(userProfile);
      setRole(userRole);
      setIsSuspended(accountSuspended);
      
      // Check first login redirect claim
      const changePasswordRequired = !!sessionUser.user_metadata?.must_change_password;
      setMustChangePassword(changePasswordRequired);
    } catch (err) {
      console.error("Error fetching user profile from database:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setHasMounted(true);

    // Load initial session
    const getInitialSession = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user && isMounted) {
        setUser(session.user);
        await fetchProfile(session.user);
      } else if (isMounted) {
        // DEV Sandbox mode fallback:
        // Detect path role to mount mock user profiles for previewing dashboard UI without database setup
        const pathRole = pathname.split("/")[1];
        if (["superadmin", "principal", "staff"].includes(pathRole)) {
          const mockRole = pathRole as UserRole;
          setRole(mockRole);
          setProfile({
            id: "sandbox-id-12345",
            email: `${mockRole}@mps.edu`,
            role: mockRole,
            fullName: `Sandbox ${mockRole.charAt(0).toUpperCase() + mockRole.slice(1)}`,
          });
          setMustChangePassword(false);
          setIsSuspended(false);
        } else {
          setUser(null);
          setProfile(null);
          setRole(null);
          setIsSuspended(false);
        }
      }
      if (isMounted) setLoading(false);
    };

    getInitialSession();

    // Listen to Auth State Changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setMustChangePassword(false);
        setIsSuspended(false);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, supabase]);

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
    setMustChangePassword(false);
    setIsSuspended(false);
    setLoading(false);
    router.push("/auth/login");
  };

  // Determine overlay states
  const showLoading = !hasMounted || loading;
  const showSuspended = hasMounted && !loading && isSuspended && !pathname.startsWith("/auth");

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        mustChangePassword,
        isSuspended,
        logout,
      }}
    >
      {/* Render children unconditionally to maintain App Router hydration consistency */}
      <div className={showLoading || showSuspended ? "hidden" : "contents"}>
        {children}
      </div>

      {showLoading && <LoadingPage />}

      {showSuspended && (
        <div className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-xl dark:border-rose-950/30 dark:bg-slate-900/80 dark:backdrop-blur-md">
            <div className="bg-rose-50 px-6 py-8 text-center dark:bg-rose-950/20">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 animate-pulse">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-8 w-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Account Suspended
              </h2>
              <p className="mt-2 text-sm text-rose-700/80 dark:text-rose-400/80">
                Access to the portal has been disabled
              </p>
            </div>
            <div className="px-6 py-6 text-center">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {role === "principal"
                  ? "This school tenant has been suspended by the system administrator. All administration and staff access is currently disabled."
                  : "Your staff account has been deactivated or your school's tenant is suspended. Please contact your school administrator to restore access."}
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={logout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-hidden dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
