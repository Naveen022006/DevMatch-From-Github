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
      .select("challenge_id, is_correct, ai_feedback, submitted_at, solution_text")
      .eq("user_id", user.id),
  ]);

  if (challengesRes.error)
    return NextResponse.json({ error: challengesRes.error.message }, { status: 500 });

  const subMap = new Map<string, (typeof submissionsRes.data)[number]>();
  for (const s of submissionsRes.data ?? []) {
    subMap.set(s.challenge_id, s);
  }

  const challenges: ChallengeWithSubmission[] = (challengesRes.data ?? []).map((c) => ({
    ...c,
    submission: subMap.has(c.id)
      ? {
          is_correct: subMap.get(c.id)!.is_correct,
          ai_feedback: subMap.get(c.id)!.ai_feedback,
          submitted_at: subMap.get(c.id)!.submitted_at,
          solution_text: subMap.get(c.id)!.solution_text,
        }
      : undefined,
  }));

  return NextResponse.json({ challenges });
}
