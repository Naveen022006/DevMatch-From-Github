import { createServiceClient } from "@/lib/supabase/server";

export type FeedActionType = "joined" | "connected" | "achievement" | "challenge";

export async function addFeedEntry(params: {
  actorId: string;
  actionType: FeedActionType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const service = createServiceClient();

    // Skip if user has opted out of the feed
    const { data: profile } = await service
      .from("user_profiles")
      .select("hide_from_feed")
      .eq("id", params.actorId)
      .single();

    if (profile?.hide_from_feed === true) return;

    await service.from("activity_feed").insert({
      actor_id: params.actorId,
      action_type: params.actionType,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? null,
    });
  } catch {
    // Fire-and-forget — never block the main flow
  }
}
