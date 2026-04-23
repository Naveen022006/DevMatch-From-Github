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
