import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import type { AdminStats } from "@/types/admin";

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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    usersCount,
    matchesCount,
    achievementsCount,
    storyCardsCount,
    newUsersRes,
    matchScoresRes,
    identitiesRes,
    achievementSlugsRes,
  ] = await Promise.all([
    service.from("user_profiles").select("*", { count: "exact", head: true }),
    service.from("matches").select("*", { count: "exact", head: true }),
    service.from("user_achievements").select("*", { count: "exact", head: true }),
    service.from("story_cards").select("*", { count: "exact", head: true }),
    service
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    service.from("matches").select("compatibility_total"),
    service.from("user_profiles").select("coding_identity"),
    service.from("user_achievements").select("achievement_slug"),
  ]);

  // Average compatibility score
  const scores = (matchScoresRes.data ?? []).map((r) => r.compatibility_total as number);
  const avgCompatibilityScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  // Most popular coding identity (mode)
  const identityCounts: Record<string, number> = {};
  for (const row of identitiesRes.data ?? []) {
    if (row.coding_identity) {
      identityCounts[row.coding_identity] = (identityCounts[row.coding_identity] ?? 0) + 1;
    }
  }
  const mostPopularCodingIdentity =
    Object.entries(identityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Most popular achievement slug (mode)
  const slugCounts: Record<string, number> = {};
  for (const row of achievementSlugsRes.data ?? []) {
    if (row.achievement_slug) {
      slugCounts[row.achievement_slug] = (slugCounts[row.achievement_slug] ?? 0) + 1;
    }
  }
  const mostPopularAchievement =
    Object.entries(slugCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const stats: AdminStats = {
    totalUsers: usersCount.count ?? 0,
    totalMatches: matchesCount.count ?? 0,
    totalAchievements: achievementsCount.count ?? 0,
    totalStoryCards: storyCardsCount.count ?? 0,
    newUsersThisWeek: newUsersRes.count ?? 0,
    avgCompatibilityScore,
    mostPopularCodingIdentity,
    mostPopularAchievement,
  };

  return NextResponse.json({ stats });
}
