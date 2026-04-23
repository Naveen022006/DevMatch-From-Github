"use client";

import { useState } from "react";
import type { SkillBadge } from "@/types";

interface Props {
  badges: SkillBadge[];
  size?: "sm" | "md";
}

export function SkillBadges({ badges, size = "md" }: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  if (badges.length === 0) return null;

  const isSmall = size === "sm";

  return (
    <div style={{ position: "relative" }}>
      {/* Section label */}
      <div style={{
        fontSize: "10px", color: "#334155", letterSpacing: "2px",
        textTransform: "uppercase", marginBottom: "8px", fontWeight: 600,
      }}>
        Skill Badges
      </div>

      {/* Badge row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
        {badges.map((badge) => (
          <button
            key={badge.id}
            onMouseEnter={() => setTooltip(badge.id)}
            onMouseLeave={() => setTooltip(null)}
            onFocus={() => setTooltip(badge.id)}
            onBlur={() => setTooltip(null)}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: isSmall ? "5px" : "6px",
              padding: isSmall ? "3px 10px" : "4px 12px",
              borderRadius: "20px",
              fontSize: isSmall ? "11px" : "12px",
              fontWeight: 600,
              cursor: "default",
              border: "none",
              background: `${badge.color}15`,
              outline: `1px solid ${badge.color}35`,
              color: badge.color,
              transition: "background 0.15s, box-shadow 0.15s",
              boxShadow: tooltip === badge.id ? `0 0 12px ${badge.color}30` : "none",
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = `${badge.color}25`;
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = `${badge.color}15`;
            }}
          >
            <span style={{ fontSize: isSmall ? "12px" : "13px", lineHeight: 1 }}>
              {badge.icon}
            </span>
            <span>{badge.name}</span>

            {/* Tooltip */}
            {tooltip === badge.id && (
              <div style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: "50%",
                transform: "translateX(-50%)",
                width: "220px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(13,13,26,0.97)",
                border: `1px solid ${badge.color}44`,
                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 20px ${badge.color}18`,
                zIndex: 50,
                pointerEvents: "none",
              }}>
                {/* Arrow */}
                <div style={{
                  position: "absolute",
                  bottom: "-5px",
                  left: "50%",
                  transform: "translateX(-50%) rotate(45deg)",
                  width: "8px",
                  height: "8px",
                  background: "rgba(13,13,26,0.97)",
                  border: `1px solid ${badge.color}44`,
                  borderTop: "none",
                  borderLeft: "none",
                }} />
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px",
                }}>
                  <span style={{ fontSize: "14px" }}>{badge.icon}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: badge.color }}>
                    {badge.name}
                  </span>
                </div>
                <p style={{
                  margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: 1.55,
                }}>
                  {badge.description}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
