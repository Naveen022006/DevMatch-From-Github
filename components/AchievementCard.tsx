"use client";

import type { UserAchievement } from "@/types";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import { useEffect, useState } from "react";

interface AchievementCardProps {
  achievement: UserAchievement;
  isNew?: boolean;
  index?: number;
}

export function AchievementCard({ achievement, isNew, index = 0 }: AchievementCardProps) {
  const [visible, setVisible] = useState(!isNew);
  const def = ACHIEVEMENTS[achievement.achievement_slug];

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setVisible(true), 80 + index * 60);
      return () => clearTimeout(t);
    }
  }, [isNew, index]);

  return (
    <div
      className="rounded-2xl p-4 flex gap-4 items-start transition-all duration-500"
      style={{
        background: "rgba(13,13,26,0.9)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
      }}
    >
      {/* Icon */}
      <div
        className="text-2xl w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: "rgba(124,58,237,0.12)",
          border: "1px solid rgba(124,58,237,0.22)",
        }}
      >
        {def?.icon ?? "🏅"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-white text-sm">
            {def?.name ?? achievement.achievement_slug}
          </span>
          {isNew && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold tracking-wider uppercase"
              style={{
                background: "rgba(124,58,237,0.2)",
                border: "1px solid rgba(124,58,237,0.35)",
                color: "#c4b5fd",
              }}
            >
              New
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          {achievement.unlock_message}
        </p>
        <p className="text-[11px] text-slate-600 mt-2">
          {new Date(achievement.unlocked_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-xs w-full">
      {achievements.map((a, i) => {
        const def = ACHIEVEMENTS[a.achievement_slug];
        return (
          <div
            key={a.id}
            className="rounded-2xl p-4 flex items-center gap-3 animate-slide-up"
            style={{
              animationDelay: `${i * 80}ms`,
              background: "rgba(13,13,30,0.95)",
              border: "1px solid rgba(124,58,237,0.35)",
              boxShadow: "0 0 32px rgba(124,58,237,0.2), 0 4px 24px rgba(0,0,0,0.5)",
              backdropFilter: "blur(16px)",
            }}
          >
            <span className="text-2xl shrink-0">{def?.icon ?? "🏅"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-violet-400 font-semibold tracking-wider uppercase">
                Achievement Unlocked!
              </p>
              <p className="text-sm text-white font-semibold truncate">
                {def?.name ?? a.achievement_slug}
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="text-slate-600 hover:text-slate-300 transition-colors text-lg shrink-0 w-6 h-6 flex items-center justify-center rounded"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
