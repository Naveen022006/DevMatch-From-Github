"use client";

import type { DeveloperMatch } from "@/types";
import { useState } from "react";
import { ProjectIdeasPanel } from "@/components/ProjectIdeasPanel";

type RequestStatus = "none" | "pending" | "accepted" | "declined";

interface MatchCardProps {
  match: DeveloperMatch;
  requestStatus?: RequestStatus;
  onSendRequest?: (userId: string) => void | Promise<void>;
  onMessage?: (userId: string, username: string, avatarUrl: string) => void;
}

export function MatchCard({ match, requestStatus = "none", onSendRequest, onMessage }: MatchCardProps) {
  const { profile, compatibility } = match;
  const score = compatibility.total;
  const [localStatus, setLocalStatus] = useState<RequestStatus>(requestStatus);
  const [sending, setSending] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);

  const scoreColor =
    score >= 90 ? "#22d3ee" : score >= 75 ? "#a78bfa" : score >= 60 ? "#34d399" : "#94a3b8";

  const bars: { label: string; value: number }[] = [
    { label: "Technical", value: compatibility.technical_synergy },
    { label: "Learning",  value: compatibility.learning_potential },
    { label: "Collab",    value: compatibility.collaboration_style },
    { label: "Vibe",      value: compatibility.personality_fit },
  ];

  const effectiveStatus: RequestStatus =
    localStatus !== "none" && localStatus !== requestStatus ? localStatus : requestStatus;

  const handleSendRequest = async () => {
    if (!onSendRequest || effectiveStatus === "pending" || effectiveStatus === "accepted") return;
    setSending(true);
    await onSendRequest(profile.id);
    setLocalStatus("pending");
    setSending(false);
  };

  const identityColors: Record<string, string> = {
    builder: "#f59e0b", learner: "#34d399", maintainer: "#60a5fa", explorer: "#f472b6",
  };
  const identityColor = identityColors[profile.coding_identity] ?? scoreColor;

  return (
    <div style={{
      background: "rgba(13,13,26,0.95)",
      border: `1px solid ${scoreColor}33`,
      borderRadius: "20px",
      padding: "22px",
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      boxShadow: `0 0 32px ${scoreColor}0f, inset 0 1px 0 rgba(255,255,255,0.05)`,
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 40px ${scoreColor}18, inset 0 1px 0 rgba(255,255,255,0.05)`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 32px ${scoreColor}0f, inset 0 1px 0 rgba(255,255,255,0.05)`; }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatar_url}
          alt={profile.github_username}
          style={{ width: "52px", height: "52px", borderRadius: "50%", flexShrink: 0, border: `2px solid ${scoreColor}55` }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.display_name ?? profile.github_username}
          </div>
          <div style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            @{profile.github_username}
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", textTransform: "capitalize" }}>
            {profile.experience_level} · {profile.coding_identity}
          </div>
        </div>
        {/* Score badge */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "10px 16px", borderRadius: "14px", flexShrink: 0,
          background: `${scoreColor}15`, border: `1px solid ${scoreColor}44`,
        }}>
          <span style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1, color: scoreColor }}>
            {score}
          </span>
          <span style={{ fontSize: "9px", color: "#64748b", marginTop: "3px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            score
          </span>
        </div>
      </div>

      {/* ── Tags ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <span style={{
          fontSize: "11px", padding: "3px 11px", borderRadius: "20px", fontWeight: 600,
          textTransform: "capitalize", background: `${identityColor}18`,
          border: `1px solid ${identityColor}33`, color: identityColor,
        }}>
          {profile.coding_identity}
        </span>
        {profile.languages.slice(0, 4).map((lang) => (
          <span key={lang} style={{
            fontSize: "11px", padding: "3px 11px", borderRadius: "20px", fontWeight: 500,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
          }}>
            {lang}
          </span>
        ))}
      </div>

      {/* ── Reason ── */}
      <p style={{
        margin: 0, fontSize: "13px", color: "#94a3b8", lineHeight: 1.65,
        borderLeft: `2px solid ${scoreColor}55`, paddingLeft: "14px",
      }}>
        {compatibility.reason}
      </p>

      {/* ── Score bars ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {bars.map((bar) => (
          <div key={bar.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "11px", color: "#64748b", width: "58px", flexShrink: 0, fontWeight: 500 }}>
              {bar.label}
            </span>
            <div style={{ flex: 1, height: "6px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "4px",
                width: `${bar.value}%`,
                background: `linear-gradient(90deg, ${scoreColor}66, ${scoreColor})`,
                transition: "width 0.6s ease-out",
              }} />
            </div>
            <span style={{ fontSize: "11px", color: "#64748b", width: "28px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {bar.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
        {onSendRequest && (
          <button
            onClick={handleSendRequest}
            disabled={sending || effectiveStatus === "pending" || effectiveStatus === "accepted"}
            style={{
              flex: 1, minWidth: "100px", padding: "11px 20px", borderRadius: "12px",
              fontSize: "14px", fontWeight: 700, cursor: sending || effectiveStatus === "pending" || effectiveStatus === "accepted" ? "default" : "pointer",
              transition: "all 0.15s",
              ...(effectiveStatus === "accepted"
                ? { background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }
                : effectiveStatus === "pending"
                ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b" }
                : { background: `linear-gradient(135deg, ${scoreColor}25, ${scoreColor}18)`, border: `1px solid ${scoreColor}55`, color: scoreColor,
                    boxShadow: `0 0 20px ${scoreColor}20` }),
            }}
          >
            {sending ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ width: 13, height: 13, border: `2px solid ${scoreColor}44`, borderTopColor: scoreColor, borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Sending…
              </span>
            ) : effectiveStatus === "pending" ? "⏳ Pending…"
              : effectiveStatus === "accepted" ? "✓ Connected"
              : "Send Request →"}
          </button>
        )}

        {onMessage && effectiveStatus === "accepted" && (
          <button
            onClick={() => onMessage(profile.id, profile.github_username, profile.avatar_url)}
            style={{
              padding: "11px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
            }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#e2e8f0"; }}
            onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            💬 Message
          </button>
        )}

        {/* Project Ideas toggle */}
        <button
          onClick={() => setShowIdeas((v) => !v)}
          style={{
            padding: "11px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s", flexShrink: 0, border: "none",
            ...(showIdeas
              ? { background: `${scoreColor}22`, color: scoreColor, boxShadow: `0 0 14px ${scoreColor}18` }
              : { background: "rgba(255,255,255,0.05)", color: "#64748b" }),
          }}
          onMouseOver={e => { if (!showIdeas) { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#94a3b8"; } }}
          onMouseOut={e => { if (!showIdeas) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#64748b"; } }}
          title="See AI-generated project ideas"
        >
          💡 Ideas
        </button>
      </div>

      {/* ── Project Ideas Panel ── */}
      {showIdeas && (
        <ProjectIdeasPanel
          otherUserId={profile.id}
          otherUsername={profile.github_username}
          accentColor={scoreColor}
        />
      )}
    </div>
  );
}
