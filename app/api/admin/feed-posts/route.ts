import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { nimChat } from "@/lib/nvidia/client";

// ─── Auth guard ────────────────────────────────────────────────────────────────

async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await createServiceClient()
    .from("user_profiles")
    .select("id, github_username, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile || !isAdmin(profile.github_username)) return null;
  return profile as { id: string; github_username: string; avatar_url: string };
}

// ─── GET /api/admin/feed-posts — list all admin posts ─────────────────────────

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("activity_feed")
    .select("*")
    .eq("action_type", "admin_post")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data ?? [] });
}

// ─── POST /api/admin/feed-posts — generate or publish ─────────────────────────
//
//  Body shape:
//    { action: "generate", topic: string, context?: string }
//    { action: "publish",  title: string, content: string, topic?: string }

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // ── Generate (AI only, does NOT persist) ──────────────────────────────────
  if (body.action === "generate") {
    const topic: string = body.topic?.trim();
    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const raw = await nimChat(
      `You are the community manager for DevMatch, a developer social platform that matches developers based on their GitHub profiles and coding styles.
Write engaging, developer-focused community posts that feel authentic and insightful — not corporate or salesy.
Always respond with valid JSON only, no markdown fences.`,
      `Generate a community post for the DevMatch feed about this topic: "${topic}"
${body.context ? `\nAdditional context: ${body.context}` : ""}

Return JSON with exactly these fields:
{
  "title": "short catchy title (max 60 chars)",
  "content": "the post body (2-4 sentences, engaging, developer-focused, can include emojis sparingly)"
}`,
      512
    );

    let parsed: { title: string; content: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI returned unexpected format", raw },
        { status: 502 }
      );
    }

    return NextResponse.json({ title: parsed.title, content: parsed.content });
  }

  // ── Publish (persist to activity_feed) ───────────────────────────────────
  if (body.action === "publish") {
    const title: string = body.title?.trim();
    const content: string = body.content?.trim();
    if (!title || !content) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 }
      );
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("activity_feed")
      .insert({
        actor_id: admin.id,
        action_type: "admin_post",
        target_id: null,
        metadata: {
          title,
          content,
          topic: body.topic ?? null,
          admin_username: admin.github_username,
        },
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ post: data });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ─── DELETE /api/admin/feed-posts — remove a post ─────────────────────────────

export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await request.json();
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("activity_feed")
    .delete()
    .eq("id", postId)
    .eq("action_type", "admin_post");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
