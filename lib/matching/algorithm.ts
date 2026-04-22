import { nimChat } from "@/lib/nvidia/client";
import type { UserProfile, DeveloperMatch, CompatibilityScore } from "@/types";
import { createServiceClient } from "@/lib/supabase/server";

const COMPLEMENTARY_IDENTITIES: Record<string, string[]> = {
  builder: ["learner", "maintainer", "builder"],
  learner: ["builder", "explorer", "maintainer"],
  maintainer: ["builder", "learner", "maintainer"],
  explorer: ["learner", "builder", "explorer"],
};

function sharedLanguages(a: UserProfile, b: UserProfile): number {
  const setB = new Set(b.languages);
  return a.languages.filter((l) => setB.has(l)).length;
}

function preFilter(me: UserProfile, candidates: UserProfile[]): UserProfile[] {
  return candidates.filter((c) => {
    if (c.id === me.id) return false;
    return (
      sharedLanguages(me, c) >= 1 ||
      COMPLEMENTARY_IDENTITIES[me.coding_identity]?.includes(c.coding_identity)
    );
  });
}

interface ScoreResult {
  technical_synergy: number;
  learning_potential: number;
  collaboration_style: number;
  personality_fit: number;
  total: number;
  reason: string;
}

async function scoreWithNIM(
  me: UserProfile,
  candidate: UserProfile
): Promise<ScoreResult> {
  const profileA = {
    codingIdentity: me.coding_identity,
    languages: me.languages.slice(0, 5),
    passionAreas: me.passion_areas,
    peakHours: me.peak_hours,
    collaborationStyle: me.collaboration_style,
    experienceLevel: me.experience_level,
    ghostRepos: me.ghost_repos,
  };
  const profileB = {
    codingIdentity: candidate.coding_identity,
    languages: candidate.languages.slice(0, 5),
    passionAreas: candidate.passion_areas,
    peakHours: candidate.peak_hours,
    collaborationStyle: candidate.collaboration_style,
    experienceLevel: candidate.experience_level,
    ghostRepos: candidate.ghost_repos,
  };

  const system =
    "You are a developer friendship matchmaker. Score two developer profiles 0-100 across: " +
    "technical_synergy (30%), learning_potential (25%), collaboration_style (25%), personality_fit (20%). " +
    "Compute total as the weighted average. " +
    "Return ONLY JSON: {technical_synergy, learning_potential, collaboration_style, personality_fit, total, reason}. " +
    "reason must be exactly 1 sentence explaining why they should connect.";

  const text = await nimChat(
    system,
    `Developer A:\n${JSON.stringify(profileA)}\n\nDeveloper B:\n${JSON.stringify(profileB)}`,
    512
  );
  return JSON.parse(text) as ScoreResult;
}

async function scoreCandidates(
  me: UserProfile,
  candidates: UserProfile[]
): Promise<DeveloperMatch[]> {
  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const score = await scoreWithNIM(me, candidate);
      return {
        profile: candidate,
        compatibility: {
          technical_synergy: score.technical_synergy,
          learning_potential: score.learning_potential,
          collaboration_style: score.collaboration_style,
          personality_fit: score.personality_fit,
          total: score.total,
          reason: score.reason,
        } satisfies CompatibilityScore,
      } satisfies DeveloperMatch;
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<DeveloperMatch>).value)
    .sort((a, b) => b.compatibility.total - a.compatibility.total);
}

export async function findMatches(myProfile: UserProfile): Promise<DeveloperMatch[]> {
  const supabase = createServiceClient();

  const { data: allProfiles, error } = await supabase
    .from("user_profiles")
    .select("*")
    .neq("id", myProfile.id)
    .limit(500);

  if (error) throw new Error(`Failed to load profiles: ${error.message}`);

  const candidates = (allProfiles ?? []) as UserProfile[];
  if (candidates.length === 0) return [];

  const filtered = preFilter(myProfile, candidates);
  const top10 = filtered.slice(0, 10);
  const scored = await scoreCandidates(myProfile, top10);

  const matchRows = scored.slice(0, 3).map((match) => ({
    user_id_1: myProfile.id,
    user_id_2: match.profile.id,
    compatibility_total: match.compatibility.total,
    technical_synergy: match.compatibility.technical_synergy,
    learning_potential: match.compatibility.learning_potential,
    collaboration_score: match.compatibility.collaboration_style,
    personality_fit: match.compatibility.personality_fit,
    match_reason: match.compatibility.reason,
  }));

  if (matchRows.length > 0) {
    await supabase
      .from("matches")
      .upsert(matchRows, { onConflict: "user_id_1,user_id_2" });
  }

  return scored.slice(0, 3);
}
