import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import type { AdminStoryCard, AdminUserMini } from "@/types/admin";

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
  const { data: rawCards, error } = await service
    .from("story_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rawCards?.length) return NextResponse.json({ cards: [] });

  const userIds = [...new Set(rawCards.map((c) => c.user_id))];

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

  const cards: AdminStoryCard[] = rawCards.map((c) => ({
    ...c,
    user: profileMap[c.user_id] ?? placeholder,
  }));

  return NextResponse.json({ cards });
}
