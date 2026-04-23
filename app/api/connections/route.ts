import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/helpers";
import type { CompatibilityScore } from "@/types";

// POST /api/connections  — send a connection request
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toUserId, compatibility } = await request.json() as {
    toUserId: string;
    compatibility?: CompatibilityScore;
  };
  if (!toUserId) return NextResponse.json({ error: "toUserId required" }, { status: 400 });
  if (toUserId === user.id) return NextResponse.json({ error: "Cannot connect to yourself" }, { status: 400 });

  // Upsert: if previously declined, reset to pending so user can retry
  const { data, error } = await supabase
    .from("connection_requests")
    .upsert(
      {
        from_user_id: user.id,
        to_user_id: toUserId,
        status: "pending",
        compatibility_score: compatibility?.total ?? null,
        compatibility_data: compatibility ?? null,
      },
      { onConflict: "from_user_id,to_user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the target — get sender username
  const senderUsername =
    user.user_metadata?.user_name ??
    user.user_metadata?.login ??
    user.user_metadata?.preferred_username ??
    "Someone";

  createNotification({
    userId: toUserId,
    type: "connection_request",
    message: `@${senderUsername} sent you a connection request`,
    link: "tab:requests",
  });

  return NextResponse.json({ request: data });
}

// GET /api/connections  — get statuses of requests I sent
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("connection_requests")
    .select("to_user_id, status")
    .eq("from_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sent: data ?? [] });
}
