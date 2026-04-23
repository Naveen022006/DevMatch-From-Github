import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/helpers";
import type { Message } from "@/types";

// GET /api/messages?with=userId  — fetch conversation (both directions)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const otherId = request.nextUrl.searchParams.get("with");
  if (!otherId) return NextResponse.json({ error: "with param required" }, { status: 400 });

  // RLS ensures we only see messages we sent or received
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data as Message[] });
}

// POST /api/messages  — send a message
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { receiverId, content } = await request.json() as { receiverId: string; content: string };
  if (!receiverId || !content?.trim())
    return NextResponse.json({ error: "receiverId and content required" }, { status: 400 });

  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: user.id, receiver_id: receiverId, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify receiver — fire-and-forget, avoid spam: only if no existing unread msg notification from this sender
  const service = createServiceClient();
  const { data: existing } = await service
    .from("notifications")
    .select("id")
    .eq("user_id", receiverId)
    .eq("type", "message")
    .eq("read", false)
    .eq("link", `chat:${user.id}`)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const senderUsername =
      user.user_metadata?.user_name ??
      user.user_metadata?.login ??
      user.user_metadata?.preferred_username ??
      "Someone";
    createNotification({
      userId: receiverId,
      type: "message",
      message: `@${senderUsername} sent you a message`,
      link: `chat:${user.id}`,
    });
  }

  return NextResponse.json({ message: data as Message });
}
