import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";

// POST /api/admin/leaderboard/reset
// Body: { challengeId?: string }  — omit challengeId for global reset
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const challengeId: string | null = body?.challengeId ?? null;

  const service = createServiceClient();
  const { error } = await service
    .from("leaderboard_resets")
    .insert({ challenge_id: challengeId, reset_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, scope: challengeId ? "challenge" : "global" });
}
