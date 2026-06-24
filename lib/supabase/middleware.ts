import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not use user_metadata for critical authorization decisions!
  // In production, user.app_metadata.role should contain the role.
  // We check both for flexible dev sandbox / testing options.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Check if password change is forced
  const changePasswordRequired = user ? !!user.user_metadata?.must_change_password : false;

  // 1. Force password change redirect
  if (user && changePasswordRequired && path !== "/auth/change-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/change-password";
    return NextResponse.redirect(url);
  }

  // 2. Prevent landing on change-password if not required
  if (user && !changePasswordRequired && path === "/auth/change-password") {
    const userRole = user.app_metadata?.role || user.user_metadata?.role || "staff";
    const url = request.nextUrl.clone();
    url.pathname = `/${userRole}`;
    return NextResponse.redirect(url);
  }

  // 3. Redirect authenticated users away from auth pages to their respective dashboard
  if (user && !changePasswordRequired && path.startsWith("/auth")) {
    const userRole = user.app_metadata?.role || user.user_metadata?.role || "staff";
    const url = request.nextUrl.clone();
    url.pathname = `/${userRole}`;
    return NextResponse.redirect(url);
  }

  // 4. Protect dashboard pages from unauthenticated users
  const isProtectedPath =
    path.startsWith("/superadmin") ||
    path.startsWith("/principal") ||
    path.startsWith("/staff");

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // 5. Enforce granular role-based routing
  if (user && isProtectedPath) {
    const userRole = user.app_metadata?.role || user.user_metadata?.role || "staff";

    if (path.startsWith("/superadmin") && userRole !== "superadmin") {
      const url = request.nextUrl.clone();
      url.pathname = `/${userRole}`;
      return NextResponse.redirect(url);
    }
    if (path.startsWith("/principal") && userRole !== "principal") {
      const url = request.nextUrl.clone();
      url.pathname = `/${userRole}`;
      return NextResponse.redirect(url);
    }
    if (path.startsWith("/staff") && userRole !== "staff") {
      const url = request.nextUrl.clone();
      url.pathname = `/${userRole}`;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
