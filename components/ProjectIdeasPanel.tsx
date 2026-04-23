"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectIdea } from "@/types";

interface Props {
  otherUserId: string;
  otherUsername: string;
  accentColor: string;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: "#34d399",
  intermediate: "#fbbf24",
  advanced: "#f87171",
};

export function ProjectIdeasPanel({ otherUserId, otherUsername, accentColor }: Props) {
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing ideas on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/project-ideas?otherUserId=${otherUserId}`);
        if (res.ok) {
          const json = await res.json();
          setIdeas(json.ideas ?? []);
          setSavedIndex(json.savedIdeaIndex ?? null);
        }
      } catch { /* non-critical */ }
      setLoading(false);
    };
    load();
  }, [otherUserId]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/project-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setIdeas(json.ideas ?? []);
      setSavedIndex(null);
      setDismissed(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate ideas");
    }
    setGenerating(false);
  }, [otherUserId]);

  const saveIdea = useCallback(async (index: number) => {
    const next = savedIndex === index ? null : index;
    setSavedIndex(next);
    try {
      await fetch("/api/project-ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId, savedIdeaIndex: next }),
      });
    } catch { /* non-critical */ }
  }, [otherUserId, savedIndex]);

  const dismiss = useCallback((index: number) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const templateUrl = (idea: ProjectIdea) => {
    const q = encodeURIComponent(`${idea.techStack[0] ?? ""} starter template`);
    return `https://github.com/search?q=${q}&type=repositories`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    marginTop: "16px",
    padding: "18px",
    borderRadius: "16px",
    background: `${accentColor}08`,
    border: `1px solid ${accentColor}22`,
  };

  if (loading) {
    return (
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <span style={{ fontSize: "14px", color: accentColor, fontWeight: 700 }}>💡 Project Ideas</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "12px" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ideas.length > 0 ? "16px" : "12px" }}>
        <div>
          <span style={{ fontSize: "14px", fontWeight: 700, color: accentColor }}>💡 Project Ideas</span>
          {ideas.length > 0 && (
            <span style={{ fontSize: "11px", color: "#475569", marginLeft: "8px" }}>
              with @{otherUsername}
            </span>
          )}
        </div>
        {ideas.length > 0 && (
          <button
            onClick={generate}
            disabled={generating}
            style={{
              fontSize: "11px", padding: "4px 10px", borderRadius: "8px", border: "none",
              background: generating ? "rgba(255,255,255,0.04)" : `${accentColor}18`,
              color: generating ? "#475569" : accentColor,
              cursor: generating ? "not-allowed" : "pointer", fontWeight: 600,
            }}
          >
            {generating ? "Generating…" : "↻ Regenerate"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "10px 12px", borderRadius: "10px", marginBottom: "12px",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          fontSize: "12px", color: "#f87171",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Empty / Generate state */}
      {ideas.length === 0 && !generating && (
        <div style={{ textAlign: "center", padding: "20px 12px" }}>
          <p style={{ fontSize: "13px", color: "#475569", marginBottom: "14px", lineHeight: 1.6 }}>
            Let AI suggest 3 project ideas based on your combined skills and interests.
          </p>
          <button
            onClick={generate}
            style={{
              padding: "10px 22px", borderRadius: "12px", border: "none", fontWeight: 700,
              fontSize: "13px", cursor: "pointer",
              background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}22)`,
              boxShadow: `0 0 20px ${accentColor}18`,
              color: accentColor,
            }}
          >
            ✦ Generate Ideas
          </button>
        </div>
      )}

      {/* Generating spinner */}
      {generating && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 0" }}>
          <span style={{
            width: 16, height: 16, borderRadius: "50%",
            border: `2px solid ${accentColor}33`, borderTopColor: accentColor,
            display: "inline-block", animation: "spin 0.8s linear infinite", flexShrink: 0,
          }} />
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            AI is brainstorming project ideas for you and @{otherUsername}…
          </span>
        </div>
      )}

      {/* Idea cards */}
      {!generating && ideas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Saved banner */}
          {savedIndex !== null && !dismissed.has(savedIndex) && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
              fontSize: "12px", color: "#34d399", display: "flex", alignItems: "center", gap: "8px",
            }}>
              🚀 <strong>{ideas[savedIndex]?.title}</strong> — marked as "We're building this!"
            </div>
          )}

          {ideas.map((idea, i) => {
            const isDismissed = dismissed.has(i);
            const isSaved = savedIndex === i;
            const dc = DIFFICULTY_COLOR[idea.difficulty] ?? "#94a3b8";
            return (
              <div
                key={i}
                style={{
                  borderRadius: "14px", padding: "16px",
                  background: isSaved
                    ? "rgba(52,211,153,0.07)"
                    : isDismissed
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(13,13,26,0.95)",
                  border: `1px solid ${
                    isSaved ? "rgba(52,211,153,0.25)" : isDismissed ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)"
                  }`,
                  opacity: isDismissed ? 0.45 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "3px" }}>
                      {idea.title}
                      {isSaved && <span style={{ marginLeft: "8px", fontSize: "12px" }}>🚀</span>}
                    </div>
                    <span style={{
                      fontSize: "10px", padding: "2px 8px", borderRadius: "4px", fontWeight: 700,
                      textTransform: "capitalize", background: `${dc}18`,
                      border: `1px solid ${dc}33`, color: dc,
                    }}>
                      {idea.difficulty}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>
                  {idea.description}
                </p>

                {/* Tech stack */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "12px" }}>
                  {idea.techStack.map((tech) => (
                    <span key={tech} style={{
                      fontSize: "11px", padding: "2px 8px", borderRadius: "20px",
                      background: `${accentColor}12`, border: `1px solid ${accentColor}28`,
                      color: accentColor, fontWeight: 500,
                    }}>
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={() => saveIdea(i)}
                    style={{
                      padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                      border: "none", cursor: "pointer", transition: "all 0.12s",
                      ...(isSaved
                        ? { background: "rgba(52,211,153,0.15)", color: "#34d399" }
                        : { background: `${accentColor}18`, color: accentColor }),
                    }}
                    onMouseOver={e => { if (!isSaved) e.currentTarget.style.background = `${accentColor}28`; }}
                    onMouseOut={e => { if (!isSaved) e.currentTarget.style.background = `${accentColor}18`; }}
                  >
                    {isSaved ? "✓ Building this!" : "🚀 We're building this!"}
                  </button>

                  <a
                    href={templateUrl(idea)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      textDecoration: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#64748b",
                    }}
                    onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#94a3b8"; }}
                    onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#64748b"; }}
                  >
                    ↗ GitHub templates
                  </a>

                  <button
                    onClick={() => dismiss(i)}
                    style={{
                      marginLeft: "auto", padding: "5px 10px", borderRadius: "8px", fontSize: "11px",
                      border: "none", background: "none", color: "#334155", cursor: "pointer",
                    }}
                    onMouseOver={e => { e.currentTarget.style.color = "#475569"; }}
                    onMouseOut={e => { e.currentTarget.style.color = "#334155"; }}
                  >
                    {isDismissed ? "Restore" : "Dismiss"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
