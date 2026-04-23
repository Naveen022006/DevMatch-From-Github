/**
 * Daily Feed Auto-Poster
 * ---------------------
 * Fetches today's top Hacker News stories + trending GitHub repos,
 * generates 2 developer-focused posts using NVIDIA NIM,
 * and inserts them into the DevMatch activity_feed as admin_post entries.
 *
 * Usage:
 *   node scripts/daily-feed.mjs
 *
 * Schedule (Windows Task Scheduler):
 *   Action: node "C:\path\to\github friend app\scripts\daily-feed.mjs"
 *   Trigger: Daily at 9:00 AM
 *
 * Schedule (Linux/Mac crontab):
 *   0 9 * * * node /path/to/github\ friend\ app/scripts/daily-feed.mjs
 *
 * Requires Node.js 18+ (built-in fetch).
 * Reads env vars from .env.local automatically.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  // Try .env.local first, fall back to .env
  let envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    envPath = path.join(__dirname, "../.env");
  }
  if (!fs.existsSync(envPath)) {
    console.warn("⚠ No .env or .env.local found — relying on process.env");
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const NVIDIA_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_USERNAMES = (process.env.ADMIN_GITHUB_USERNAMES ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

if (!NVIDIA_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing required env vars: NVIDIA_NIM_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (ADMIN_USERNAMES.length === 0) {
  console.error("❌ ADMIN_GITHUB_USERNAMES not set");
  process.exit(1);
}

// ─── Fetch Hacker News ────────────────────────────────────────────────────────

async function fetchHNStories() {
  try {
    const ids = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json"
    ).then((r) => r.json());

    const stories = await Promise.all(
      ids.slice(0, 10).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then((r) => r.json())
          .catch(() => null)
      )
    );

    return stories
      .filter((s) => s?.title && typeof s.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((s) => `• ${s.title} (${s.score} pts)`)
      .join("\n");
  } catch (e) {
    console.warn("⚠ HN fetch failed:", e.message);
    return "";
  }
}

// ─── Fetch GitHub Trending ────────────────────────────────────────────────────

async function fetchGitHubTrending() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000)
      .toISOString()
      .split("T")[0];

    const res = await fetch(
      `https://api.github.com/search/repositories?q=stars:>500+pushed:>${sevenDaysAgo}&sort=stars&order=desc&per_page=5`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    const data = await res.json();

    return (data.items ?? [])
      .map(
        (r) =>
          `• ${r.full_name}${r.language ? ` [${r.language}]` : ""} — ${
            r.description ?? "no description"
          } (⭐ ${r.stargazers_count.toLocaleString()})`
      )
      .join("\n");
  } catch (e) {
    console.warn("⚠ GitHub fetch failed:", e.message);
    return "";
  }
}

// ─── Call NVIDIA NIM ──────────────────────────────────────────────────────────

async function generatePosts(hnDigest, ghTrending) {
  const systemPrompt = `You are the community manager for DevMatch — a developer social platform that connects developers based on their GitHub profiles, coding styles, and tech passions.
Write feed posts that feel like they come from a fellow developer: insightful, authentic, conversational. Reference the actual news or repos. Never sound corporate or salesy.
Always respond with valid JSON only. No markdown fences, no extra text.`;

  const userMessage = `Today's top Hacker News stories:
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
]`;

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const json = await res.json();
  const raw = (json.choices?.[0]?.message?.content ?? "")
    .replace(/```(?:json)?\n?/g, "")
    .trim();

  return JSON.parse(raw);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

async function supabaseInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase insert failed: ${err}`);
  }
  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🤖 DevMatch Daily Feed — ${new Date().toLocaleString()}\n`);

  // 1. Fetch sources
  console.log("📡 Fetching Hacker News + GitHub...");
  const [hnDigest, ghTrending] = await Promise.all([
    fetchHNStories(),
    fetchGitHubTrending(),
  ]);

  if (!hnDigest && !ghTrending) {
    console.error("❌ No source data available. Aborting.");
    process.exit(1);
  }

  if (hnDigest) console.log(`✓ HN: ${hnDigest.split("\n").length} stories`);
  if (ghTrending) console.log(`✓ GitHub: ${ghTrending.split("\n").length} repos`);

  // 2. Generate posts with NIM
  console.log("\n🧠 Generating posts with NVIDIA NIM...");
  let posts;
  try {
    posts = await generatePosts(hnDigest, ghTrending);
    if (!Array.isArray(posts) || posts.length === 0) throw new Error("empty array");
  } catch (e) {
    console.error("❌ NIM generation failed:", e.message);
    process.exit(1);
  }
  console.log(`✓ Generated ${posts.length} posts`);

  // 3. Find admin actor
  const adminUsername = ADMIN_USERNAMES[0];
  const profiles = await supabaseGet(
    `/user_profiles?github_username=ilike.${adminUsername}&select=id,github_username&limit=1`
  );

  if (!profiles?.[0]?.id) {
    console.error(`❌ Admin user '${adminUsername}' not found in DB`);
    process.exit(1);
  }
  const adminId = profiles[0].id;
  console.log(`✓ Acting as @${profiles[0].github_username}`);

  // 4. Insert into activity_feed
  const now = new Date().toISOString();
  const inserts = posts.map((post) => ({
    actor_id: adminId,
    action_type: "admin_post",
    target_id: null,
    metadata: {
      title: String(post.title).slice(0, 120),
      content: String(post.content).slice(0, 800),
      topic: post.topic ?? "tech-news",
      admin_username: adminUsername,
      auto_generated: true,
      generated_at: now,
    },
  }));

  console.log("\n📝 Publishing to feed...");
  const inserted = await supabaseInsert("activity_feed", inserts);
  console.log(`\n✅ Published ${inserted.length} posts:`);
  posts.forEach((p, i) => console.log(`  ${i + 1}. ${p.title}`));
  console.log();
}

main().catch((e) => {
  console.error("❌ Fatal error:", e);
  process.exit(1);
});
