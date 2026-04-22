import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { nimChat } from "@/lib/nvidia/client";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import type { AchievementSlug, UserProfile, UserAchievement } from "@/types";

// ─── Helpers (mirrors system.ts but uses a passed-in service client) ──────────

function isNightOwl(peakHours: string): boolean {
  return /11\s*pm|23:00|midnight|12\s*am|1\s*am|2\s*am|0[012]:/i.test(peakHours);
}

async function generateUnlockMessage(
  slug: AchievementSlug,
  profile: UserProfile
): Promise<string> {
  const achievement = ACHIEVEMENTS[slug];
  const ctx = {
    username: profile.github_username,
    codingIdentity: profile.coding_identity,
    topLanguages: (profile.languages ?? []).slice(0, 3),
    passionAreas: profile.passion_areas,
    experienceLevel: profile.experience_level,
  };
  const system =
    "Write a 2-sentence personalized achievement unlock message for a developer. " +
    "Make it feel like a genuine, warm celebration — not a generic notification. " +
    "Be specific to their identity and inspiring. Plain text only, no JSON.";

  try {
    const text = await nimChat(
      system,
      `Achievement: "${achievement.name}" — ${achievement.description}\nDeveloper: ${JSON.stringify(ctx)}`,
      200
    );
    return text || `You just unlocked ${achievement.name}! Keep building amazing things.`;
  } catch {
    return `You just unlocked ${achievement.name}! Keep building amazing things.`;
  }
}

async function awardAchievement(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  slug: AchievementSlug,
  profile: UserProfile,
  relatedUserId?: string
): Promise<UserAchievement | null> {
  const message = await generateUnlockMessage(slug, profile);

  const { data, error } = await service
    .from("user_achievements")
    .upsert(
      {
        user_id: userId,
        achievement_slug: slug,
        unlock_message: message,
        related_user_id: relatedUserId ?? null,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "user_id,achievement_slug", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error || !data) return null;
  return data as UserAchievement;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export interface AwardAllResult {
  totalUsers: number;
  totalAwarded: number;
  details: {
    userId: string;
    github_username: string;
    awarded: AchievementSlug[];
    skipped: AchievementSlug[]; // already had them
  }[];
  errors: { userId: string; error: string }[];
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // ── 1. Fetch all profiles ──────────────────────────────────────────────────
  const { data: profiles, error: profilesError } = await service
    .from("user_profiles")
    .select("*")
    .limit(200);

  if (profilesError)
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  if (!profiles?.length)
    return NextResponse.json({ error: "No users found" }, { status: 404 });

  // ── 2. Fetch all matches ───────────────────────────────────────────────────
  const { data: allMatches } = await service
    .from("matches")
    .select("user_id_1, user_id_2, compatibility_total");

  // ── 3. Fetch all existing achievements ────────────────────────────────────
  const { data: existingAll } = await service
    .from("user_achievements")
    .select("user_id, achievement_slug");

  // Build lookup maps
  const profileMap = new Map<string, UserProfile>();
  for (const p of profiles) profileMap.set(p.id, p as UserProfile);

  // userId → Set of existing slugs
  const existingMap = new Map<string, Set<AchievementSlug>>();
  for (const row of existingAll ?? []) {
    if (!existingMap.has(row.user_id)) existingMap.set(row.user_id, new Set());
    existingMap.get(row.user_id)!.add(row.achievement_slug as AchievementSlug);
  }

  // userId → matches they are involved in
  const matchesByUser = new Map<
    string,
    { partnerId: string; compatibility_total: number }[]
  >();
  for (const m of allMatches ?? []) {
    const add = (uid: string, pid: string) => {
      if (!matchesByUser.has(uid)) matchesByUser.set(uid, []);
      matchesByUser
        .get(uid)!
        .push({ partnerId: pid, compatibility_total: m.compatibility_total });
    };
    add(m.user_id_1, m.user_id_2);
    add(m.user_id_2, m.user_id_1);
  }

  // ── 4. Process each user ───────────────────────────────────────────────────
  const result: AwardAllResult = {
    totalUsers: profiles.length,
    totalAwarded: 0,
    details: [],
    errors: [],
  };

  for (const profile of profiles) {
    const uid = profile.id;
    const existing = existingMap.get(uid) ?? new Set<AchievementSlug>();
    const userMatches = matchesByUser.get(uid) ?? [];
    const awarded: AchievementSlug[] = [];
    const skipped: AchievementSlug[] = [];

    try {
      // ── first_connection: has any match ──────────────────────────────────
      if (userMatches.length > 0) {
        if (!existing.has("first_connection")) {
          const partnerId = userMatches[0].partnerId;
          const r = await awardAchievement(service, uid, "first_connection", profile as UserProfile, partnerId);
          if (r) { awarded.push("first_connection"); existing.add("first_connection"); }
        } else {
          skipped.push("first_connection");
        }
      }

      // ── code_twins: any match with ≥90 compatibility ─────────────────────
      const twinMatch = userMatches.find((m) => m.compatibility_total >= 90);
      if (twinMatch) {
        if (!existing.has("code_twins")) {
          const r = await awardAchievement(service, uid, "code_twins", profile as UserProfile, twinMatch.partnerId);
          if (r) { awarded.push("code_twins"); existing.add("code_twins"); }
        } else {
          skipped.push("code_twins");
        }
      }

      // ── night_owls: user is night owl AND any match partner is also night owl
      if (isNightOwl(profile.peak_hours ?? "")) {
        const nightMatch = userMatches.find((m) => {
          const partner = profileMap.get(m.partnerId);
          return partner && isNightOwl(partner.peak_hours ?? "");
        });
        if (nightMatch) {
          if (!existing.has("night_owls")) {
            const r = await awardAchievement(service, uid, "night_owls", profile as UserProfile, nightMatch.partnerId);
            if (r) { awarded.push("night_owls"); existing.add("night_owls"); }
          } else {
            skipped.push("night_owls");
          }
        }
      }

      // ── ghost_whisperer: has abandoned repos (ghost_repos > 3) ───────────
      if ((profile.ghost_repos ?? 0) > 3) {
        if (!existing.has("ghost_whisperer")) {
          const r = await awardAchievement(service, uid, "ghost_whisperer", profile as UserProfile);
          if (r) { awarded.push("ghost_whisperer"); existing.add("ghost_whisperer"); }
        } else {
          skipped.push("ghost_whisperer");
        }
      }

      result.totalAwarded += awarded.length;
      result.details.push({
        userId: uid,
        github_username: profile.github_username,
        awarded,
        skipped,
      });
    } catch (e) {
      result.errors.push({
        userId: uid,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json(result);
}
