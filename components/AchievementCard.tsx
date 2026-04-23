"use client";

import type { UserAchievement, AchievementSlug } from "@/types";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import { useEffect, useState } from "react";

// Per-achievement color themes
const THEMES: Record<AchievementSlug, { color: string; glow: string; bg: string; border: string }> = {
  first_connection: {
    color: "#34d399",
    glow: "rgba(52,211,153,0.35)",
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.25)",
  },
  code_twins: {
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.35)",
    bg: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.25)",
  },
  night_owls: {
    color: "#818cf8",
    glow: "rgba(129,140,248,0.35)",
    bg: "rgba(129,140,248,0.08)",
    border: "rgba(129,140,248,0.25)",
  },
  ghost_whisperer: {
    color: "#22d3ee",
    glow: "rgba(34,211,238,0.35)",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.25)",
  },
  challenge_complete: {
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.35)",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.25)",
  },
};

interface AchievementCardProps {
  achievement: UserAchievement;
  isNew?: boolean;
  index?: number;
}

export function AchievementCard({ achievement, isNew, index = 0 }: AchievementCardProps) {
  const [visible, setVisible] = useState(!isNew);
  const [expanded, setExpanded] = useState(false);
  const def = ACHIEVEMENTS[achievement.achievement_slug];
  const theme = THEMES[achievement.achievement_slug] ?? {
    color: "#94a3b8",
    glow: "rgba(148,163,184,0.2)",
    bg: "rgba(148,163,184,0.06)",
    border: "rgba(148,163,184,0.2)",
  };

  // Cap message at ~120 chars for the collapsed view
  const msg = achievement.unlock_message ?? "";
  const isLong = msg.length > 120;
  const displayMsg = expanded || !isLong ? msg : msg.slice(0, 120).trimEnd() + "…";

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setVisible(true), 80 + index * 60);
      return () => clearTimeout(t);
    }
  }, [isNew, index]);

  const unlockedDate = new Date(achievement.unlocked_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow blur behind icon */}
      <div
        style={{
          position: "absolute",
          top: -20,
          left: -20,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: theme.glow,
          filter: "blur(32px)",
          pointerEvents: "none",
        }}
      />

      {/* Icon badge */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          flexShrink: 0,
          background: `linear-gradient(135deg, ${theme.bg}, rgba(0,0,0,0.3))`,
          border: `1.5px solid ${theme.border}`,
          boxShadow: `0 0 16px ${theme.glow}`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {def?.icon ?? "🏅"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>
            {def?.name ?? achievement.achievement_slug}
          </span>
          {isNew && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 7px",
                borderRadius: 20,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: `${theme.color}22`,
                border: `1px solid ${theme.color}55`,
                color: theme.color,
              }}
            >
              New
            </span>
          )}
        </div>

        {def?.description && (
          <div style={{ fontSize: 11, color: theme.color, fontWeight: 500, marginBottom: 6, opacity: 0.9 }}>
            {def.description}
          </div>
        )}

        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65, margin: 0 }}>
          {displayMsg}
          {isLong && (
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{
                background: "none",
                border: "none",
                color: theme.color,
                fontSize: 12,
                cursor: "pointer",
                padding: "0 0 0 4px",
                fontWeight: 600,
              }}
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </p>

        <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>{unlockedDate}</div>
      </div>
    </div>
  );
}

/** Greyed-out card for achievements not yet unlocked */
export function LockedAchievementCard({ slug }: { slug: AchievementSlug }) {
  const def = ACHIEVEMENTS[slug];
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: "16px 20px",
        display: "flex",
        gap: 16,
        alignItems: "center",
        opacity: 0.45,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
          background: "rgba(255,255,255,0.04)",
          border: "1.5px solid rgba(255,255,255,0.08)",
          filter: "grayscale(1)",
        }}
      >
        {def?.icon ?? "🔒"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#64748b", marginBottom: 3 }}>
          {def?.name ?? slug}
        </div>
        <div style={{ fontSize: 12, color: "#475569" }}>{def?.description}</div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#334155",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20,
          padding: "3px 10px",
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        Locked
      </div>
    </div>
  );
}

/** Toast notification for freshly unlocked achievements */
export function AchievementToast({
  achievements,
  onDismiss,
}: {
  achievements: UserAchievement[];
  onDismiss: () => void;
}) {
  if (achievements.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50, display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, width: "100%" }}>
      {achievements.map((a, i) => {
        const def = ACHIEVEMENTS[a.achievement_slug];
        const theme = THEMES[a.achievement_slug];
        return (
          <div
            key={a.id}
            style={{
              animationDelay: `${i * 80}ms`,
              background: "rgba(13,13,30,0.97)",
              border: `1px solid ${theme?.border ?? "rgba(124,58,237,0.35)"}`,
              boxShadow: `0 0 32px ${theme?.glow ?? "rgba(124,58,237,0.2)"}, 0 4px 24px rgba(0,0,0,0.5)`,
              backdropFilter: "blur(16px)",
              borderRadius: 16,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 26, flexShrink: 0 }}>{def?.icon ?? "🏅"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, color: theme?.color ?? "#c4b5fd", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 2px" }}>
                Achievement Unlocked!
              </p>
              <p style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {def?.name ?? a.achievement_slug}
              </p>
            </div>
            <button
              onClick={onDismiss}
              style={{ color: "#475569", background: "none", border: "none", fontSize: 18, cursor: "pointer", flexShrink: 0, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
