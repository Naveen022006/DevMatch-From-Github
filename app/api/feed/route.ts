import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActivityFeedItem } from "@/types";

const LIMIT = 20;

// GET /api/feed?page=1
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * LIMIT;

  const service = createServiceClient();

  const { data: rawItems, error } = await service
    .from("activity_feed")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + LIMIT - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rawItems?.length) return NextResponse.json({ items: [], hasMore: false });

  // Collect all user IDs to join
  const userIds = [...new Set([
    ...rawItems.map((i) => i.actor_id),
    ...rawItems.map((i) => i.target_id).filter(Boolean),
  ])];

  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, github_username, avatar_url, display_name")
    .in("id", userIds);

  const pMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const items: ActivityFeedItem[] = rawItems.map((i) => ({
    id: i.id,
    actor_id: i.actor_id,
    action_type: i.action_type,
    target_id: i.target_id,
    metadata: i.metadata,
    created_at: i.created_at,
    actor: pMap[i.actor_id] ?? { id: i.actor_id, github_username: "unknown", avatar_url: "", display_name: null },
    target: i.target_id ? pMap[i.target_id] ?? null : null,
  }));

  return NextResponse.json({ items, hasMore: rawItems.length === LIMIT });
}
