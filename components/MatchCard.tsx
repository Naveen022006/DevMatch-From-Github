"use client";

import type { DeveloperMatch } from "@/types";
import { useState } from "react";

interface MatchCardProps {
  match: DeveloperMatch;
  onConnect?: (userId: string) => void | Promise<void>;
  onMessage?: (userId: string, username: string, avatarUrl: string) => void;
}

export function MatchCard({ match, onConnect, onMessage }: MatchCardProps) {
  const { profile, compatibility } = match;
  const score = compatibility.total;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const scoreColor =
    score >= 90 ? "#22d3ee" : score >= 75 ? "#a78bfa" : score >= 60 ? "#34d399" : "#94a3b8";

  const bars: { label: string; value: number }[] = [
    { label: "Technical", value: compatibility.technical_synergy },
    { label: "Learning", value: compatibility.learning_potential },
    { label: "Collab", value: compatibility.collaboration_style },
    { label: "Vibe", value: compatibility.personality_fit },
  ];

  const handleConnect = async () => {
    if (!onConnect || connected) return;
    setConnecting(true);
    await onConnect(profile.id);
    setConnected(true);
    setConnecting(false);
  };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-0.5 animate-fade-up"
      style={{
        background: "rgba(13,13,26,0.9)",
        border: `1px solid ${scoreColor}33`,
        boxShadow: `0 0 28px ${scoreColor}0f, 0 1px 0 rgba(255,255,255,0.05) inset`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatar_url}
          alt={profile.github_username}
          className="w-12 h-12 rounded-full shrink-0"
          style={{ border: `2px solid ${scoreColor}55` }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate text-sm">
            {profile.display_name ?? profile.github_username}
          </p>
          <p className="text-xs text-slate-500 font-mono truncate">
            @{profile.github_username}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {profile.experience_level} · {profile.coding_identity}
          </p>
        </div>
        {/* Score badge */}
        <div
          className="flex flex-col items-center px-3.5 py-2 rounded-xl shrink-0"
          style={{
            background: `${scoreColor}15`,
            border: `1px solid ${scoreColor}44`,
          }}
        >
          <span className="text-2xl font-bold leading-none" style={{ color: scoreColor }}>
            {score}
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5 tracking-wider uppercase">match</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        <Tag label={profile.coding_identity} color={scoreColor} />
        {profile.languages.slice(0, 4).map((lang) => (
          <Tag key={lang} label={lang} />
        ))}
      </div>

      {/* Reason */}
      <p className="text-sm text-slate-400 leading-relaxed border-l-2 pl-3" style={{ borderColor: `${scoreColor}55` }}>
        {compatibility.reason}
      </p>

      {/* Score bars */}
      <div className="space-y-2.5">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="text-[11px] text-slate-600 w-14 shrink-0 font-medium">
              {bar.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full bar-grow"
                style={{
                  "--bar-w": `${bar.value}%`,
                  background: `linear-gradient(90deg, ${scoreColor}66, ${scoreColor})`,
                } as React.CSSProperties}
              />
            </div>
            <span className="text-[11px] text-slate-600 w-7 text-right tabular-nums">
              {bar.value}
            </span>
          </div>
        ))}
      </div>

      {/* Connect + Message */}
      <div style={{ display: "flex", gap: "8px" }}>
        {onConnect && (
          <button
            onClick={handleConnect}
            disabled={connecting || connected}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:cursor-default"
            style={
              connected
                ? { background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }
                : {
                    background: `linear-gradient(135deg, ${scoreColor}22, ${scoreColor}15)`,
                    border: `1px solid ${scoreColor}44`,
                    color: scoreColor,
                  }
            }
          >
            {connecting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" style={{ width: "14px", height: "14px" }} />
                Connecting…
              </span>
            ) : connected ? (
              "✓ Connected"
            ) : (
              "Connect →"
            )}
          </button>
        )}
        {onMessage && (
          <button
            onClick={() => onMessage(profile.id, profile.github_username, profile.avatar_url)}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#e2e8f0"; }}
            onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            💬 Message
          </button>
        )}
      </div>
    </div>
  );
}

function Tag({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="text-[11px] px-2.5 py-0.5 rounded-full capitalize font-medium"
      style={
        color
          ? { background: `${color}18`, border: `1px solid ${color}33`, color }
          : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }
      }
    >
      {label}
    </span>
  );
}
