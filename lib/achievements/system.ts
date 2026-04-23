import { nimChat } from "@/lib/nvidia/client";
import type {
  UserProfile,
  AchievementSlug,
  UserAchievement,
} from "@/types";
import { createServiceClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import { addFeedEntry } from "@/lib/feed/helpers";

export { ACHIEVEMENTS };

async function generateUnlockMessage(
  achievement: AchievementDefinition,
  profile: UserProfile
): Promise<string> {
  const ctx = {
    username: profile.github_username,
    codingIdentity: profile.coding_identity,
    topLanguages: profile.languages.slice(0, 3),
    passionAreas: profile.passion_areas,
    experienceLevel: profile.experience_level,
  };

  const system =
    "Write a 2-sentence personalized achievement unlock message for a developer. " +
    "Make it feel like a genuine, warm celebration — not a generic notification. " +
    "Be specific to their identity and inspiring. Plain text only, no JSON.";

  const text = await nimChat(
    system,
    `Achievement: "${achievement.name}" — ${achievement.description}\nDeveloper: ${JSON.stringify(ctx)}`,
    256
  );

  return text || `You just unlocked ${achievement.name}! Keep building amazing things.`;
}

async function getExistingAchievements(userId: string): Promise<Set<AchievementSlug>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_achievements")
    .select("achievement_slug")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.achievement_slug as AchievementSlug));
}

async function unlockAchievement(
  userId: string,
  slug: AchievementSlug,
  profile: UserProfile,
  relatedUserId?: string
): Promise<UserAchievement | null> {
  const supabase = createServiceClient();
  const achievement = ACHIEVEMENTS[slug];
  const unlockMessage = await generateUnlockMessage(achievement, profile);

  const { data, error } = await supabase
    .from("user_achievements")
    .upsert(
      {
        user_id: userId,
        achievement_slug: slug,
        unlock_message: unlockMessage,
        related_user_id: relatedUserId ?? null,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "user_id,achievement_slug", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error || !data) return null;

  // Emit achievement feed entry
  addFeedEntry({
    actorId: userId,
    actionType: "achievement",
    metadata: { slug, name: achievement.name, icon: achievement.icon },
  });

  return data as UserAchievement;
}

function isNightOwl(peakHours: string): boolean {
  return /11\s*pm|23:00|midnight|12\s*am|1\s*am|2\s*am|0[012]:/i.test(peakHours);
}

interface CheckParams {
  userId: string;
  profile: UserProfile;
  matchedUserId?: string;
  compatibilityScore?: number;
  matchedProfile?: UserProfile;
  completedChallenge?: boolean;
  revivedRepo?: boolean;
}

export async function checkAndUnlockAchievements(
  params: CheckParams
): Promise<UserAchievement[]> {
  const {
    userId, profile, matchedUserId, compatibilityScore,
    matchedProfile, completedChallenge, revivedRepo,
  } = params;

  const existing = await getExistingAchievements(userId);
  const unlocked: UserAchievement[] = [];

  if (matchedUserId && !existing.has("first_connection")) {
    const r = await unlockAchievement(userId, "first_connection", profile, matchedUserId);
    if (r) unlocked.push(r);
  }
  if (compatibilityScore && compatibilityScore >= 90 && !existing.has("code_twins")) {
    const r = await unlockAchievement(userId, "code_twins", profile, matchedUserId);
    if (r) unlocked.push(r);
  }
  if (
    matchedProfile &&
    isNightOwl(profile.peak_hours ?? "") &&
    isNightOwl(matchedProfile.peak_hours ?? "") &&
    !existing.has("night_owls")
  ) {
    const r = await unlockAchievement(userId, "night_owls", profile, matchedUserId);
    if (r) unlocked.push(r);
  }
  if (revivedRepo && !existing.has("ghost_whisperer")) {
    const r = await unlockAchievement(userId, "ghost_whisperer", profile, matchedUserId);
    if (r) unlocked.push(r);
  }
  if (completedChallenge && !existing.has("challenge_complete")) {
    const r = await unlockAchievement(userId, "challenge_complete", profile);
    if (r) unlocked.push(r);
  }

  return unlocked;
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_achievements")
    .select("*")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch achievements: ${error.message}`);
  return (data ?? []) as UserAchievement[];
}
