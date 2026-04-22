import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<NonNullable<CookieMethodsServer["setAll"]>>[0]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — MUST call getUser() to keep session alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard routes
  const { pathname } = request.nextUrl;
  const protectedPaths = ["/dashboard", "/matches", "/profile", "/story", "/admin"];

  if (!user && protectedPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Protect admin routes — must be in ADMIN_GITHUB_USERNAMES
  if (pathname.startsWith("/admin")) {
    const username =
      user?.user_metadata?.user_name ??
      user?.user_metadata?.login ??
      "";
    const admins = (process.env.ADMIN_GITHUB_USERNAMES ?? "")
      .split(",")
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean);
    if (!admins.includes(username.toLowerCase())) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
