import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const VALID_EMOJIS = ["👍", "❤️", "🔥", "🚀", "💡"];

// POST /api/feed/[id]/react  { emoji: string }  → toggles the reaction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const emoji: string = body.emoji;
  if (!VALID_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const service = createServiceClient();
  const feedItemId = params.id;

  // Look up user_profiles id for this auth user
  const { data: profile } = await service
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Check if reaction already exists
  const { data: existing } = await service
    .from("feed_reactions")
    .select("id")
    .eq("feed_item_id", feedItemId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .single();

  if (existing) {
    // Toggle off — remove it
    await service.from("feed_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ reacted: false });
  } else {
    // Toggle on — add it
    await service.from("feed_reactions").insert({
      feed_item_id: feedItemId,
      user_id: user.id,
      emoji,
    });
    return NextResponse.json({ reacted: true });
  }
}
