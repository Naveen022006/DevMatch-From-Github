"use client";

import type { AdminStats } from "@/types/admin";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";

const BG_CARD = "rgba(13,13,26,0.95)";
const BORDER = "rgba(255,255,255,0.09)";

interface Props {
  stats: AdminStats | null;
  loading: boolean;
}

const statDefs = [
  { key: "totalUsers", icon: "◈", label: "Total Users", color: "#a78bfa" },
  { key: "totalMatches", icon: "⬡", label: "Total Matches", color: "#34d399" },
  { key: "totalAchievements", icon: "✦", label: "Achievements Earned", color: "#fbbf24" },
  { key: "totalStoryCards", icon: "⟡", label: "Story Cards", color: "#f472b6" },
  { key: "newUsersThisWeek", icon: "⊕", label: "New This Week", color: "#22d3ee" },
  { key: "avgCompatibilityScore", icon: "◎", label: "Avg Match Score", color: "#a78bfa" },
  { key: "mostPopularCodingIdentity", icon: "◆", label: "Top Identity", color: "#34d399", capitalize: true },
  { key: "mostPopularAchievement", icon: "🏅", label: "Top Achievement", color: "#fbbf24", achievement: true },
] as const;

export default function OverviewTab({ stats, loading }: Props) {
  return (
    <div>
      <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
        Platform Overview
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {statDefs.map((def) => {
          if (loading || !stats) {
            return (
              <div
                key={def.key}
                className="skeleton"
                style={{ height: 110, borderRadius: 12 }}
              />
            );
          }
          let value: string | number = stats[def.key] as string | number;
          if (def.achievement && typeof value === "string" && value !== "—") {
            const achiev = ACHIEVEMENTS[value as keyof typeof ACHIEVEMENTS];
            value = achiev ? `${achiev.icon} ${achiev.name}` : value;
          } else if (def.capitalize && typeof value === "string") {
            value = value.charAt(0).toUpperCase() + value.slice(1);
          }
          return (
            <div
              key={def.key}
              style={{
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22, color: def.color }}>{def.icon}</span>
                <span style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {def.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: typeof value === "string" && value.length > 12 ? 18 : 28,
                  fontWeight: 800,
                  color: def.color,
                  lineHeight: 1.2,
                }}
              >
                {typeof value === "number" && def.key === "avgCompatibilityScore"
                  ? `${value}%`
                  : value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
