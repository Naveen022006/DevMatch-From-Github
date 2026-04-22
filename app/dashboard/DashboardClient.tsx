"use client";

import { useState } from "react";
import type { UserProfile, DeveloperMatch, StoryCard, UserAchievement } from "@/types";
import type { ChallengeWithSubmission } from "@/types/admin";
import { MatchCard } from "@/components/MatchCard";
import { StoryCardComponent } from "@/components/StoryCard";
import { AchievementCard, AchievementToast } from "@/components/AchievementCard";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  githubUsername: string;
  avatarUrl: string;
  initialProfile: UserProfile | null;
}

type Tab = "profile" | "matches" | "story" | "achievements" | "challenges";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "matches", label: "Matches" },
  { id: "story", label: "Story Card" },
  { id: "achievements", label: "Achievements" },
  { id: "challenges", label: "Challenges" },
];

const S: Record<string, React.CSSProperties> = {
  page: { background: "#060610", minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" },
  nav: {
    position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "14px 24px",
    background: "rgba(6,6,16,0.88)", backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  logo: {
    width: "30px", height: "30px", borderRadius: "8px", display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#fff", fontWeight: 700, fontSize: "13px", flexShrink: 0,
  },
};

export default function DashboardClient({ userId, githubUsername, avatarUrl, initialProfile }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [matches, setMatches] = useState<DeveloperMatch[]>([]);
  const [storyCard, setStoryCard] = useState<StoryCard | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<UserAchievement[]>([]);
  const [challenges, setChallenges] = useState<ChallengeWithSubmission[]>([]);
  const [challengeLoading, setChallengeLoading] = useState<string | null>(null); // challengeId
  const [challengeSolutions, setChallengeSolutions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingSection, setLoadingSection] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const withLoad = async (section: Tab, fn: () => Promise<void>) => {
    setLoading(true); setLoadingSection(section); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setLoading(false); setLoadingSection(null); }
  };

  const runAnalysis = () => withLoad("profile", async () => {
    const res = await fetch("/api/analyze", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setProfile(json.profile);
  });

  const loadMatches = () => withLoad("matches", async () => {
    const res = await fetch("/api/match");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setMatches(json.matches); setTab("matches");
  });

  const loadStoryCard = () => withLoad("story", async () => {
    const res = await fetch("/api/story-card");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setStoryCard(json.card); setTab("story");
  });

  const loadAchievements = () => withLoad("achievements", async () => {
    const res = await fetch("/api/achievements");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setAchievements(json.achievements); setTab("achievements");
  });

  const loadChallenges = () => withLoad("challenges", async () => {
    const res = await fetch("/api/challenges");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setChallenges(json.challenges ?? []); setTab("challenges");
  });

  const handleConnect = async (matchedUserId: string) => {
    const match = matches.find((m) => m.profile.id === matchedUserId);
    if (!match) return;
    try {
      const res = await fetch("/api/achievements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedUserId, compatibilityScore: match.compatibility.total }),
      });
      const json = await res.json();
      if (json.unlocked?.length > 0) setNewAchievements(json.unlocked);
    } catch { /* non-critical */ }
  };

  const handleSubmitChallenge = async (challengeId: string) => {
    const repoUrl = (challengeSolutions[challengeId] ?? "").trim();
    if (!repoUrl) return;
    setChallengeLoading(challengeId);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId
            ? {
                ...c,
                submission: {
                  id: json.submissionId,
                  is_correct: json.correct,
                  ai_feedback: json.feedback,
                  admin_feedback: null,
                  admin_override: null,
                  submitted_at: new Date().toISOString(),
                  repo_url: repoUrl,
                  solution_text: repoUrl,
                },
              }
            : c
        )
      );
      if (json.unlocked?.length > 0) setNewAchievements(json.unlocked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setChallengeLoading(null);
    }
  };

  const isLoading = (s: Tab) => loading && loadingSection === s;

  return (
    <div style={S.page}>
      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
      <div style={{ position: "fixed", top: "-200px", left: "30%", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0, animation: "float1 12s ease-in-out infinite" }} />

      {/* Nav */}
      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={S.logo}>D</div>
          <span style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>DevMatch</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt={githubUsername} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "2px solid rgba(124,58,237,0.5)" }} />
          <span style={{ fontSize: "13px", color: "#64748b", fontFamily: "monospace" }}>@{githubUsername}</span>
          <button onClick={signOut} style={{ fontSize: "12px", color: "#475569", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
            onMouseOver={e => (e.currentTarget.style.color = "#94a3b8")}
            onMouseOut={e => (e.currentTarget.style.color = "#475569")}>
            Sign out
          </button>
        </div>
      </nav>

      <main style={{ position: "relative", zIndex: 10, maxWidth: "680px", margin: "0 auto", padding: "32px 16px" }}>

        {/* Tab bar */}
        <div style={{
          display: "flex", gap: "4px", padding: "5px",
          background: "rgba(13,13,26,0.9)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px", marginBottom: "28px",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => {
              setTab(t.id);
              if (t.id === "challenges" && challenges.length === 0 && !loading) loadChallenges();
            }} style={{
              flex: 1, padding: "9px 8px", borderRadius: "10px", fontSize: "13px",
              fontWeight: 600, cursor: "pointer", transition: "all 0.15s", border: "none",
              ...(tab === t.id
                ? { background: "rgba(124,58,237,0.2)", color: "#c4b5fd", boxShadow: "0 0 0 1px rgba(124,58,237,0.3)" }
                : { background: "transparent", color: "#475569" }),
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 16px", borderRadius: "12px", marginBottom: "20px",
            background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: "14px",
          }}>
            <span>⚠</span> {error}
            <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* ── Profile Tab ── */}
        {tab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "fade-in 0.3s ease-out" }}>
            {isLoading("profile") ? <ProfileSkeleton /> : !profile ? (
              <EmptyState icon="◈" title="No profile yet" desc="Let AI analyze your GitHub to build your developer identity.">
                <PrimaryBtn onClick={runAnalysis} loading={loading} label="Analyze My GitHub" />
              </EmptyState>
            ) : (
              <>
                <ProfileCard profile={profile} avatarUrl={avatarUrl} />
                <StatsGrid profile={profile} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", paddingTop: "4px" }}>
                  <PrimaryBtn onClick={loadMatches} loading={loading} label="Find My Matches" />
                  <SecondaryBtn onClick={loadStoryCard} loading={loading} label="Story Card" />
                  <SecondaryBtn onClick={loadAchievements} loading={loading} label="Achievements" />
                  <SecondaryBtn onClick={loadChallenges} loading={loading} label="Challenges ⚡" />
                  <SecondaryBtn onClick={runAnalysis} loading={loading} label="Re-analyze" small />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Matches Tab ── */}
        {tab === "matches" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {isLoading("matches") ? <><MatchSkeleton /><MatchSkeleton /><MatchSkeleton /></> : matches.length === 0 ? (
              <EmptyState icon="⬡" title="No matches yet" desc={profile ? "Run the matchmaker to meet your tribe." : "Analyze your profile first."}>
                {profile ? <PrimaryBtn onClick={loadMatches} loading={loading} label="Find Matches" /> : <SecondaryBtn onClick={() => setTab("profile")} loading={false} label="Go to Profile" />}
              </EmptyState>
            ) : (
              <>
                <p style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>Your top {matches.length} compatible developers</p>
                {matches.map(m => <MatchCard key={m.profile.id} match={m} onConnect={handleConnect} />)}
              </>
            )}
          </div>
        )}

        {/* ── Story Card Tab ── */}
        {tab === "story" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "8px" }}>
            {isLoading("story") ? <StorySkeleton /> : !storyCard ? (
              <EmptyState icon="⟡" title="No story card yet" desc={profile ? "Generate your AI-created developer tarot card." : "Analyze your profile first."}>
                {profile ? <PrimaryBtn onClick={loadStoryCard} loading={loading} label="Generate Story Card" /> : <SecondaryBtn onClick={() => setTab("profile")} loading={false} label="Go to Profile" />}
              </EmptyState>
            ) : (
              <StoryCardComponent card={storyCard} username={githubUsername} avatarUrl={avatarUrl} />
            )}
          </div>
        )}

        {/* ── Achievements Tab ── */}
        {tab === "achievements" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {isLoading("achievements") ? <><AchievementSkeleton /><AchievementSkeleton /><AchievementSkeleton /></> : achievements.length === 0 ? (
              <EmptyState icon="✦" title="No achievements yet" desc="Connect with developers and solve challenges to earn badges.">
                <SecondaryBtn onClick={loadAchievements} loading={loading} label="Refresh" />
              </EmptyState>
            ) : (
              achievements.map((a, i) => <AchievementCard key={a.id} achievement={a} index={i} />)
            )}
          </div>
        )}

        {/* ── Challenges Tab ── */}
        {tab === "challenges" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {isLoading("challenges") ? (
              <><ChallengeSkeleton /><ChallengeSkeleton /></>
            ) : challenges.length === 0 ? (
              <EmptyState icon="⚡" title="No challenges yet" desc="The admin hasn't posted any challenges yet. Check back soon!">
                <SecondaryBtn onClick={loadChallenges} loading={loading} label="Refresh" />
              </EmptyState>
            ) : (
              <>
                <p style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>
                  Solve challenges to earn the <span style={{ color: "#fbbf24" }}>Challenge Complete 🏆</span> achievement
                </p>
                {challenges.map((c) => {
                  const diffColor: Record<string, string> = { easy: "#34d399", medium: "#fbbf24", hard: "#f87171" };
                  const dc = diffColor[c.difficulty] ?? "#a78bfa";
                  const sub = c.submission;
                  const alreadySolved = sub?.is_correct === true;

                  return (
                    <div
                      key={c.id}
                      style={{
                        background: "rgba(13,13,26,0.95)",
                        border: `1px solid ${alreadySolved ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.09)"}`,
                        borderRadius: "18px",
                        padding: "20px 22px",
                        boxShadow: alreadySolved ? "0 0 24px rgba(52,211,153,0.06)" : "none",
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{c.title}</span>
                            {alreadySolved && <span style={{ fontSize: 14 }}>✅</span>}
                          </div>
                          <span style={{ padding: "2px 9px", borderRadius: 4, background: `${dc}18`, border: `1px solid ${dc}35`, color: dc, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                            {c.difficulty}
                          </span>
                        </div>
                      </div>

                      {/* Problem statement */}
                      <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 10, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}>
                        <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                          Problem Statement
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{c.description}</p>
                      </div>

                      {/* Previous feedback */}
                      {sub && (
                        <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: sub.is_correct ? "rgba(52,211,153,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${sub.is_correct ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: sub.is_correct ? "#34d399" : "#f87171" }}>
                              {sub.is_correct ? "✓ Correct — Well done!" : "✗ Not quite right"}
                            </span>
                            {sub.admin_override !== null && sub.admin_override !== undefined && (
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(167,139,250,0.15)", color: "#a78bfa", fontWeight: 600 }}>
                                Admin reviewed
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                            {sub.admin_feedback ?? sub.ai_feedback}
                          </div>
                          {sub.repo_url && (
                            <a href={sub.repo_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 11, color: "#64748b", textDecoration: "none" }}>
                              🔗 {sub.repo_url}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Submission form */}
                      {!alreadySolved && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {/* Instructions */}
                          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.12)", fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                            <span style={{ color: "#22d3ee", fontWeight: 600 }}>How to submit:</span> Build your solution in a <strong style={{ color: "#94a3b8" }}>public GitHub repository</strong>, then paste the repo URL below. The AI will clone and evaluate your code.
                          </div>
                          <label style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            GitHub Repository URL
                          </label>
                          <input
                            type="url"
                            placeholder="https://github.com/your-username/your-repo"
                            value={challengeSolutions[c.id] ?? (sub?.repo_url ?? "")}
                            onChange={(e) => setChallengeSolutions((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "monospace" }}
                          />
                          <button
                            onClick={() => handleSubmitChallenge(c.id)}
                            disabled={challengeLoading === c.id || !(challengeSolutions[c.id] ?? "").trim()}
                            style={{
                              alignSelf: "flex-start", padding: "10px 22px", borderRadius: 12, border: "none",
                              background: challengeLoading === c.id || !(challengeSolutions[c.id] ?? "").trim()
                                ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                              color: challengeLoading === c.id || !(challengeSolutions[c.id] ?? "").trim() ? "#475569" : "#fff",
                              cursor: challengeLoading === c.id ? "not-allowed" : "pointer",
                              fontSize: 14, fontWeight: 700,
                              display: "flex", alignItems: "center", gap: 8,
                              boxShadow: !(challengeSolutions[c.id] ?? "").trim() ? "none" : "0 0 20px rgba(124,58,237,0.3)",
                            }}
                          >
                            {challengeLoading === c.id ? (
                              <><span className="spinner" style={{ width: 14, height: 14 }} />AI is evaluating…</>
                            ) : sub ? "Try Again" : "Submit Solution"}
                          </button>
                        </div>
                      )}

                      {alreadySolved && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.08)" }}>
                          <span style={{ fontSize: 16 }}>🏆</span>
                          <span style={{ fontSize: 13, color: "#34d399", fontWeight: 600 }}>Challenge solved! Achievement unlocked.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>

      <AchievementToast achievements={newAchievements} onDismiss={() => setNewAchievements([])} />
    </div>
  );
}

/* ── Profile Card ── */
function ProfileCard({ profile, avatarUrl }: { profile: UserProfile; avatarUrl: string }) {
  const identityColor: Record<string, string> = { builder: "#f59e0b", learner: "#34d399", maintainer: "#60a5fa", explorer: "#f472b6" };
  const c = identityColor[profile.coding_identity] ?? "#a78bfa";
  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "18px", padding: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "16px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" style={{ width: "56px", height: "56px", borderRadius: "14px", border: `2px solid ${c}55`, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#f1f5f9", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.display_name ?? profile.github_username}
          </div>
          <div style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace", marginBottom: "8px" }}>@{profile.github_username}</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <Pill label={profile.coding_identity} color={c} />
            <Pill label={profile.experience_level} />
            <Pill label={profile.collaboration_style} />
          </div>
        </div>
      </div>
      <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.65, borderLeft: `2px solid ${c}55`, paddingLeft: "12px", marginBottom: "16px" }}>{profile.human_description}</p>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "10px", color: "#334155", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px", fontWeight: 600 }}>Languages</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{profile.languages.slice(0, 6).map(l => <Chip key={l} label={l} />)}</div>
      </div>
      <div>
        <div style={{ fontSize: "10px", color: "#334155", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px", fontWeight: 600 }}>Passions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{profile.passion_areas.slice(0, 4).map(p => <Chip key={p} label={p} accent />)}</div>
      </div>
      {profile.peak_hours && <p style={{ fontSize: "12px", color: "#334155", marginTop: "12px" }}>⏰ Most active: <span style={{ color: "#475569" }}>{profile.peak_hours}</span></p>}
    </div>
  );
}

function StatsGrid({ profile }: { profile: UserProfile }) {
  const stats = [
    { v: String(profile.total_repos), l: "Repos" },
    { v: String(profile.total_stars), l: "Stars" },
    { v: String(profile.ghost_repos), l: "Ghost repos" },
    { v: profile.commit_style === "frequent" ? "Active" : "Periodic", l: "Commit style" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
      {stats.map(s => (
        <div key={s.l} style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 10px", textAlign: "center" }}>
          <div style={{ fontSize: "20px", fontWeight: 700, background: "linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{s.v}</div>
          <div style={{ fontSize: "10px", color: "#334155", marginTop: "3px", lineHeight: 1.3 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Shared components ── */
function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: "11px", padding: "2px 10px", borderRadius: "20px", fontWeight: 600, textTransform: "capitalize",
      ...(color ? { background: `${color}18`, border: `1px solid ${color}35`, color } : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b" }),
    }}>{label}</span>
  );
}

function Chip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span style={{
      fontSize: "12px", padding: "3px 10px", borderRadius: "20px", textTransform: "capitalize",
      ...(accent ? { background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.28)", color: "#a78bfa" } : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }),
    }}>{label}</span>
  );
}

function EmptyState({ icon, title, desc, children }: { icon: string; title: string; desc: string; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa" }}>{icon}</div>
      <div>
        <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "16px", marginBottom: "6px" }}>{title}</div>
        <div style={{ color: "#475569", fontSize: "14px", maxWidth: "300px", lineHeight: 1.6 }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}

function PrimaryBtn({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      display: "inline-flex", alignItems: "center", gap: "8px",
      padding: "10px 22px", borderRadius: "12px", fontWeight: 700, fontSize: "14px",
      color: "#fff", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
      border: "none", background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
      boxShadow: "0 0 20px rgba(124,58,237,0.35)", transition: "transform 0.15s",
    }}>
      {loading && <span className="spinner" style={{ width: "14px", height: "14px" }} />}
      {label}
    </button>
  );
}

function SecondaryBtn({ onClick, loading, label, small }: { onClick: () => void; loading: boolean; label: string; small?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: small ? "8px 14px" : "10px 18px",
      borderRadius: "12px", fontWeight: 600, fontSize: small ? "13px" : "14px",
      color: "#94a3b8", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
      border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
    }}>
      {loading && <span className="spinner" style={{ width: "12px", height: "12px" }} />}
      {label}
    </button>
  );
}

/* ── Skeleton loaders ── */
function ProfileSkeleton() {
  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", gap: "14px" }}>
        <div className="skeleton" style={{ width: "56px", height: "56px", borderRadius: "14px", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="skeleton" style={{ height: "16px", width: "140px", borderRadius: "6px" }} />
          <div className="skeleton" style={{ height: "12px", width: "100px", borderRadius: "6px" }} />
          <div style={{ display: "flex", gap: "6px" }}>
            <div className="skeleton" style={{ height: "18px", width: "64px", borderRadius: "20px" }} />
            <div className="skeleton" style={{ height: "18px", width: "80px", borderRadius: "20px" }} />
          </div>
        </div>
      </div>
      <div className="skeleton" style={{ height: "13px", borderRadius: "6px" }} />
      <div className="skeleton" style={{ height: "13px", width: "80%", borderRadius: "6px" }} />
      <div style={{ display: "flex", gap: "6px" }}>
        {[60, 50, 56, 48, 44].map((w, i) => <div key={i} className="skeleton" style={{ height: "22px", width: `${w}px`, borderRadius: "20px" }} />)}
      </div>
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <div className="skeleton" style={{ width: "48px", height: "48px", borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "7px" }}>
          <div className="skeleton" style={{ height: "14px", width: "130px", borderRadius: "6px" }} />
          <div className="skeleton" style={{ height: "11px", width: "90px", borderRadius: "6px" }} />
        </div>
        <div className="skeleton" style={{ width: "56px", height: "56px", borderRadius: "12px", flexShrink: 0 }} />
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        {[64, 72, 56].map((w, i) => <div key={i} className="skeleton" style={{ height: "20px", width: `${w}px`, borderRadius: "20px" }} />)}
      </div>
      <div className="skeleton" style={{ height: "12px", borderRadius: "6px" }} />
      {[1,2,3,4].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="skeleton" style={{ height: "10px", width: "52px", borderRadius: "4px" }} />
          <div className="skeleton" style={{ height: "6px", flex: 1, borderRadius: "4px" }} />
          <div className="skeleton" style={{ height: "10px", width: "24px", borderRadius: "4px" }} />
        </div>
      ))}
    </div>
  );
}

function StorySkeleton() {
  return (
    <div style={{ width: "100%", maxWidth: "380px", background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div className="skeleton" style={{ width: "36px", height: "36px", borderRadius: "50%" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div className="skeleton" style={{ height: "10px", width: "80px", borderRadius: "4px" }} />
          <div className="skeleton" style={{ height: "13px", width: "110px", borderRadius: "4px" }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: "1px", borderRadius: "2px" }} />
      {[85, 65, 75, 60].map((w, i) => (
        <div key={i} style={{ display: "flex", gap: "10px" }}>
          <div className="skeleton" style={{ width: "18px", height: "12px", borderRadius: "3px", flexShrink: 0, marginTop: "3px" }} />
          <div className="skeleton" style={{ height: "16px", borderRadius: "6px", width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

function AchievementSkeleton() {
  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "16px", display: "flex", gap: "14px" }}>
      <div className="skeleton" style={{ width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="skeleton" style={{ height: "14px", width: "130px", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "12px", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "12px", width: "75%", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "10px", width: "80px", borderRadius: "6px" }} />
      </div>
    </div>
  );
}

function ChallengeSkeleton() {
  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <div className="skeleton" style={{ height: "18px", flex: 1, borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "18px", width: "50px", borderRadius: "4px" }} />
      </div>
      <div style={{ padding: "14px 16px", borderRadius: "10px", background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.1)", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="skeleton" style={{ height: "10px", width: "120px", borderRadius: "4px" }} />
        <div className="skeleton" style={{ height: "13px", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "13px", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "13px", width: "75%", borderRadius: "6px" }} />
      </div>
      <div className="skeleton" style={{ height: "80px", borderRadius: "10px" }} />
      <div className="skeleton" style={{ height: "38px", width: "150px", borderRadius: "12px" }} />
    </div>
  );
}
