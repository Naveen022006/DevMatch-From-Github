import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      // provider_token is only present in the initial session — it gets dropped
      // after every token refresh. Store it in a long-lived cookie so the
      // analyze route can always find it.
      if (data.session?.provider_token) {
        response.cookies.set("gh_token", data.session.provider_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
          sameSite: "lax",
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`);
}
