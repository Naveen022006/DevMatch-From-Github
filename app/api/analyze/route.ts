import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { collectGitHubData } from "@/lib/github/client";
import { analyzeGitHubProfile } from "@/lib/github/analyzer";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // provider_token is only in the initial session — after any token refresh
    // it disappears. Fall back to the gh_token cookie set in the auth callback.
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken =
      session?.provider_token ??
      request.cookies.get("gh_token")?.value;

    if (!providerToken) {
      return NextResponse.json(
        { error: "GitHub token not found. Please sign out and sign back in with GitHub." },
        { status: 400 }
      );
    }

    const githubUsername =
      user.user_metadata?.user_name ??
      user.user_metadata?.login ??
      user.user_metadata?.preferred_username;

    if (!githubUsername) {
      return NextResponse.json(
        { error: "GitHub username not found. Please re-authenticate." },
        { status: 400 }
      );
    }

    console.log("[analyze] starting for", githubUsername);

    // Step 1 — collect GitHub data
    let rawData;
    try {
      rawData = await collectGitHubData(githubUsername, providerToken);
      console.log("[analyze] github data collected, repos:", rawData.repos.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[analyze] github fetch failed:", msg);
      return NextResponse.json({ error: `GitHub fetch failed: ${msg}` }, { status: 500 });
    }

    // Step 2 — AI analysis + cache in Supabase
    let profile;
    try {
      profile = await analyzeGitHubProfile(user.id, rawData);
      console.log("[analyze] profile saved:", profile.coding_identity);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[analyze] profile analysis failed:", msg);

      if (msg.includes("404") || msg.includes("relation") || msg.includes("does not exist")) {
        return NextResponse.json(
          { error: "Database error — make sure you ran the SQL migration in Supabase." },
          { status: 500 }
        );
      }
      if (msg.includes("API key") || msg.includes("401") || msg.includes("403")) {
        return NextResponse.json(
          { error: "NVIDIA NIM API key is invalid or expired. Check your NVIDIA_NIM_API_KEY in .env." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: `AI analysis failed: ${msg}` }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
