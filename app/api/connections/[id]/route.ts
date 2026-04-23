import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkAndUnlockAchievements } from "@/lib/achievements/system";
import { addFeedEntry } from "@/lib/feed/helpers";
import { createNotification } from "@/lib/notifications/helpers";
import type { UserProfile, CompatibilityScore } from "@/types";

// PATCH /api/connections/[id]  — accept or decline a connection request
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await request.json() as { action: "accept" | "decline" };
  if (!action || !["accept", "decline"].includes(action))
    return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });

  const service = createServiceClient();

  // Fetch the request — only the receiver (to_user_id) can act on it
  const { data: connReq, error: fetchErr } = await service
    .from("connection_requests")
    .select("*")
    .eq("id", params.id)
    .eq("to_user_id", user.id) // RLS: only receiver can update
    .single();

  if (fetchErr || !connReq)
    return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (connReq.status !== "pending")
    return NextResponse.json({ error: "Request already actioned" }, { status: 400 });

  const newStatus = action === "accept" ? "accepted" : "declined";

  // Update status
  const { error: updateErr } = await service
    .from("connection_requests")
    .update({ status: newStatus })
    .eq("id", params.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (action === "decline") return NextResponse.json({ success: true, status: "declined" });

  // ── Accepted: create match record + award achievements ────────────────────

  const compatibility = connReq.compatibility_data as CompatibilityScore | null;

  // Fetch both profiles
  const [{ data: fromProfile }, { data: toProfile }] = await Promise.all([
    service.from("user_profiles").select("*").eq("id", connReq.from_user_id).single(),
    service.from("user_profiles").select("*").eq("id", connReq.to_user_id).single(),
  ]);

  // Create match record (ordered ids to satisfy unique constraint)
  const [uid1, uid2] = [connReq.from_user_id, connReq.to_user_id].sort();
  await service
    .from("matches")
    .upsert(
      {
        user_id_1: uid1,
        user_id_2: uid2,
        compatibility_total: compatibility?.total ?? 0,
        technical_synergy: compatibility?.technical_synergy ?? 0,
        learning_potential: compatibility?.learning_potential ?? 0,
        collaboration_score: compatibility?.collaboration_style ?? 0,
        personality_fit: compatibility?.personality_fit ?? 0,
        match_reason: compatibility?.reason ?? "",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id_1,user_id_2" }
    );

  // Award achievements for both users (non-critical)
  const unlocked: string[] = [];
  try {
    if (fromProfile) {
      const newAch = await checkAndUnlockAchievements({
        userId: connReq.from_user_id,
        profile: fromProfile as UserProfile,
        matchedUserId: connReq.to_user_id,
        compatibilityScore: compatibility?.total,
        matchedProfile: toProfile as UserProfile | undefined,
      });
      unlocked.push(...newAch.map((a) => a.achievement_slug));
    }
    if (toProfile) {
      await checkAndUnlockAchievements({
        userId: connReq.to_user_id,
        profile: toProfile as UserProfile,
        matchedUserId: connReq.from_user_id,
        compatibilityScore: compatibility?.total,
        matchedProfile: fromProfile as UserProfile | undefined,
      });
    }
  } catch { /* non-critical */ }

  // Emit "connected" feed entry for both parties
  addFeedEntry({ actorId: connReq.from_user_id, actionType: "connected", targetId: connReq.to_user_id });
  addFeedEntry({ actorId: connReq.to_user_id, actionType: "connected", targetId: connReq.from_user_id });

  // Notify the requester that their request was accepted
  const acceptorUsername = toProfile?.github_username ?? "Someone";
  createNotification({
    userId: connReq.from_user_id,
    type: "connection_accepted",
    message: `@${acceptorUsername} accepted your connection request`,
    link: "tab:matches",
  });

  return NextResponse.json({ success: true, status: "accepted", unlockedSlugs: unlocked });
}
