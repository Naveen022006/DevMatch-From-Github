import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ChallengeWithSubmission } from "@/types/admin";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const [challengesRes, submissionsRes] = await Promise.all([
    service
      .from("challenges")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    service
      .from("challenge_submissions")
      .select("id, challenge_id, is_correct, ai_feedback, admin_feedback, admin_override, submitted_at, repo_url, solution_text")
      .eq("user_id", user.id),
  ]);

  if (challengesRes.error)
    return NextResponse.json({ error: challengesRes.error.message }, { status: 500 });

  const subMap = new Map<string, (typeof submissionsRes.data)[number]>();
  for (const s of submissionsRes.data ?? []) {
    subMap.set(s.challenge_id, s);
  }

  const challenges: ChallengeWithSubmission[] = (challengesRes.data ?? []).map((c) => {
    const s = subMap.get(c.id);
    // Effective result: admin_override takes priority over AI result
    const effectiveCorrect = s
      ? s.admin_override !== null && s.admin_override !== undefined
        ? s.admin_override
        : s.is_correct
      : null;
    return {
      ...c,
      submission: s
        ? {
            id: s.id,
            is_correct: effectiveCorrect,
            ai_feedback: s.ai_feedback,
            admin_feedback: s.admin_feedback,
            admin_override: s.admin_override,
            submitted_at: s.submitted_at,
            repo_url: s.repo_url,
            solution_text: s.solution_text,
          }
        : undefined,
    };
  });

  return NextResponse.json({ challenges });
}
