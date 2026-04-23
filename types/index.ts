// ─── GitHub Raw Data ────────────────────────────────────────────────────────

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  pushed_at: string;
  created_at: string;
  updated_at: string;
  default_branch: string;
  fork: boolean;
  private: boolean;
  html_url: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  location: string | null;
  company: string | null;
  blog: string | null;
  twitter_username: string | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
}

export interface GitHubLanguageStats {
  [language: string]: number; // bytes
}

export interface GitHubContributionData {
  totalCommits: number;
  peakHours: number[]; // 0-23 hours with most commits
  commitsByDayOfWeek: number[]; // 0=Sun, 6=Sat
  streaks: { current: number; longest: number };
}

// ─── Analyzed Profile ────────────────────────────────────────────────────────

export type CodingIdentity = "builder" | "learner" | "maintainer" | "explorer";
export type CollaborationStyle = "solo" | "pair" | "team-lead" | "contributor";
export type ExperienceLevel = "beginner" | "intermediate" | "senior" | "expert";

export interface ClaudeProfileAnalysis {
  codingIdentity: CodingIdentity;
  collaborationStyle: CollaborationStyle;
  peakCreativityHours: string; // e.g. "10pm - 2am"
  passionAreas: [string, string, string]; // exactly 3
  humanDescription: string; // 2-sentence description
}

export interface GitHubRawData {
  user: GitHubUser;
  repos: GitHubRepo[];
  languages: GitHubLanguageStats;
  recentCommits: GitHubCommit[];
  starredTopics: string[];
  readmeContent?: string;
  contributionData: GitHubContributionData;
}

// ─── User Profile (Supabase) ─────────────────────────────────────────────────

export interface UserProfile {
  id: string; // Supabase auth UUID
  github_username: string;
  github_id: number;
  avatar_url: string;
  display_name: string | null;

  // Analyzed fields
  languages: string[];
  coding_identity: CodingIdentity;
  passion_areas: string[];
  peak_hours: string;
  commit_style: string;
  experience_level: ExperienceLevel;
  ghost_repos: number; // repos not updated in 1+ year
  collaboration_style: CollaborationStyle;
  human_description: string;

  // Stats
  total_repos: number;
  total_stars: number;
  total_commits_estimate: number;

  // Meta
  analysis_cached_at: string;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  hide_from_feed?: boolean;
  notification_preferences?: Record<string, boolean>;
  onboarding_completed?: boolean;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface CompatibilityScore {
  technical_synergy: number; // 0-100
  learning_potential: number;
  collaboration_style: number;
  personality_fit: number;
  total: number;
  reason: string;
}

export interface DeveloperMatch {
  profile: UserProfile;
  compatibility: CompatibilityScore;
}

// ─── Story Card ───────────────────────────────────────────────────────────────

export interface StoryCard {
  line1: string; // powerful stat
  line2: string; // coding soul
  line3: string; // superpower
  line4: string; // encouraging close
  primaryColor: string; // hex color
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export type AchievementSlug =
  | "first_connection"
  | "code_twins"
  | "ghost_whisperer"
  | "night_owls"
  | "challenge_complete";

export interface AchievementDefinition {
  slug: AchievementSlug;
  name: string;
  description: string;
  icon: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_slug: AchievementSlug;
  unlock_message: string;
  unlocked_at: string;
  related_user_id?: string;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

// ─── Connection Requests ──────────────────────────────────────────────────────

export interface ConnectionRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined";
  compatibility_score: number | null;
  compatibility_data: CompatibilityScore | null;
  created_at: string;
}

export interface ConnectionRequestWithProfile extends ConnectionRequest {
  from_profile: {
    id: string;
    github_username: string;
    avatar_url: string;
    display_name: string | null;
    coding_identity: CodingIdentity;
    experience_level: ExperienceLevel;
    languages: string[];
  };
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  github_username: string;
  avatar_url: string;
}

// ─── Skill Badges ─────────────────────────────────────────────────────────────

export interface SkillBadge {
  id: string;
  name: string;
  icon: string;
  description: string; // shown on hover — "how it was earned"
  color: string;
}

// ─── Project Ideas ────────────────────────────────────────────────────────────

export type ProjectDifficulty = "beginner" | "intermediate" | "advanced";

export interface ProjectIdea {
  title: string;
  description: string;
  techStack: string[];
  difficulty: ProjectDifficulty;
}


export type FeedActionType = "joined" | "connected" | "achievement" | "challenge" | "admin_post";

export interface FeedProfile {
  id: string;
  github_username: string;
  avatar_url: string;
  display_name: string | null;
}

export interface ActivityFeedItem {
  id: string;
  actor_id: string;
  action_type: FeedActionType;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: FeedProfile;
  target: FeedProfile | null;
}
