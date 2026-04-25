import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { nimChat } from "@/lib/nvidia/client";
import { checkAndUnlockAchievements } from "@/lib/achievements/system";
import { addFeedEntry } from "@/lib/feed/helpers";
import { createNotification } from "@/lib/notifications/helpers";
import { fetchRepoContent } from "@/lib/github/repo-content";
import type { UserProfile } from "@/types";

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

  // Always notify the user of the result
  createNotification({
    userId: user.id,
    type: "challenge_result",
    message: isCorrect
      ? `✓ Your submission for "${challenge.title}" is correct — well done!`
      : `✗ Your submission for "${challenge.title}" was incorrect. Try again!`,
    link: "tab:challenges",
  });

  return NextResponse.json({
    correct: isCorrect,
    feedback: aiFeedback,
    submissionId: savedSub?.id,
    unlocked: unlockedAchievements,
  });
}
