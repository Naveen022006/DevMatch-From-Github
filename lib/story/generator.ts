import { nimChat } from "@/lib/nvidia/client";
import type { UserProfile, StoryCard } from "@/types";
import { createServiceClient } from "@/lib/supabase/server";

async function generateCardContent(profile: UserProfile): Promise<StoryCard> {
  const summary = {
    username: profile.github_username,
    codingIdentity: profile.coding_identity,
    passionAreas: profile.passion_areas,
    topLanguages: profile.languages.slice(0, 3),
    peakHours: profile.peak_hours,
    totalCommits: profile.total_commits_estimate,
    totalStars: profile.total_stars,
    totalRepos: profile.total_repos,
    experienceLevel: profile.experience_level,
    humanDescription: profile.human_description,
  };

  const system =
    "Generate a poetic, personal 4-line developer story card. " +
    "line1: a powerful stat (e.g. '1,247 commits of pure determination'). " +
    "line2: their coding soul (e.g. 'A midnight Rust poet'). " +
    "line3: their superpower as a short vivid phrase. " +
    "line4: an encouraging closing line. " +
    "Also choose primaryColor (hex, vivid and glowing, not too dark) that matches their vibe. " +
    "Return ONLY JSON: {line1, line2, line3, line4, primaryColor}.";

  const text = await nimChat(
    system,
    `Create a story card for:\n${JSON.stringify(summary, null, 2)}`,
    512
  );
  const parsed = JSON.parse(text) as StoryCard;

  if (!/^#[0-9a-fA-F]{6}$/.test(parsed.primaryColor)) {
    parsed.primaryColor = "#6366f1";
  }

  return parsed;
}

export async function generateStoryCard(profile: UserProfile): Promise<StoryCard> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("story_cards")
    .select("*")
    .eq("user_id", profile.id)
    .single();

  if (existing) {
    return {
      line1: existing.line1,
      line2: existing.line2,
      line3: existing.line3,
      line4: existing.line4,
      primaryColor: existing.primary_color,
    };
  }

  const card = await generateCardContent(profile);

  await supabase.from("story_cards").upsert({
    user_id: profile.id,
    line1: card.line1,
    line2: card.line2,
    line3: card.line3,
    line4: card.line4,
    primary_color: card.primaryColor,
  });

  return card;
}
