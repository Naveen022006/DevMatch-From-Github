"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@/types";

interface Props {
  githubUsername: string;
  avatarUrl: string;
  initialProfile: UserProfile | null;
  onComplete: (profile: UserProfile) => void;
  onSkip: () => void;
}

type Step = 1 | 2 | 3;

const IDENTITY_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  builder: { color: "#f59e0b", icon: "⚒", label: "The Builder" },
  learner:  { color: "#34d399", icon: "◈", label: "The Learner" },
  maintainer: { color: "#60a5fa", icon: "⬡", label: "The Maintainer" },
  explorer: { color: "#f472b6", icon: "✦", label: "The Explorer" },
};

const STEP_LABELS = ["Analyzing", "Your Identity", "Find Matches"];

export function OnboardingModal({ githubUsername, avatarUrl, initialProfile, onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>(initialProfile ? 2 : 1);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);

  // Step 1 analyze state
  const [analyzePhase, setAnalyzePhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [analyzeStep, setAnalyzeStep] = useState(0); // 0=fetching 1=analyzing 2=done
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Fire analysis automatically on step 1 mount
  useEffect(() => {
    if (step !== 1 || analyzePhase !== "idle") return;
    runAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const runAnalysis = async () => {
    setAnalyzePhase("running");
    setAnalyzeError(null);
    setAnalyzeStep(0);

    // Advance visual progress after a short delay
    const t1 = setTimeout(() => setAnalyzeStep(1), 2200);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      clearTimeout(t1);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnalyzeStep(2);
      setAnalyzePhase("done");
      setProfile(json.profile);
      // Auto-advance to step 2 after brief pause
      setTimeout(() => setStep(2), 900);
    } catch (e) {
      clearTimeout(t1);
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      setAnalyzePhase("error");
    }
  };

  const markComplete = async () => {
    try {
      await fetch("/api/onboarding/complete", { method: "PATCH" });
    } catch { /* non-critical */ }
  };

  const handleFindMatches = async () => {
    await markComplete();
    if (profile) onComplete(profile);
  };

  const handleSkip = async () => {
    await markComplete();
    onSkip();
  };

  const identity = profile ? (IDENTITY_CONFIG[profile.coding_identity] ?? IDENTITY_CONFIG.builder) : null;

  // ── Styles ────────────────────────────────────────────────────────────────────

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "20px",
  };

  const modal: React.CSSProperties = {
    background: "#0a0a18",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 0 80px rgba(124,58,237,0.2), 0 20px 60px rgba(0,0,0,0.7)",
    overflow: "hidden",
  };

  return (
    <div style={overlay}>
      <div style={modal}>

        {/* ── Progress bar ── */}
        <div style={{ padding: "20px 28px 0" }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
            {STEP_LABELS.map((label, i) => {
              const stepNum = (i + 1) as Step;
              const done = step > stepNum;
              const active = step === stepNum;
              return (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{
                    height: "3px", borderRadius: "2px",
                    background: done || active ? "rgba(124,58,237,0.9)" : "rgba(255,255,255,0.1)",
                    transition: "background 0.4s",
                  }} />
                  <span style={{
                    fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: active ? "#c4b5fd" : done ? "#6d52c4" : "#334155",
                    transition: "color 0.3s",
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step content ── */}
        <div style={{ padding: "0 28px 28px" }}>

          {/* ── STEP 1: Analyzing ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: "8px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt={githubUsername} style={{ width: "64px", height: "64px", borderRadius: "50%", border: "3px solid rgba(124,58,237,0.5)", marginBottom: "18px" }} />

              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9", marginBottom: "8px" }}>
                Welcome, @{githubUsername}! 👋
              </h2>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, marginBottom: "28px", maxWidth: "380px" }}>
                DevMatch is analyzing your GitHub to build your developer identity. This only takes a moment.
              </p>

              {/* Progress steps */}
              <div style={{
                width: "100%", padding: "20px", borderRadius: "14px",
                background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)",
                marginBottom: "24px",
              }}>
                {[
                  "Fetching your GitHub data…",
                  "AI is analyzing your coding style…",
                  "Building your developer identity…",
                ].map((label, i) => {
                  const done = analyzeStep > i;
                  const active = analyzeStep === i && analyzePhase === "running";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
                      <div style={{
                        width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", fontWeight: 700,
                        ...(done
                          ? { background: "rgba(52,211,153,0.2)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399" }
                          : active
                          ? { background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa" }
                          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#334155" }),
                      }}>
                        {done ? "✓" : active ? (
                          <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(167,139,250,0.4)", borderTopColor: "#a78bfa", display: "inline-block", animation: "ob-spin 0.8s linear infinite" }} />
                        ) : i + 1}
                      </div>
                      <span style={{
                        fontSize: "13px",
                        color: done ? "#34d399" : active ? "#c4b5fd" : "#334155",
                        transition: "color 0.3s",
                      }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {analyzePhase === "done" && (
                <div style={{ fontSize: "13px", color: "#34d399", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>✓</span> Analysis complete — loading your identity…
                </div>
              )}

              {analyzeError && (
                <div style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "13px", color: "#f87171", marginBottom: "16px" }}>
                  {analyzeError}
                </div>
              )}

              {analyzePhase === "error" && (
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <button
                    onClick={runAnalysis}
                    style={{
                      flex: 1, padding: "11px", borderRadius: "12px", fontWeight: 700, fontSize: "14px",
                      border: "none", cursor: "pointer",
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff",
                      boxShadow: "0 0 20px rgba(124,58,237,0.3)",
                    }}
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleSkip}
                    style={{ padding: "11px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: 600, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", cursor: "pointer" }}
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Your Identity ── */}
          {step === 2 && profile && identity && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#f1f5f9", marginBottom: "4px" }}>
                  Here's what we found about you ✦
                </h2>
                <p style={{ fontSize: "13px", color: "#475569" }}>
                  Your developer identity, powered by AI analysis of your GitHub.
                </p>
              </div>

              {/* Identity card */}
              <div style={{
                padding: "20px", borderRadius: "16px",
                background: `${identity.color}0f`, border: `1px solid ${identity.color}33`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "14px", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "22px", background: `${identity.color}20`,
                    border: `1px solid ${identity.color}44`,
                  }}>
                    {identity.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: identity.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3px" }}>
                      Developer Identity
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#f1f5f9" }}>
                      {identity.label}
                    </div>
                  </div>
                  <div style={{
                    marginLeft: "auto", padding: "4px 12px", borderRadius: "20px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "11px", color: "#94a3b8", textTransform: "capitalize", fontWeight: 600,
                  }}>
                    {profile.experience_level}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", lineHeight: 1.65 }}>
                  {profile.human_description}
                </p>
              </div>

              {/* Passion areas */}
              {profile.passion_areas?.length > 0 && (
                <div>
                  <div style={{ fontSize: "11px", color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                    Passion Areas
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {profile.passion_areas.map(area => (
                      <span key={area} style={{
                        fontSize: "12px", padding: "4px 13px", borderRadius: "20px",
                        background: `${identity.color}12`, border: `1px solid ${identity.color}28`, color: identity.color,
                      }}>
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Languages */}
              {profile.languages?.length > 0 && (
                <div>
                  <div style={{ fontSize: "11px", color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                    Top Languages
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {profile.languages.slice(0, 6).map(lang => (
                      <span key={lang} style={{
                        fontSize: "12px", padding: "4px 13px", borderRadius: "20px",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
                      }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div style={{ display: "flex", gap: "10px" }}>
                {[
                  { v: profile.total_repos, l: "Repos" },
                  { v: profile.total_stars, l: "Stars" },
                  { v: profile.total_commits_estimate, l: "Commits" },
                ].map(s => (
                  <div key={s.l} style={{
                    flex: 1, padding: "12px 10px", borderRadius: "12px", textAlign: "center",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9" }}>{s.v.toLocaleString()}</div>
                    <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                <button
                  onClick={() => setStep(3)}
                  style={{
                    flex: 1, padding: "12px", borderRadius: "12px", fontWeight: 700, fontSize: "14px",
                    border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff",
                    boxShadow: "0 0 24px rgba(124,58,237,0.35)",
                  }}
                >
                  Next →
                </button>
                <button
                  onClick={handleSkip}
                  style={{ padding: "12px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: 600, border: "1px solid rgba(255,255,255,0.09)", background: "transparent", color: "#475569", cursor: "pointer" }}
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Find Matches ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#f1f5f9", marginBottom: "4px" }}>
                  Find your first dev match 🤝
                </h2>
                <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.65 }}>
                  DevMatch uses AI to find developers who complement your skills and working style.
                </p>
              </div>

              {/* Feature cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { icon: "⬡", color: "#a78bfa", title: "AI Compatibility", desc: "Scored on technical synergy, learning potential, collaboration style, and personality fit" },
                  { icon: "💬", color: "#34d399", title: "Direct Messaging", desc: "Message your matches directly to discuss projects, collabs, and ideas" },
                  { icon: "💡", color: "#fbbf24", title: "Project Ideas", desc: "AI generates collaborative project ideas based on your combined tech stacks" },
                ].map(f => (
                  <div key={f.title} style={{
                    display: "flex", gap: "14px", alignItems: "flex-start",
                    padding: "14px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "17px", background: `${f.color}15`, border: `1px solid ${f.color}30`,
                    }}>
                      {f.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", marginBottom: "3px" }}>{f.title}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.55 }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "4px" }}>
                <button
                  onClick={handleFindMatches}
                  style={{
                    width: "100%", padding: "14px", borderRadius: "14px", fontWeight: 800, fontSize: "15px",
                    border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff",
                    boxShadow: "0 0 32px rgba(124,58,237,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  }}
                >
                  <span>Find My Matches</span>
                  <span>→</span>
                </button>
                <button
                  onClick={handleSkip}
                  style={{
                    width: "100%", padding: "11px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
                    border: "none", background: "none", color: "#475569", cursor: "pointer",
                  }}
                  onMouseOver={e => e.currentTarget.style.color = "#94a3b8"}
                  onMouseOut={e => e.currentTarget.style.color = "#475569"}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ob-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
