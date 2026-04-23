import type { UserProfile, SkillBadge } from "@/types";

function isNightCoder(peakHours: string): boolean {
  return /11\s*pm|23:00|midnight|12\s*am|1\s*am|2\s*am|3\s*am|4\s*am|0[0-4]:/i.test(
    peakHours ?? ""
  );
}

export function computeSkillBadges(profile: UserProfile): SkillBadge[] {
  const badges: SkillBadge[] = [];

  // Open Source Contributor — collaboration style is "contributor"
  if (profile.collaboration_style === "contributor") {
    badges.push({
      id: "open-source",
      name: "Open Source Contributor",
      icon: "🔀",
      description: "Actively contributes PRs to open source projects and other repos",
      color: "#34d399",
    });
  }

  // Night Coder — peak hours are midnight–4am
  if (isNightCoder(profile.peak_hours ?? "")) {
    badges.push({
      id: "night-coder",
      name: "Night Coder",
      icon: "🌙",
      description: `Most productive between midnight and 4am (peak: ${profile.peak_hours})`,
      color: "#818cf8",
    });
  }

  // Polyglot — 5+ languages
  if ((profile.languages ?? []).length >= 5) {
    badges.push({
      id: "polyglot",
      name: "Polyglot",
      icon: "🌐",
      description: `Codes in ${profile.languages.length} programming languages: ${profile.languages.slice(0, 5).join(", ")}`,
      color: "#f472b6",
    });
  }

  // Star Collector — total stars > 100
  if (profile.total_stars > 100) {
    badges.push({
      id: "star-collector",
      name: "Star Collector",
      icon: "⭐",
      description: `Earned ${profile.total_stars.toLocaleString()} GitHub stars across their repositories`,
      color: "#fbbf24",
    });
  }

  // Commit Streak Master — frequent commit style indicates sustained daily streaks
  if (profile.commit_style === "frequent") {
    badges.push({
      id: "streak-master",
      name: "Commit Streak Master",
      icon: "🔥",
      description: "Maintains a consistent daily commit streak — ships code every day",
      color: "#fb923c",
    });
  }

  return badges;
}
