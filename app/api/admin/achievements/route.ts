import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import type { AdminAchievement, AchievementSlugCount, AdminUserMini } from "@/types/admin";

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
  const { data: rawAchievements, error } = await service
    .from("user_achievements")
    .select("*")
    .order("unlocked_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rawAchievements?.length)
    return NextResponse.json({ achievements: [], slugSummary: [] });

  // Collect unique user IDs
  const userIds = [...new Set(rawAchievements.map((a) => a.user_id))];

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

  const achievements: AdminAchievement[] = rawAchievements.map((a) => ({
    ...a,
    user: profileMap[a.user_id] ?? placeholder,
  }));

  // Slug summary
  const slugCounts: Record<string, number> = {};
  for (const a of rawAchievements) {
    slugCounts[a.achievement_slug] = (slugCounts[a.achievement_slug] ?? 0) + 1;
  }
  const slugSummary: AchievementSlugCount[] = Object.entries(slugCounts)
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ achievements, slugSummary });
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

  const { achievementId } = await request.json();
  if (!achievementId) return NextResponse.json({ error: "achievementId required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("user_achievements")
    .delete()
    .eq("id", achievementId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
