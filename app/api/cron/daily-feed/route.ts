import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia/client";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Vercel Hobby plan max is 10s; upgrade to Pro to increase this to 60
export const maxDuration = 10;

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchHNStories(): Promise<string> {
  try {
    const ids = (await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json"
    ).then((r) => r.json())) as number[];

    const stories = await Promise.all(
      ids.slice(0, 10).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then((r) => r.json())
          .catch(() => null)
      )
    );

    return stories
      .filter(
        (s): s is { title: string; score: number } =>
          s?.title && typeof s.score === "number"
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((s) => `• ${s.title} (${s.score} pts)`)
      .join("\n");
  } catch {
    return "";
  }
}

async function fetchGitHubTrending(): Promise<string> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000)
      .toISOString()
      .split("T")[0];

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const res = await fetch(
      `https://api.github.com/search/repositories?q=stars:>500+pushed:>${sevenDaysAgo}&sort=stars&order=desc&per_page=5`,
      { headers }
    );
    const data = await res.json();

    return ((data.items ?? []) as Array<{
      full_name: string;
      description: string | null;
      stargazers_count: number;
      language: string | null;
    }>)
      .map(
        (r) =>
          `• ${r.full_name}${r.language ? ` [${r.language}]` : ""} — ${
            r.description ?? "no description"
          } (⭐ ${r.stargazers_count.toLocaleString()})`
      )
      .join("\n");
  } catch {
    return "";
  }
}

// ─── GET /api/cron/daily-feed ─────────────────────────────────────────────────
// Protected by DAILY_FEED_SECRET env var.
// Trigger manually: GET /api/cron/daily-feed?secret=<DAILY_FEED_SECRET>
// Or via any HTTP cron service (cron-job.org, easycron, etc.)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.DAILY_FEED_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch live data in parallel
    const [hnDigest, ghTrending] = await Promise.all([
      fetchHNStories(),
      fetchGitHubTrending(),
    ]);

    if (!hnDigest && !ghTrending) {
      return NextResponse.json(
        { error: "Could not fetch any source data" },
        { status: 502 }
      );
    }

    // 2. Generate posts using NVIDIA NIM
    const raw = await nimChat(
      `You are the community manager for DevMatch — a developer social platform that connects developers based on their GitHub profiles, coding styles, and tech passions.
Write feed posts that feel like they come from a fellow developer: insightful, authentic, conversational. Reference the actual news or repos. Never sound corporate or salesy.
Always respond with valid JSON only. No markdown fences, no extra text.`,
      `Today's top Hacker News stories:
${hnDigest || "(unavailable)"}

Trending GitHub repositories this week:
${ghTrending || "(unavailable)"}

Generate exactly 2 DevMatch feed posts that developers will find genuinely interesting. Pick the most compelling items above.

Return a JSON array:
[
  {
    "title": "catchy title under 60 chars",
    "content": "2-4 sentences. Reference specific items above. Developer tone. Emojis sparingly.",
    "topic": "one of: tech-news | open-source | github-trends | ai-dev | web-dev | devops"
  }
]`,
      800
    );

    let posts: { title: string; content: string; topic: string }[];
    try {
      posts = JSON.parse(raw);
      if (!Array.isArray(posts) || posts.length === 0)
        throw new Error("not an array");
    } catch {
      return NextResponse.json(
        { error: "NIM returned invalid JSON", raw },
        { status: 502 }
      );
    }

    // 3. Look up the primary admin as actor
    const adminUsernames = (process.env.ADMIN_GITHUB_USERNAMES ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    if (adminUsernames.length === 0) {
      return NextResponse.json(
        { error: "ADMIN_GITHUB_USERNAMES not configured" },
        { status: 500 }
      );
    }

    const service = createServiceClient();
    const { data: adminProfile } = await service
      .from("user_profiles")
      .select("id, github_username")
      .ilike("github_username", adminUsernames[0])
      .single();

    if (!adminProfile) {
      return NextResponse.json(
        { error: `Admin user '${adminUsernames[0]}' not found in DB` },
        { status: 500 }
      );
    }

    // 4. Insert into activity_feed
    const now = new Date().toISOString();
    const inserts = posts.map((post) => ({
      actor_id: adminProfile.id,
      action_type: "admin_post",
      target_id: null,
      metadata: {
        title: post.title.slice(0, 120),
        content: post.content.slice(0, 800),
        topic: post.topic ?? "tech-news",
        admin_username: adminProfile.github_username,
        auto_generated: true,
        generated_at: now,
      },
    }));

    const { data: inserted, error: insertError } = await service
      .from("activity_feed")
      .insert(inserts)
      .select("id");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      postsCreated: inserted?.length ?? 0,
      titles: posts.map((p) => p.title),
    });
  } catch (e) {
    console.error("[daily-feed] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
