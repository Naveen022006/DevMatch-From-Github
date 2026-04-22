import type { AchievementSlug, AchievementDefinition } from "@/types";

export const ACHIEVEMENTS: Record<AchievementSlug, AchievementDefinition> = {
  first_connection: {
    slug: "first_connection",
    name: "First Connection",
    description: "Matched with your first developer",
    icon: "🤝",
  },
  code_twins: {
    slug: "code_twins",
    name: "Code Twins",
    description: "Matched with 90%+ compatibility",
    icon: "💫",
  },
  ghost_whisperer: {
    slug: "ghost_whisperer",
    name: "Ghost Whisperer",
    description: "Revived an abandoned repo with a friend",
    icon: "👻",
  },
  night_owls: {
    slug: "night_owls",
    name: "Night Owls",
    description: "Both commit between 11pm – 2am",
    icon: "🦉",
  },
  challenge_complete: {
    slug: "challenge_complete",
    name: "Challenge Complete",
    description: "Finished a build-together room",
    icon: "🏆",
  },
};
