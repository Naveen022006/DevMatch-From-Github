import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET /api/feed/[id]/comments  → list comments for a feed item
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: comments, error } = await service
    .from("feed_comments")
    .select("id, content, created_at, user_id")
    .eq("feed_item_id", params.id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!comments?.length) return NextResponse.json({ comments: [] });

  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, github_username, avatar_url, display_name")
    .in("id", userIds);

  const pMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      isOwn: c.user_id === user.id,
      user: pMap[c.user_id] ?? { github_username: "unknown", avatar_url: "", display_name: null },
    })),
  });
}

// POST /api/feed/[id]/comments  { content: string }  → add a comment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const content: string = (body.content ?? "").trim().slice(0, 200);
  if (!content) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });

  const service = createServiceClient();

  const { data: inserted, error } = await service
    .from("feed_comments")
    .insert({ feed_item_id: params.id, user_id: user.id, content })
    .select("id, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profile } = await service
    .from("user_profiles")
    .select("github_username, avatar_url, display_name")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    comment: {
      id: inserted.id,
      content: inserted.content,
      created_at: inserted.created_at,
      isOwn: true,
      user: profile ?? { github_username: "unknown", avatar_url: "", display_name: null },
    },
  });
}
