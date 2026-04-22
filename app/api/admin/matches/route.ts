import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import type { AdminMatch, AdminUserMini } from "@/types/admin";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username =
    user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: rawMatches, error } = await service
    .from("matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rawMatches?.length) return NextResponse.json({ matches: [] });

  // Collect unique user IDs
  const userIds = [
    ...new Set(rawMatches.flatMap((m) => [m.user_id_1, m.user_id_2])),
  ];

  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, github_username, avatar_url, display_name")
    .in("id", userIds);

  const profileMap: Record<string, AdminUserMini> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = p;
  }

  const placeholder: AdminUserMini = {
    id: "",
    github_username: "deleted",
    avatar_url: "",
    display_name: null,
  };

  const matches: AdminMatch[] = rawMatches.map((m) => ({
    ...m,
    user1: profileMap[m.user_id_1] ?? placeholder,
    user2: profileMap[m.user_id_2] ?? placeholder,
  }));

  return NextResponse.json({ matches });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username =
    user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { matchId } = await request.json();
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from("matches").delete().eq("id", matchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
