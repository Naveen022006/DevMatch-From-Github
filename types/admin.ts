import type { AchievementSlug, CodingIdentity, ExperienceLevel } from "@/types";

export interface AdminStats {
  totalUsers: number;
  totalMatches: number;
  totalAchievements: number;
  totalStoryCards: number;
  newUsersThisWeek: number;
  avgCompatibilityScore: number;
  mostPopularCodingIdentity: string;
  mostPopularAchievement: string;
}

export interface AdminUserMini {
  id: string;
  github_username: string;
  avatar_url: string;
  display_name: string | null;
}

export interface AdminUser {
  id: string;
  github_username: string;
  avatar_url: string;
  display_name: string | null;
  coding_identity: CodingIdentity;
  experience_level: ExperienceLevel;
  languages: string[];
  total_repos: number;
  total_stars: number;
  analysis_cached_at: string;
  created_at: string;
}

export interface AdminMatch {
  id: string;
  user_id_1: string;
  user_id_2: string;
  compatibility_total: number;
  technical_synergy: number;
  learning_potential: number;
  collaboration_score: number;
  personality_fit: number;
  match_reason: string;
  created_at: string;
  user1: AdminUserMini;
  user2: AdminUserMini;
}

export interface AdminAchievement {
  id: string;
  user_id: string;
  achievement_slug: AchievementSlug;
  unlock_message: string;
  unlocked_at: string;
  related_user_id?: string;
  user: AdminUserMini;
}

export interface AchievementSlugCount {
  slug: string;
  count: number;
}

export interface AdminStoryCard {
  id: string;
  user_id: string;
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  primary_color: string;
  created_at: string;
  user: AdminUserMini;
}

export type AdminTab = "overview" | "users" | "matches" | "achievements" | "story-cards" | "leaderboard";

// ─── Challenges ───────────────────────────────────────────────────────────────

export type ChallengeDifficulty = "easy" | "medium" | "hard";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  is_active: boolean;
  created_at: string;
}

export interface ChallengeWithSubmission extends Challenge {
  submission?: {
    id: string;
    is_correct: boolean | null;
    ai_feedback: string | null;
    admin_feedback: string | null;
    admin_override: boolean | null;
    submitted_at: string;
    repo_url: string | null;
    solution_text: string | null;
  };
}

// ─── Challenge Submissions (admin) ───────────────────────────────────────────

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  repo_url: string | null;
  solution_text: string | null;
  is_correct: boolean | null;
  ai_feedback: string | null;
  admin_feedback: string | null;
  admin_override: boolean | null;
  submitted_at: string;
  user: AdminUserMini;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

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
