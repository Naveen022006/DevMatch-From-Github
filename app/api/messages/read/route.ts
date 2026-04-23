import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/messages/read  — mark all messages from senderId to me as read
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { senderId } = await request.json() as { senderId: string };
  if (!senderId) return NextResponse.json({ error: "senderId required" }, { status: 400 });

  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("sender_id", senderId)
    .eq("receiver_id", user.id)
    .eq("read", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
