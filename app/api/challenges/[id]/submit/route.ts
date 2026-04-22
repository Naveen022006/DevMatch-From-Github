import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { nimChat } from "@/lib/nvidia/client";
import { checkAndUnlockAchievements } from "@/lib/achievements/system";
import type { UserProfile } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: challengeId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { solution } = await request.json();
  if (!solution?.trim())
    return NextResponse.json({ error: "solution is required" }, { status: 400 });

  const service = createServiceClient();

  // Fetch the challenge
  const { data: challenge, error: challengeError } = await service
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("is_active", true)
    .single();

  if (challengeError || !challenge)
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

  // Fetch user profile for achievement generation
  const { data: profile } = await service
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile)
    return NextResponse.json({ error: "Profile not found. Please analyze your GitHub first." }, { status: 400 });

  // ── AI evaluation ─────────────────────────────────────────────────────────
  const systemPrompt = `You are a fair and thorough coding challenge evaluator.
Assess whether the user's solution correctly addresses the problem.
Be lenient with code style/formatting but strict about correctness and completeness.
Accept explanations, pseudocode, or working code — any clear demonstration of understanding.
Return ONLY valid JSON, no extra text.`;

  const userMessage = `Challenge: "${challenge.title}"
Difficulty: ${challenge.difficulty}

Problem statement:
${challenge.description}

User's solution:
${solution}

Return JSON: { "correct": boolean, "feedback": string }
feedback should be 2-3 sentences: explain what was right/wrong, and what the ideal approach is.`;

  let isCorrect = false;
  let aiFeedback = "";

  try {
    const raw = await nimChat(systemPrompt, userMessage, 512);
    let parsed: { correct: boolean; feedback: string };

    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*"correct"[\s\S]*"feedback"[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = { correct: false, feedback: "Could not evaluate. Please try again." };
      }
    }

    isCorrect = Boolean(parsed.correct);
    aiFeedback = parsed.feedback ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: `AI evaluation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  // ── Save submission (upsert — one submission per user per challenge) ────────
  const { error: subError } = await service
    .from("challenge_submissions")
    .upsert(
      {
        challenge_id: challengeId,
        user_id: user.id,
        solution_text: solution,
        is_correct: isCorrect,
        ai_feedback: aiFeedback,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "challenge_id,user_id" }
    );

  if (subError)
    return NextResponse.json({ error: subError.message }, { status: 500 });

  // ── Award achievement if correct ───────────────────────────────────────────
  let unlockedAchievements: unknown[] = [];
  if (isCorrect) {
    try {
      unlockedAchievements = await checkAndUnlockAchievements({
        userId: user.id,
        profile: profile as UserProfile,
        completedChallenge: true,
      });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({
    correct: isCorrect,
    feedback: aiFeedback,
    unlocked: unlockedAchievements,
  });
}
