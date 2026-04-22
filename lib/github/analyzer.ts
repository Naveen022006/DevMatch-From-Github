import { nimChat } from "@/lib/nvidia/client";
import type {
  GitHubRawData,
  ClaudeProfileAnalysis,
  UserProfile,
  ExperienceLevel,
} from "@/types";
import { createServiceClient } from "@/lib/supabase/server";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function topLanguages(languages: Record<string, number>): string[] {
  return Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([lang]) => lang);
}

function inferExperience(data: GitHubRawData): ExperienceLevel {
  const ageYears =
    (Date.now() - new Date(data.user.created_at).getTime()) /
    (1000 * 60 * 60 * 24 * 365);
  const repos = data.repos.length;
  if (ageYears >= 6 && repos >= 30) return "expert";
  if (ageYears >= 3 && repos >= 15) return "senior";
  if (ageYears >= 1 && repos >= 5) return "intermediate";
  return "beginner";
}

function countGhostRepos(data: GitHubRawData): number {
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  return data.repos.filter(
    (r) => new Date(r.pushed_at).getTime() < oneYearAgo
  ).length;
}

function buildDataSummary(data: GitHubRawData): string {
  const langs = topLanguages(data.languages);
  const recentRepos = data.repos.slice(0, 10).map((r) => ({
    name: r.name,
    language: r.language,
    stars: r.stargazers_count,
    topics: r.topics.slice(0, 3),
    description: r.description?.slice(0, 80),
  }));

  return JSON.stringify(
    {
      username: data.user.login,
      bio: data.user.bio,
      accountAgeYears: Math.round(
        (Date.now() - new Date(data.user.created_at).getTime()) /
          (1000 * 60 * 60 * 24 * 365)
      ),
      followers: data.user.followers,
      publicRepos: data.user.public_repos,
      topLanguages: langs,
      peakCommitHours: data.contributionData.peakHours,
      totalRecentCommits: data.contributionData.totalCommits,
      starredTopics: data.starredTopics.slice(0, 10),
      recentRepos,
      readmeSnippet: data.readmeContent?.slice(0, 500),
    },
    null,
    2
  );
}

async function analyzeWithNIM(
  data: GitHubRawData
): Promise<ClaudeProfileAnalysis> {
  const system =
    "You are a developer personality analyst. Given raw GitHub data, extract: " +
    "primary coding identity (exactly one of: builder/learner/maintainer/explorer), " +
    "collaboration style (exactly one of: solo/pair/team-lead/contributor), " +
    "peak creativity hours (a short string like '10pm – 2am'), " +
    "top 3 passion areas as strings, " +
    "and a 2-sentence human description of this developer. " +
    "Return ONLY a JSON object with these exact keys: " +
    "codingIdentity, collaborationStyle, peakCreativityHours, passionAreas (array of 3), humanDescription.";

  const text = await nimChat(system, `Analyze:\n\n${buildDataSummary(data)}`);
  const parsed = JSON.parse(text) as ClaudeProfileAnalysis;

  const validIdentities = ["builder", "learner", "maintainer", "explorer"];
  const validStyles = ["solo", "pair", "team-lead", "contributor"];
  if (!validIdentities.includes(parsed.codingIdentity)) parsed.codingIdentity = "builder";
  if (!validStyles.includes(parsed.collaborationStyle)) parsed.collaborationStyle = "contributor";
  if (!Array.isArray(parsed.passionAreas) || parsed.passionAreas.length < 3) {
    parsed.passionAreas = ["open source", "learning", "building"] as [string, string, string];
  }

  return parsed;
}

export async function analyzeGitHubProfile(
  userId: string,
  data: GitHubRawData
): Promise<UserProfile> {
  const supabase = createServiceClient();

  const { data: cached } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (cached?.analysis_cached_at) {
    const cachedAt = new Date(cached.analysis_cached_at).getTime();
    if (Date.now() - cachedAt < CACHE_TTL_MS) return cached as UserProfile;
  }

  const analysis = await analyzeWithNIM(data);
  const langs = topLanguages(data.languages);
  const totalStars = data.repos.reduce((s, r) => s + r.stargazers_count, 0);

  const profileData: Partial<UserProfile> = {
    id: userId,
    github_username: data.user.login,
    github_id: data.user.id,
    avatar_url: data.user.avatar_url,
    display_name: data.user.name ?? data.user.login,
    languages: langs,
    coding_identity: analysis.codingIdentity,
    passion_areas: analysis.passionAreas,
    peak_hours: analysis.peakCreativityHours,
    commit_style: data.contributionData.totalCommits > 200 ? "frequent" : "periodic",
    experience_level: inferExperience(data),
    ghost_repos: countGhostRepos(data),
    collaboration_style: analysis.collaborationStyle,
    human_description: analysis.humanDescription,
    total_repos: data.repos.length,
    total_stars: totalStars,
    total_commits_estimate: data.contributionData.totalCommits,
    analysis_cached_at: new Date().toISOString(),
  };

  const { data: upserted, error } = await supabase
    .from("user_profiles")
    .upsert(profileData)
    .select()
    .single();

  if (error) throw new Error(`Failed to save profile: ${error.message}`);
  return upserted as UserProfile;
}
