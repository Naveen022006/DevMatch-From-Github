"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { AdminAchievement, AchievementSlugCount, Challenge, ChallengeDifficulty, ChallengeSubmission, AdminUser } from "@/types/admin";
import type { AchievementSlug } from "@/types";
import type { AwardAllResult } from "@/app/api/admin/achievements/award-all/route";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";

const BORDER = "rgba(255,255,255,0.09)";

interface Props {
  achievements: AdminAchievement[] | null;
  slugSummary: AchievementSlugCount[] | null;
  loading: boolean;
  onDelete: (achievementId: string) => void;
  onAwardComplete: () => void; // re-fetch achievements after award
}

export default function AchievementsTab({
  achievements,
  slugSummary,
  loading,
  onDelete,
  onAwardComplete,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [awardResult, setAwardResult] = useState<AwardAllResult | null>(null);
  const [awardError, setAwardError] = useState<string | null>(null);

  // ── Challenge state ───────────────────────────────────────────────────────
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<ChallengeDifficulty>("medium");
  const [aiTopic, setAiTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteChallenge, setConfirmDeleteChallenge] = useState<string | null>(null);

  // ── Submission review state ───────────────────────────────────────────────
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, ChallengeSubmission[]>>({});
  const [subsLoading, setSubsLoading] = useState<string | null>(null);
  const [overrideLoading, setOverrideLoading] = useState<string | null>(null);
  const [reEvalLoading, setReEvalLoading] = useState<string | null>(null);
  const [adminFeedbacks, setAdminFeedbacks] = useState<Record<string, string>>({});
  const [subError, setSubError] = useState<string | null>(null);

  // ── Manual award/delete state ─────────────────────────────────────────────
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [awardUsers, setAwardUsers] = useState<AdminUser[] | null>(null);
  const [awardUsersLoading, setAwardUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<AchievementSlug>("first_connection");
  const [customMessage, setCustomMessage] = useState("");
  const [awarding1, setAwarding1] = useState(false);
  const [awardFormError, setAwardFormError] = useState<string | null>(null);
  const [awardFormSuccess, setAwardFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadChallenges();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadChallenges() {
    setChallengesLoading(true);
    setChallengeError(null);
    try {
      const res = await fetch("/api/admin/challenges");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setChallenges(json.challenges);
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Failed to load challenges");
    } finally {
      setChallengesLoading(false);
    }
  }

  async function handleGenerateWithAI() {
    setGenerating(true);
    setChallengeError(null);
    try {
      const res = await fetch("/api/admin/challenges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic || undefined, difficulty: formDifficulty }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setFormTitle(json.title);
      setFormDescription(json.description);
      setFormDifficulty(json.difficulty);
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveChallenge() {
    if (!formTitle.trim() || !formDescription.trim()) {
      setChallengeError("Title and description are required");
      return;
    }
    setSaving(true);
    setChallengeError(null);
    try {
      const res = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formTitle, description: formDescription, difficulty: formDifficulty }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setChallenges((prev) => [json.challenge, ...(prev ?? [])]);
      setFormTitle(""); setFormDescription(""); setAiTopic(""); setFormDifficulty("medium");
      setShowAddForm(false);
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleChallenge(challengeId: string, isActive: boolean) {
    setChallenges((prev) =>
      prev?.map((c) => (c.id === challengeId ? { ...c, is_active: isActive } : c)) ?? null
    );
    try {
      const res = await fetch("/api/admin/challenges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, isActive }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Toggle failed");
      loadChallenges();
    }
  }

  async function handleDeleteChallenge(challengeId: string) {
    if (confirmDeleteChallenge === challengeId) {
      setChallenges((prev) => prev?.filter((c) => c.id !== challengeId) ?? null);
      setConfirmDeleteChallenge(null);
      try {
        const res = await fetch("/api/admin/challenges", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error);
        }
      } catch (e) {
        setChallengeError(e instanceof Error ? e.message : "Delete failed");
        loadChallenges();
      }
    } else {
      setConfirmDeleteChallenge(challengeId);
      setTimeout(() => setConfirmDeleteChallenge((c) => (c === challengeId ? null : c)), 3000);
    }
  }

  async function loadSubmissions(challengeId: string) {
    if (expandedChallenge === challengeId) {
      setExpandedChallenge(null);
      return;
    }
    setExpandedChallenge(challengeId);
    if (submissions[challengeId]) return; // already loaded
    setSubsLoading(challengeId);
    setSubError(null);
    try {
      const res = await fetch(`/api/admin/challenge-submissions?challengeId=${challengeId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSubmissions((prev) => ({ ...prev, [challengeId]: json.submissions }));
    } catch (e) {
      setSubError(e instanceof Error ? e.message : "Failed to load submissions");
    } finally {
      setSubsLoading(null);
    }
  }

  async function handleOverride(submissionId: string, challengeId: string, adminOverride: boolean) {
    setOverrideLoading(submissionId);
    setSubError(null);
    try {
      const res = await fetch("/api/admin/challenge-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          adminOverride,
          adminFeedback: adminFeedbacks[submissionId] ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSubmissions((prev) => ({
        ...prev,
        [challengeId]: (prev[challengeId] ?? []).map((s) =>
          s.id === submissionId
            ? { ...s, admin_override: adminOverride, admin_feedback: adminFeedbacks[submissionId] ?? null }
            : s
        ),
      }));
    } catch (e) {
      setSubError(e instanceof Error ? e.message : "Override failed");
    } finally {
      setOverrideLoading(null);
    }
  }

  async function handleReEvaluate(submissionId: string, challengeId: string) {
    setReEvalLoading(submissionId);
    setSubError(null);
    try {
      const res = await fetch("/api/admin/challenge-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSubmissions((prev) => ({
        ...prev,
        [challengeId]: (prev[challengeId] ?? []).map((s) =>
          s.id === submissionId
            ? { ...s, is_correct: json.correct, ai_feedback: json.feedback, admin_override: null, admin_feedback: null }
            : s
        ),
      }));
    } catch (e) {
      setSubError(e instanceof Error ? e.message : "Re-evaluation failed");
    } finally {
      setReEvalLoading(null);
    }
  }

  async function openAwardForm() {
    setShowAwardForm(true);
    setAwardFormError(null);
    setAwardFormSuccess(null);
    if (awardUsers) return;
    setAwardUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAwardUsers(json.users);
      if (json.users?.length > 0) setSelectedUserId(json.users[0].id);
    } catch (e) {
      setAwardFormError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setAwardUsersLoading(false);
    }
  }

  async function handleAwardOne() {
    if (!selectedUserId) return;
    setAwarding1(true);
    setAwardFormError(null);
    setAwardFormSuccess(null);
    try {
      const res = await fetch("/api/admin/achievements/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          achievementSlug: selectedSlug,
          customMessage: customMessage.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const user = awardUsers?.find((u) => u.id === selectedUserId);
      setAwardFormSuccess(`✓ Awarded "${ACHIEVEMENTS[selectedSlug].name}" to @${user?.github_username ?? selectedUserId}`);
      setCustomMessage("");
      // Refresh the achievements list
      onAwardComplete();
    } catch (e) {
      setAwardFormError(e instanceof Error ? e.message : "Award failed");
    } finally {
      setAwarding1(false);
    }
  }
  function handleDelete(id: string) {
    if (confirmId === id) {
      onDelete(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 3000);
    }
  }

  async function handleAwardAll() {
    setAwarding(true);
    setAwardResult(null);
    setAwardError(null);
    try {
      const res = await fetch("/api/admin/achievements/award-all", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAwardResult(json as AwardAllResult);
      onAwardComplete(); // re-fetch achievements list
    } catch (e) {
      setAwardError(e instanceof Error ? e.message : "Award failed");
    } finally {
      setAwarding(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
            Achievements
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {achievements ? `${achievements.length} total` : "Loading…"}
          </p>
        </div>

        {/* AI Award button */}
        <button
          onClick={handleAwardAll}
          disabled={awarding}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid rgba(167,139,250,0.4)",
            background: awarding
              ? "rgba(167,139,250,0.08)"
              : "rgba(167,139,250,0.15)",
            color: awarding ? "#64748b" : "#a78bfa",
            cursor: awarding ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s",
            flexShrink: 0,
          }}
        >
          {awarding ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(167,139,250,0.3)",
                  borderTopColor: "#a78bfa",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              AI is working…
            </>
          ) : (
            <>✦ AI Award to All Users</>
          )}
        </button>
      </div>

      {/* Award result panel */}
      {awardError && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{awardError}</span>
          <button
            onClick={() => setAwardError(null)}
            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {awardResult && (
        <div
          style={{
            marginBottom: 24,
            padding: "18px 20px",
            borderRadius: 10,
            background: "rgba(34,211,238,0.05)",
            border: "1px solid rgba(34,211,238,0.2)",
          }}
        >
          {/* Summary row */}
          <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22d3ee" }}>
                {awardResult.totalAwarded}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Awarded
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa" }}>
                {awardResult.totalUsers}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Users Scanned
              </div>
            </div>
            {awardResult.errors.length > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f87171" }}>
                  {awardResult.errors.length}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Errors
                </div>
              </div>
            )}
          </div>

          {/* Per-user breakdown */}
          {awardResult.details.filter((d) => d.awarded.length > 0).length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Newly Awarded
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {awardResult.details
                  .filter((d) => d.awarded.length > 0)
                  .map((d) => (
                    <div
                      key={d.userId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.04)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#a78bfa", fontWeight: 600, minWidth: 140 }}>
                        @{d.github_username}
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {d.awarded.map((slug) => {
                          const def = ACHIEVEMENTS[slug as keyof typeof ACHIEVEMENTS];
                          return (
                            <span
                              key={slug}
                              style={{
                                padding: "2px 10px",
                                borderRadius: 12,
                                background: "rgba(34,211,238,0.12)",
                                border: "1px solid rgba(34,211,238,0.25)",
                                color: "#22d3ee",
                                fontSize: 12,
                                fontWeight: 500,
                              }}
                            >
                              {def?.icon} {def?.name ?? slug}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {awardResult.totalAwarded === 0 && (
            <div style={{ fontSize: 13, color: "#64748b" }}>
              All users already have every achievement they qualify for.
            </div>
          )}

          <button
            onClick={() => setAwardResult(null)}
            style={{
              marginTop: 14,
              padding: "4px 12px",
              borderRadius: 5,
              border: "1px solid rgba(255,255,255,0.09)",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Manual award form ───────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => showAwardForm ? setShowAwardForm(false) : openAwardForm()}
          style={{
            padding: "9px 18px", borderRadius: 8,
            border: `1px solid ${showAwardForm ? "rgba(52,211,153,0.5)" : "rgba(52,211,153,0.25)"}`,
            background: showAwardForm ? "rgba(52,211,153,0.15)" : "rgba(52,211,153,0.07)",
            color: "#34d399", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          {showAwardForm ? "✕ Cancel" : "+ Award Achievement to User"}
        </button>

        {showAwardForm && (
          <div style={{ marginTop: 14, padding: "20px 22px", borderRadius: 12, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.15)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Feedback banners */}
              {awardFormError && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>{awardFormError}</span>
                  <button onClick={() => setAwardFormError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>×</button>
                </div>
              )}
              {awardFormSuccess && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", fontSize: 13 }}>
                  {awardFormSuccess}
                </div>
              )}

              {/* User picker */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Select User
                </label>
                {awardUsersLoading ? (
                  <div style={{ padding: "10px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", color: "#64748b", fontSize: 13 }}>Loading users…</div>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(20,20,40,0.95)", color: "#e2e8f0", fontSize: 13, outline: "none" }}
                  >
                    {(awardUsers ?? []).map((u) => (
                      <option key={u.id} value={u.id}>@{u.github_username}{u.display_name ? ` — ${u.display_name}` : ""}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Achievement picker */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Achievement
                </label>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value as AchievementSlug)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(20,20,40,0.95)", color: "#e2e8f0", fontSize: 13, outline: "none" }}
                >
                  {Object.values(ACHIEVEMENTS).map((a) => (
                    <option key={a.slug} value={a.slug}>{a.icon} {a.name} — {a.description}</option>
                  ))}
                </select>
              </div>

              {/* Custom message */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Unlock Message <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — AI generates one if blank)</span>
                </label>
                <textarea
                  placeholder="e.g. Your dedication to open source is inspiring! You've earned this."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={2}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: "inherit" }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleAwardOne}
                disabled={awarding1 || !selectedUserId}
                style={{
                  alignSelf: "flex-start", padding: "10px 24px", borderRadius: 8, border: "none",
                  background: awarding1 ? "rgba(52,211,153,0.2)" : "linear-gradient(135deg, #059669, #047857)",
                  color: awarding1 ? "#64748b" : "#fff",
                  cursor: awarding1 ? "not-allowed" : "pointer",
                  fontSize: 14, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {awarding1 ? (
                  <><span style={{ width: 14, height: 14, border: "2px solid rgba(52,211,153,0.3)", borderTopColor: "#34d399", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Awarding…</>
                ) : "Award Achievement"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slug summary strip */}
      {!loading && slugSummary && slugSummary.length > 0 && (        <div className="overflow-x-auto" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, paddingBottom: 4 }} className="whitespace-nowrap">
            {slugSummary.map((item) => {
              const def = ACHIEVEMENTS[item.slug as keyof typeof ACHIEVEMENTS];
              return (
                <div
                  key={item.slug}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: "rgba(167,139,250,0.12)",
                    border: "1px solid rgba(167,139,250,0.25)",
                    fontSize: 13,
                    color: "#c4b5fd",
                    fontWeight: 500,
                  }}
                >
                  <span>{def?.icon ?? "🏆"}</span>
                  <span>{def?.name ?? item.slug}</span>
                  <span
                    style={{
                      background: "rgba(167,139,250,0.25)",
                      borderRadius: 10,
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#a78bfa",
                    }}
                  >
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {!loading && achievements && (
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["User", "Achievement", "Message", "Date", ""].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap"
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      color: "#64748b",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {achievements.map((a) => {
                const def = ACHIEVEMENTS[a.achievement_slug];
                return (
                  <tr
                    key={a.id}
                    style={{ borderBottom: `1px solid ${BORDER}`, transition: "background 0.15s" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background =
                        "rgba(255,255,255,0.03)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                    }
                  >
                    <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {a.user.avatar_url ? (
                          <Image
                            src={a.user.avatar_url}
                            alt={a.user.github_username}
                            width={24}
                            height={24}
                            style={{ borderRadius: "50%" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "#1e293b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              color: "#94a3b8",
                            }}
                          >
                            {a.user.github_username[0]?.toUpperCase()}
                          </div>
                        )}
                        <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                          @{a.user.github_username}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 18 }}>{def?.icon ?? "🏆"}</span>
                        <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                          {def?.name ?? a.achievement_slug}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8", maxWidth: 240 }}>
                      <span title={a.unlock_message}>
                        {a.unlock_message?.length > 70
                          ? a.unlock_message.slice(0, 70) + "…"
                          : a.unlock_message ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }} className="whitespace-nowrap">
                      {new Date(a.unlocked_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(a.id)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 6,
                          border: `1px solid ${confirmId === a.id ? "#ef4444" : "rgba(239,68,68,0.3)"}`,
                          background: confirmId === a.id ? "rgba(239,68,68,0.2)" : "transparent",
                          color: confirmId === a.id ? "#ef4444" : "#94a3b8",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          transition: "all 0.15s",
                        }}
                      >
                        {confirmId === a.id ? "Confirm?" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {achievements.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>
              No achievements yet.
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* CHALLENGES SECTION                                               */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
              Challenges
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              {challenges ? `${challenges.length} challenge${challenges.length !== 1 ? "s" : ""}` : "Loading…"} · Users earn the <span style={{ color: "#fbbf24" }}>Challenge Complete</span> achievement when they solve one
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setChallengeError(null); }}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "1px solid rgba(34,211,238,0.35)",
              background: showAddForm ? "rgba(34,211,238,0.15)" : "rgba(34,211,238,0.08)",
              color: "#22d3ee",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {showAddForm ? "✕ Cancel" : "+ Add Challenge"}
          </button>
        </div>

        {/* Error banner */}
        {challengeError && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
            <span>{challengeError}</span>
            <button onClick={() => setChallengeError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Add challenge form */}
        {showAddForm && (
          <div style={{ marginBottom: 24, padding: 20, borderRadius: 12, background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.15)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* AI topic + generate row */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Topic for AI (e.g. recursion, REST APIs…)"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  style={{ flex: 1, minWidth: 180, padding: "9px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#e2e8f0", fontSize: 13, outline: "none" }}
                />
                <select
                  value={formDifficulty}
                  onChange={(e) => setFormDifficulty(e.target.value as ChallengeDifficulty)}
                  style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(20,20,40,0.95)", color: "#94a3b8", fontSize: 13, outline: "none" }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <button
                  onClick={handleGenerateWithAI}
                  disabled={generating}
                  style={{ padding: "9px 16px", borderRadius: 7, border: "1px solid rgba(167,139,250,0.4)", background: generating ? "rgba(167,139,250,0.06)" : "rgba(167,139,250,0.12)", color: generating ? "#64748b" : "#a78bfa", cursor: generating ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
                >
                  {generating ? (
                    <><span style={{ width: 12, height: 12, border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Generating…</>
                  ) : "✦ Generate with AI"}
                </button>
              </div>

              {/* Title */}
              <input
                type="text"
                placeholder="Challenge title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#e2e8f0", fontSize: 14, fontWeight: 500, outline: "none" }}
              />

              {/* Description */}
              <textarea
                placeholder="Problem description — what must the developer solve or explain?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={5}
                style={{ padding: "10px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: "inherit" }}
              />

              {/* Save */}
              <button
                onClick={handleSaveChallenge}
                disabled={saving || !formTitle.trim() || !formDescription.trim()}
                style={{ alignSelf: "flex-start", padding: "10px 22px", borderRadius: 8, border: "none", background: saving || !formTitle.trim() || !formDescription.trim() ? "rgba(34,211,238,0.2)" : "linear-gradient(135deg, #06b6d4, #0891b2)", color: saving || !formTitle.trim() || !formDescription.trim() ? "#64748b" : "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700 }}
              >
                {saving ? "Saving…" : "Save Challenge"}
              </button>
            </div>
          </div>
        )}

        {/* Challenges list */}
        {challengesLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
            ))}
          </div>
        )}

        {!challengesLoading && challenges && challenges.length === 0 && (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b", fontSize: 14 }}>
            No challenges yet. Click "+ Add Challenge" to create one.
          </div>
        )}

        {!challengesLoading && challenges && challenges.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {challenges.map((c) => {
              const diffColor: Record<string, string> = { easy: "#34d399", medium: "#fbbf24", hard: "#f87171" };
              const dc = diffColor[c.difficulty] ?? "#94a3b8";
              return (
                <div
                  key={c.id}
                  style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(13,13,26,0.8)", border: `1px solid ${c.is_active ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.06)"}`, opacity: c.is_active ? 1 : 0.55, transition: "all 0.15s" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{c.title}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: `${dc}18`, border: `1px solid ${dc}40`, color: dc, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{c.difficulty}</span>
                        {!c.is_active && <span style={{ padding: "2px 7px", borderRadius: 4, background: "rgba(100,116,139,0.15)", color: "#64748b", fontSize: 11, fontWeight: 600 }}>Inactive</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"] }}>
                        {c.description}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {/* View submissions */}
                      <button
                        onClick={() => loadSubmissions(c.id)}
                        style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${expandedChallenge === c.id ? "rgba(167,139,250,0.5)" : "rgba(167,139,250,0.2)"}`, background: expandedChallenge === c.id ? "rgba(167,139,250,0.15)" : "transparent", color: expandedChallenge === c.id ? "#a78bfa" : "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        {subsLoading === c.id ? "Loading…" : `Submissions ${submissions[c.id] ? `(${submissions[c.id].length})` : ""}`}
                      </button>
                      {/* Active toggle */}
                      <button
                        onClick={() => handleToggleChallenge(c.id, !c.is_active)}
                        style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${c.is_active ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.1)"}`, background: "transparent", color: c.is_active ? "#22d3ee" : "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteChallenge(c.id)}
                        style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${confirmDeleteChallenge === c.id ? "#ef4444" : "rgba(239,68,68,0.3)"}`, background: confirmDeleteChallenge === c.id ? "rgba(239,68,68,0.2)" : "transparent", color: confirmDeleteChallenge === c.id ? "#ef4444" : "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}
                      >
                        {confirmDeleteChallenge === c.id ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {/* ── Submissions panel ─────────────────────────────── */}
                  {expandedChallenge === c.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {subError && (
                        <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                          <span>{subError}</span>
                          <button onClick={() => setSubError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>×</button>
                        </div>
                      )}
                      {subsLoading === c.id && (
                        <div style={{ padding: "16px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>Loading submissions…</div>
                      )}
                      {submissions[c.id] && submissions[c.id].length === 0 && (
                        <div style={{ padding: "14px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>No submissions yet.</div>
                      )}
                      {(submissions[c.id] ?? []).map((s) => {
                        const effective = s.admin_override !== null && s.admin_override !== undefined ? s.admin_override : s.is_correct;
                        return (
                          <div key={s.id} style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 10, background: "rgba(6,6,16,0.7)", border: `1px solid ${effective ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.15)"}` }}>
                            {/* User row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                              {s.user.avatar_url ? (
                                <Image src={s.user.avatar_url} alt={s.user.github_username} width={26} height={26} style={{ borderRadius: "50%" }} />
                              ) : (
                                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#94a3b8" }}>{s.user.github_username[0]?.toUpperCase()}</div>
                              )}
                              <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 13 }}>@{s.user.github_username}</span>
                              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: effective ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.12)", color: effective ? "#34d399" : "#f87171", fontWeight: 700 }}>
                                {s.admin_override !== null && s.admin_override !== undefined ? "Admin: " : "AI: "}{effective ? "Pass" : "Fail"}
                              </span>
                              <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>{new Date(s.submitted_at).toLocaleDateString()}</span>
                            </div>

                            {/* Repo link */}
                            {(s.repo_url ?? s.solution_text) && (
                              <a href={s.repo_url ?? s.solution_text ?? "#"} target="_blank" rel="noopener noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, color: "#22d3ee", textDecoration: "none", fontFamily: "monospace", wordBreak: "break-all" }}>
                                🔗 {s.repo_url ?? s.solution_text}
                              </a>
                            )}

                            {/* AI feedback */}
                            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 10 }}>
                              <span style={{ fontWeight: 600, color: "#475569" }}>AI: </span>{s.ai_feedback ?? "—"}
                            </div>

                            {/* Admin feedback input */}
                            <textarea
                              placeholder="Admin feedback (optional — override the AI message shown to user)"
                              value={adminFeedbacks[s.id] ?? (s.admin_feedback ?? "")}
                              onChange={(e) => setAdminFeedbacks((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              rows={2}
                              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: 12, lineHeight: 1.5, resize: "vertical", outline: "none", fontFamily: "inherit", marginBottom: 10 }}
                            />

                            {/* Action buttons */}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                onClick={() => handleOverride(s.id, c.id, true)}
                                disabled={overrideLoading === s.id}
                                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(52,211,153,0.4)", background: effective === true && s.admin_override === true ? "rgba(52,211,153,0.2)" : "transparent", color: "#34d399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                              >
                                {overrideLoading === s.id ? "…" : "✓ Mark Pass"}
                              </button>
                              <button
                                onClick={() => handleOverride(s.id, c.id, false)}
                                disabled={overrideLoading === s.id}
                                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.35)", background: effective === false && s.admin_override === false ? "rgba(239,68,68,0.15)" : "transparent", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                              >
                                {overrideLoading === s.id ? "…" : "✗ Mark Fail"}
                              </button>
                              <button
                                onClick={() => handleReEvaluate(s.id, c.id)}
                                disabled={reEvalLoading === s.id}
                                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(167,139,250,0.3)", background: "transparent", color: reEvalLoading === s.id ? "#64748b" : "#a78bfa", cursor: reEvalLoading === s.id ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}
                              >
                                {reEvalLoading === s.id ? <><span style={{ width: 10, height: 10, border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Re-evaluating…</> : "✦ Re-evaluate with AI"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
