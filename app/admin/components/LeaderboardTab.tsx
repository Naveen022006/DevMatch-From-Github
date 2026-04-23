"use client";

import { useState } from "react";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";
import type { Challenge } from "@/types/admin";

interface Props {
  entries: LeaderboardEntry[];
  challenges: Challenge[];
  loading: boolean;
  onRefresh: () => void;
}

export default function LeaderboardTab({ entries, challenges, loading, onRefresh }: Props) {
  const [resetting, setResetting] = useState<string | null>(null); // "global" or challengeId
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const medals = ["🥇", "🥈", "🥉"];
  const medalColors = ["#fbbf24", "#94a3b8", "#cd7c2f"];

  const fmtHrs = (h: number | null) => {
    if (h === null) return "—";
    if (h < 1) return `${Math.round(h * 60)}m`;
    return `${h.toFixed(1)}h`;
  };

  const handleReset = async (challengeId?: string) => {
    const key = challengeId ?? "global";
    if (!confirm(challengeId
      ? `Reset leaderboard for this challenge? Previous solves will be excluded from rankings.`
      : `Reset the GLOBAL leaderboard? All previous solves will be excluded from rankings.`
    )) return;

    setResetting(key);
    setResetMsg(null);
    try {
      const res = await fetch("/api/admin/leaderboard/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challengeId ? { challengeId } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResetMsg(challengeId ? "Challenge leaderboard reset." : "Global leaderboard reset.");
      onRefresh();
    } catch (e) {
      setResetMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setResetting(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9" }}>Challenge Leaderboard</div>
          <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
            {loading ? "Loading…" : `${entries.length} ranked developer${entries.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={onRefresh} disabled={loading} style={{ padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer" }}>
            ↻ Refresh
          </button>
          <button
            onClick={() => handleReset()}
            disabled={resetting !== null}
            style={{ padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: resetting !== null ? "not-allowed" : "pointer" }}
          >
            {resetting === "global" ? "Resetting…" : "Reset Global"}
          </button>
        </div>
      </div>

      {resetMsg && (
        <div style={{ padding: "10px 14px", borderRadius: "10px", background: resetMsg.startsWith("Error") ? "rgba(239,68,68,0.08)" : "rgba(52,211,153,0.08)", border: `1px solid ${resetMsg.startsWith("Error") ? "rgba(239,68,68,0.25)" : "rgba(52,211,153,0.25)"}`, color: resetMsg.startsWith("Error") ? "#f87171" : "#34d399", fontSize: "13px" }}>
          {resetMsg}
        </div>
      )}

      {/* Leaderboard */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {loading && [1, 2, 3].map(i => (
          <div key={i} style={{ height: "68px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", animation: "shimmer 1.5s ease-in-out infinite" }} />
        ))}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#475569", fontSize: "13px" }}>
            No entries yet. Run some challenges to populate this.
          </div>
        )}

        {entries.map((e) => {
          const isMedal = e.rank <= 3;
          const mc = isMedal ? medalColors[e.rank - 1] : null;
          return (
            <div key={e.user_id} style={{
              background: "rgba(13,13,26,0.95)",
              border: `1px solid ${mc ? `${mc}33` : "rgba(255,255,255,0.07)"}`,
              borderRadius: "14px", padding: "12px 16px",
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <div style={{ width: "26px", textAlign: "center", flexShrink: 0 }}>
                {isMedal
                  ? <span style={{ fontSize: "18px" }}>{medals[e.rank - 1]}</span>
                  : <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>#{e.rank}</span>}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.avatar_url} alt="" style={{ width: "34px", height: "34px", borderRadius: "50%", border: `1.5px solid ${mc ? `${mc}55` : "rgba(255,255,255,0.1)"}`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/dev/${e.github_username}`} style={{ fontWeight: 700, fontSize: "13px", color: "#f1f5f9", textDecoration: "none" }}>
                  {e.display_name ?? e.github_username}
                </a>
                <div style={{ display: "flex", gap: "6px", marginTop: "3px", flexWrap: "wrap" }}>
                  {e.easy_count > 0 && <span style={{ fontSize: "10px", color: "#34d399" }}>{e.easy_count}E</span>}
                  {e.medium_count > 0 && <span style={{ fontSize: "10px", color: "#fbbf24" }}>{e.medium_count}M</span>}
                  {e.hard_count > 0 && <span style={{ fontSize: "10px", color: "#f87171" }}>{e.hard_count}H</span>}
                  {e.streak > 0 && <span style={{ fontSize: "10px", color: "#a78bfa" }}>🔥{e.streak}d</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: mc ?? "#64748b", lineHeight: 1 }}>{e.total_completed}</div>
                <div style={{ fontSize: "10px", color: "#334155", marginTop: "2px" }}>
                  fastest: {fmtHrs(e.fastest_hard_hrs ?? e.fastest_medium_hrs ?? e.fastest_easy_hrs)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-challenge reset */}
      {challenges.length > 0 && (
        <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "18px 20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>Reset per Challenge</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {challenges.map((c) => {
              const dc: Record<string, string> = { easy: "#34d399", medium: "#fbbf24", hard: "#f87171" };
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "13px", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{c.title}</span>
                    <span style={{ fontSize: "11px", color: dc[c.difficulty] ?? "#a78bfa", textTransform: "capitalize" }}>{c.difficulty}</span>
                  </div>
                  <button
                    onClick={() => handleReset(c.id)}
                    disabled={resetting !== null}
                    style={{ padding: "5px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: 600, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: resetting !== null ? "not-allowed" : "pointer", flexShrink: 0 }}
                  >
                    {resetting === c.id ? "…" : "Reset"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
