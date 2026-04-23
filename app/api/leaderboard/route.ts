import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  github_username: string;
  avatar_url: string;
  display_name: string | null;
  total_completed: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
  streak: number;
  fastest_easy_hrs: number | null;
  fastest_medium_hrs: number | null;
  fastest_hard_hrs: number | null;
}

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = [...new Set(dates.map((d) => d.slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 0; i < days.length - 1; i++) {
    const curr = new Date(days[i]).getTime();
    const prev = new Date(days[i + 1]).getTime();
    if ((curr - prev) / 86400000 === 1) streak++;
    else break;
  }
  return streak;
}

// GET /api/leaderboard
export async function GET() {
  const service = createServiceClient();

  // Get latest global + per-challenge reset timestamps
  const { data: resets } = await service
    .from("leaderboard_resets")
    .select("challenge_id, reset_at")
    .order("reset_at", { ascending: false });

  const globalReset = resets?.find((r) => !r.challenge_id)?.reset_at ?? null;
  const challengeResets: Record<string, string> = {};
  for (const r of resets ?? []) {
    if (r.challenge_id && !challengeResets[r.challenge_id]) {
      challengeResets[r.challenge_id] = r.reset_at;
    }
  }

  // Fetch all correct submissions with challenge difficulty + created_at
  const { data: subs, error } = await service
    .from("challenge_submissions")
    .select("user_id, challenge_id, submitted_at, is_correct, admin_override")
    .or("is_correct.eq.true,admin_override.eq.true")
    .order("submitted_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ entries: [] });

  // Fetch challenge info (difficulty + created_at)
  const challengeIds = [...new Set(subs.map((s) => s.challenge_id))];
  const { data: challenges } = await service
    .from("challenges")
    .select("id, difficulty, created_at")
    .in("id", challengeIds);

  const challengeMap: Record<string, { difficulty: string; created_at: string }> = {};
  for (const c of challenges ?? []) challengeMap[c.id] = c;

  // Apply resets — filter out submissions before applicable reset timestamps
  const filtered = subs.filter((s) => {
    if (globalReset && s.submitted_at <= globalReset) return false;
    const cr = challengeResets[s.challenge_id];
    if (cr && s.submitted_at <= cr) return false;
    return true;
  });

  // Group by user
  const userMap: Record<string, {
    dates: string[];
    byDifficulty: Record<string, { count: number; fastestHrs: number | null }>;
  }> = {};

  for (const s of filtered) {
    if (!userMap[s.user_id]) {
      userMap[s.user_id] = { dates: [], byDifficulty: { easy: { count: 0, fastestHrs: null }, medium: { count: 0, fastestHrs: null }, hard: { count: 0, fastestHrs: null } } };
    }
    const entry = userMap[s.user_id];
    entry.dates.push(s.submitted_at);

    const ch = challengeMap[s.challenge_id];
    if (ch) {
      const diff = ch.difficulty as "easy" | "medium" | "hard";
      if (!entry.byDifficulty[diff]) entry.byDifficulty[diff] = { count: 0, fastestHrs: null };
      entry.byDifficulty[diff].count++;
      const solveHrs = (new Date(s.submitted_at).getTime() - new Date(ch.created_at).getTime()) / 3600000;
      if (entry.byDifficulty[diff].fastestHrs === null || solveHrs < entry.byDifficulty[diff].fastestHrs!) {
        entry.byDifficulty[diff].fastestHrs = Math.max(0, solveHrs);
      }
    }
  }

  // Fetch user profiles
  const userIds = Object.keys(userMap);
  if (!userIds.length) return NextResponse.json({ entries: [] });

  const { data: profiles } = await service
    .from("user_profiles")
    .select("id, github_username, avatar_url, display_name")
    .in("id", userIds);

  const profileMap: Record<string, { github_username: string; avatar_url: string; display_name: string | null }> = {};
  for (const p of profiles ?? []) profileMap[p.id] = p;

  // Build leaderboard entries
  const entries: Omit<LeaderboardEntry, "rank">[] = userIds
    .filter((uid) => profileMap[uid])
    .map((uid) => {
      const u = userMap[uid];
      const p = profileMap[uid];
      const easy = u.byDifficulty.easy ?? { count: 0, fastestHrs: null };
      const medium = u.byDifficulty.medium ?? { count: 0, fastestHrs: null };
      const hard = u.byDifficulty.hard ?? { count: 0, fastestHrs: null };
      return {
        user_id: uid,
        github_username: p.github_username,
        avatar_url: p.avatar_url,
        display_name: p.display_name,
        total_completed: easy.count + medium.count + hard.count,
        easy_count: easy.count,
        medium_count: medium.count,
        hard_count: hard.count,
        streak: computeStreak(u.dates),
        fastest_easy_hrs: easy.fastestHrs,
        fastest_medium_hrs: medium.fastestHrs,
        fastest_hard_hrs: hard.fastestHrs,
      };
    });

  // Sort: total desc → hard desc → medium desc → easy desc
  entries.sort((a, b) =>
    b.total_completed - a.total_completed ||
    b.hard_count - a.hard_count ||
    b.medium_count - a.medium_count ||
    b.easy_count - a.easy_count
  );

  // Add rank
  const ranked: LeaderboardEntry[] = entries.map((e, i) => ({ ...e, rank: i + 1 }));

  return NextResponse.json({ entries: ranked });
}
