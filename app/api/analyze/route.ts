import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { collectGitHubData } from "@/lib/github/client";
import { analyzeGitHubProfile } from "@/lib/github/analyzer";
import { addFeedEntry } from "@/lib/feed/helpers";

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

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

    // Parse body — may be empty for first-time analysis
    let force = false;
    try {
      const body = await request.json();
      force = body?.force === true;
    } catch { /* empty body is fine */ }

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

    // ── Cooldown check (force bypasses) ───────────────────────────────────────
    if (force) {
      const service = createServiceClient();
      const { data: existing } = await service
        .from("user_profiles")
        .select("analysis_cached_at")
        .eq("id", user.id)
        .single();

      if (existing?.analysis_cached_at) {
        const cachedAt = new Date(existing.analysis_cached_at).getTime();
        const remaining = COOLDOWN_MS - (Date.now() - cachedAt);
        if (remaining > 0) {
          return NextResponse.json(
            {
              error: "Analysis cooldown active. Please wait before refreshing.",
              cooldownUntil: new Date(cachedAt + COOLDOWN_MS).toISOString(),
            },
            { status: 429 }
          );
        }
      }
    }

    console.log("[analyze] starting for", githubUsername, force ? "(forced)" : "");

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

    // Check if this is a first-time profile creation (before analysis)
    const service = createServiceClient();
    const { data: existingProfile } = await service
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    const isFirstTime = !existingProfile;

    // Step 2 — AI analysis + cache in Supabase
    let profile;
    try {
      profile = await analyzeGitHubProfile(user.id, rawData, force);
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

    // Emit "joined" feed entry on first-time profile creation
    if (isFirstTime) {
      addFeedEntry({ actorId: user.id, actionType: "joined" });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
