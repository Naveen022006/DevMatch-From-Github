import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ConnectionRequestWithProfile } from "@/types";

// GET /api/connections/requests  — incoming pending requests with sender profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: rawRequests, error } = await service
    .from("connection_requests")
    .select("*")
    .eq("to_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rawRequests?.length) return NextResponse.json({ requests: [] });

  const senderIds = rawRequests.map((r) => r.from_user_id);
  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, github_username, avatar_url, display_name, coding_identity, experience_level, languages")
    .in("id", senderIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const requests: ConnectionRequestWithProfile[] = rawRequests.map((r) => ({
    ...r,
    from_profile: profileMap[r.from_user_id] ?? {
      id: r.from_user_id,
      github_username: "unknown",
      avatar_url: "",
      display_name: null,
      coding_identity: "builder",
      experience_level: "intermediate",
      languages: [],
    },
  }));

  return NextResponse.json({ requests });
}
