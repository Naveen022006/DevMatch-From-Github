import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { nimChat } from "@/lib/nvidia/client";
import { checkAndUnlockAchievements } from "@/lib/achievements/system";
import { addFeedEntry } from "@/lib/feed/helpers";
import type { UserProfile } from "@/types";

// ── GitHub repo fetcher ───────────────────────────────────────────────────────

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\.git$/, "");
  // Full URL: https://github.com/owner/repo
  const full = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s]+)/);
  if (full) return { owner: full[1], repo: full[2] };
  // Short form: owner/repo
  const short = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (short) return { owner: short[1], repo: short[2] };
  return null;
}

export async function fetchRepoContent(
  repoUrl: string,
  ghToken?: string
): Promise<string> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error("Invalid GitHub URL. Use https://github.com/owner/repo");

  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {}),
  };

  const [repoRes, readmeRes, treeRes] = await Promise.allSettled([
    fetch(base, { headers }),
    fetch(`${base}/readme`, { headers }),
    fetch(`${base}/git/trees/HEAD?recursive=1`, { headers }),
  ]);

  let content = `Repository: ${owner}/${repo}\n`;

  // Repo metadata
  if (repoRes.status === "fulfilled" && repoRes.value.ok) {
    const d = await repoRes.value.json();
    if (d.message === "Not Found")
      throw new Error("Repository not found or is private. Make the repo public before submitting.");
    content += `Description: ${d.description ?? "none"}\n`;
    content += `Primary language: ${d.language ?? "unknown"}\n\n`;
  }

  // README
  if (readmeRes.status === "fulfilled" && readmeRes.value.ok) {
    const d = await readmeRes.value.json();
    const text = Buffer.from(d.content ?? "", "base64").toString("utf8");
    content += `README:\n${text.slice(0, 3000)}\n\n`;
  }

  // File tree + source files
  if (treeRes.status === "fulfilled" && treeRes.value.ok) {
    const d = await treeRes.value.json();
    const allFiles: Array<{ type: string; path: string }> = d.tree ?? [];

    const treePreview = allFiles
      .filter((f) => !f.path.includes("node_modules") && !f.path.includes(".git"))
      .map((f) => `  ${f.type === "tree" ? "📁" : "📄"} ${f.path}`)
      .slice(0, 30)
      .join("\n");
    content += `File structure:\n${treePreview}\n\n`;

    // Pick up to 6 key source files
    const sourceExts = /\.(js|ts|jsx|tsx|py|java|cpp|c|go|rs|rb|php|cs|swift|kt)$/;
    const sourceFiles = allFiles
      .filter(
        (f) =>
          f.type === "blob" &&
          sourceExts.test(f.path) &&
          !f.path.includes("node_modules") &&
          !f.path.includes(".min.") &&
          !f.path.includes("dist/") &&
          f.path.split("/").length <= 4
      )
      .slice(0, 6);

    for (const file of sourceFiles) {
      try {
        const r = await fetch(`${base}/contents/${encodeURIComponent(file.path)}`, { headers });
        if (r.ok) {
          const fd = await r.json();
          const text = Buffer.from(fd.content ?? "", "base64").toString("utf8");
          content += `--- ${file.path} ---\n${text.slice(0, 1500)}\n\n`;
        }
      } catch { /* skip */ }
    }
  }

  return content;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: challengeId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { repoUrl } = await request.json();
  if (!repoUrl?.trim())
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });

  const ghToken = request.cookies.get("gh_token")?.value;
  const service = createServiceClient();

  // Fetch challenge
  const { data: challenge, error: challengeError } = await service
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("is_active", true)
    .single();

  if (challengeError || !challenge)
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

  // Fetch user profile
  const { data: profile } = await service
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile)
    return NextResponse.json(
      { error: "Profile not found. Please analyze your GitHub first." },
      { status: 400 }
    );

  // ── Fetch repo content ────────────────────────────────────────────────────
  let repoContent: string;
  try {
    repoContent = await fetchRepoContent(repoUrl, ghToken);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read repository" },
      { status: 400 }
    );
  }

  // ── AI evaluation ─────────────────────────────────────────────────────────
  const systemPrompt = `You are a rigorous but fair code challenge evaluator.
You will receive a GitHub repository's content and must assess whether it correctly solves the given challenge.
Look at the README, source code, and file structure to make your judgment.
A submission is correct if it demonstrates a working, reasonable solution — not necessarily perfect.
Return ONLY valid JSON, no extra text.`;

  const userMessage = `Challenge: "${challenge.title}" (${challenge.difficulty})

Problem statement:
${challenge.description}

Repository content:
${repoContent.slice(0, 6000)}

Return JSON: { "correct": boolean, "feedback": string }
feedback: 3-4 sentences — what the repo does well, what matches/doesn't match the challenge, and overall verdict.`;

  let isCorrect = false;
  let aiFeedback = "";

  try {
    const raw = await nimChat(systemPrompt, userMessage, 600);
    let parsed: { correct: boolean; feedback: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*"correct"[\s\S]*"feedback"[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { correct: false, feedback: "Could not evaluate. Please try again." };
    }
    isCorrect = Boolean(parsed.correct);
    aiFeedback = parsed.feedback ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: `AI evaluation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  // ── Save submission ───────────────────────────────────────────────────────
  const { data: savedSub, error: subError } = await service
    .from("challenge_submissions")
    .upsert(
      {
        challenge_id: challengeId,
        user_id: user.id,
        repo_url: repoUrl.trim(),
        solution_text: repoUrl.trim(), // kept for backwards compat
        is_correct: isCorrect,
        ai_feedback: aiFeedback,
        admin_override: null, // reset override on resubmit
        admin_feedback: null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "challenge_id,user_id" }
    )
    .select()
    .single();

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

  // ── Award achievement if correct (or admin previously overrode to correct) ─
  let unlockedAchievements: unknown[] = [];
  if (isCorrect) {
    try {
      unlockedAchievements = await checkAndUnlockAchievements({
        userId: user.id,
        profile: profile as UserProfile,
        completedChallenge: true,
      });
    } catch { /* non-critical */ }

    // Emit challenge feed entry
    addFeedEntry({
      actorId: user.id,
      actionType: "challenge",
      metadata: { title: challenge.title, difficulty: challenge.difficulty },
    });
  }

  return NextResponse.json({
    correct: isCorrect,
    feedback: aiFeedback,
    submissionId: savedSub?.id,
    unlocked: unlockedAchievements,
  });
}
