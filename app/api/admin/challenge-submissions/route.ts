import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { fetchRepoContent } from "@/lib/github/repo-content";
import { nimChat } from "@/lib/nvidia/client";
import type { ChallengeSubmission, AdminUserMini } from "@/types/admin";

// GET /api/admin/challenge-submissions?challengeId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const challengeId = request.nextUrl.searchParams.get("challengeId");
  if (!challengeId) return NextResponse.json({ error: "challengeId required" }, { status: 400 });

  const service = createServiceClient();
  const { data: rawSubs, error } = await service
    .from("challenge_submissions")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rawSubs?.length) return NextResponse.json({ submissions: [] });

  const userIds = [...new Set(rawSubs.map((s) => s.user_id))];
  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, github_username, avatar_url, display_name")
    .in("id", userIds);

  const profileMap: Record<string, AdminUserMini> = {};
  for (const p of profiles ?? []) profileMap[p.id] = p;

  const placeholder: AdminUserMini = { id: "", github_username: "deleted", avatar_url: "", display_name: null };

  const submissions: ChallengeSubmission[] = rawSubs.map((s) => ({
    ...s,
    user: profileMap[s.user_id] ?? placeholder,
  }));

  return NextResponse.json({ submissions });
}

// PATCH /api/admin/challenge-submissions  — manual override
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { submissionId, adminOverride, adminFeedback } = await request.json();
  if (!submissionId || adminOverride === undefined) {
    return NextResponse.json({ error: "submissionId and adminOverride required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Update override
  const { error } = await service
    .from("challenge_submissions")
    .update({
      admin_override: adminOverride,
      admin_feedback: adminFeedback ?? null,
    })
    .eq("id", submissionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If admin marks as correct, ensure achievement is awarded
  if (adminOverride === true) {
    const { data: sub } = await service
      .from("challenge_submissions")
      .select("user_id")
      .eq("id", submissionId)
      .single();

    if (sub) {
      const { data: profile } = await service
        .from("user_profiles")
        .select("*")
        .eq("id", sub.user_id)
        .single();

      if (profile) {
        try {
          const { checkAndUnlockAchievements } = await import("@/lib/achievements/system");
          await checkAndUnlockAchievements({
            userId: sub.user_id,
            profile,
            completedChallenge: true,
          });
        } catch { /* non-critical */ }
      }
    }
  }

  return NextResponse.json({ success: true });
}

// POST /api/admin/challenge-submissions  — re-evaluate with AI
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { submissionId } = await request.json();
  if (!submissionId) return NextResponse.json({ error: "submissionId required" }, { status: 400 });

  const service = createServiceClient();

  // Fetch submission + challenge
  const { data: sub } = await service
    .from("challenge_submissions")
    .select("*, challenges(*)")
    .eq("id", submissionId)
    .single();

  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const repoUrl = sub.repo_url ?? sub.solution_text;
  if (!repoUrl) return NextResponse.json({ error: "No repo URL on this submission" }, { status: 400 });

  const challenge = sub.challenges;

  // Fetch repo content (admin re-eval — no user token, requires public repo)
  let repoContent: string;
  try {
    repoContent = await fetchRepoContent(repoUrl);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read repository" },
      { status: 400 }
    );
  }

  const systemPrompt = `You are a rigorous but fair code challenge evaluator.
Evaluate the GitHub repository against the challenge requirements.
Return ONLY valid JSON, no extra text.`;

  const userMessage = `Challenge: "${challenge.title}" (${challenge.difficulty})
Problem: ${challenge.description}

Repository content:
${repoContent.slice(0, 6000)}

Return JSON: { "correct": boolean, "feedback": string }`;

  let isCorrect = false;
  let aiFeedback = "";

  try {
    const raw = await nimChat(systemPrompt, userMessage, 600);
    let parsed: { correct: boolean; feedback: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*"correct"[\s\S]*"feedback"[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { correct: false, feedback: "Evaluation failed." };
    }
    isCorrect = Boolean(parsed.correct);
    aiFeedback = parsed.feedback ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: `AI evaluation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  // Save new AI result and clear admin override
  const { error: updateError } = await service
    .from("challenge_submissions")
    .update({
      is_correct: isCorrect,
      ai_feedback: aiFeedback,
      admin_override: null,
      admin_feedback: null,
    })
    .eq("id", submissionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ correct: isCorrect, feedback: aiFeedback });
}
