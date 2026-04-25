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

  const itemIds = rawItems.map((i) => i.id);

  // Collect all user IDs to join
  const userIds = [...new Set([
    ...rawItems.map((i) => i.actor_id),
    ...rawItems.map((i) => i.target_id).filter(Boolean),
  ])];

  // Batch fetch profiles, reactions, comment counts in parallel
  const [profilesRes, reactionsRes, commentCountsRes] = await Promise.all([
    service
      .from("user_profiles")
      .select("id, github_username, avatar_url, display_name")
      .in("id", userIds),
    service
      .from("feed_reactions")
      .select("feed_item_id, emoji, user_id")
      .in("feed_item_id", itemIds),
    service
      .from("feed_comments")
      .select("feed_item_id")
      .in("feed_item_id", itemIds),
  ]);

  const pMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p]));

  // Build reactions map: feedItemId → { emoji → { count, reacted } }
  const reactMap: Record<string, Record<string, { count: number; reacted: boolean }>> = {};
  for (const r of reactionsRes.data ?? []) {
    if (!reactMap[r.feed_item_id]) reactMap[r.feed_item_id] = {};
    if (!reactMap[r.feed_item_id][r.emoji]) reactMap[r.feed_item_id][r.emoji] = { count: 0, reacted: false };
    reactMap[r.feed_item_id][r.emoji].count++;
    if (r.user_id === user.id) reactMap[r.feed_item_id][r.emoji].reacted = true;
  }

  // Build comment count map: feedItemId → count
  const commentCountMap: Record<string, number> = {};
  for (const c of commentCountsRes.data ?? []) {
    commentCountMap[c.feed_item_id] = (commentCountMap[c.feed_item_id] ?? 0) + 1;
  }

  const items: ActivityFeedItem[] = rawItems.map((i) => {
    const emojiMap = reactMap[i.id] ?? {};
    const reactions = Object.entries(emojiMap).map(([emoji, v]) => ({
      emoji,
      count: v.count,
      reacted: v.reacted,
    }));

    return {
      id: i.id,
      actor_id: i.actor_id,
      action_type: i.action_type,
      target_id: i.target_id,
      metadata: i.metadata,
      created_at: i.created_at,
      actor: pMap[i.actor_id] ?? { id: i.actor_id, github_username: "unknown", avatar_url: "", display_name: null },
      target: i.target_id ? pMap[i.target_id] ?? null : null,
      reactions,
      commentCount: commentCountMap[i.id] ?? 0,
    };
  });

  return NextResponse.json({ items, hasMore: rawItems.length === LIMIT });
}
