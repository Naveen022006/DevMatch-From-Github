"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { UserProfile, DeveloperMatch, StoryCard, UserAchievement, ConnectionRequestWithProfile, ActivityFeedItem } from "@/types";
import type { ChallengeWithSubmission } from "@/types/admin";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";
import { MatchCard } from "@/components/MatchCard";
import { StoryCardComponent } from "@/components/StoryCard";
import { AchievementCard, AchievementToast, LockedAchievementCard } from "@/components/AchievementCard";
import type { AchievementSlug } from "@/types";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import { ChatPanel } from "@/components/ChatPanel";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { SkillBadges } from "@/components/SkillBadges";
import { computeSkillBadges } from "@/lib/badges/compute";
import { OnboardingModal } from "@/components/OnboardingModal";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  githubUsername: string;
  avatarUrl: string;
  initialProfile: UserProfile | null;
}

type Tab = "profile" | "matches" | "requests" | "feed" | "story" | "achievements" | "challenges";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "matches", label: "Matches" },
  { id: "requests", label: "Requests" },
  { id: "feed", label: "Feed" },
  { id: "story", label: "Story Card" },
  { id: "achievements", label: "Achievements" },
  { id: "challenges", label: "Challenges" },
];

const S: Record<string, React.CSSProperties> = {
  page: { background: "#060610", minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" },
  nav: {
    position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center",
    justifyContent: "space-between",
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
  const [showOnboarding, setShowOnboarding] = useState(!initialProfile?.onboarding_completed);
  const [matches, setMatches] = useState<DeveloperMatch[]>([]);
  const [storyCard, setStoryCard] = useState<StoryCard | null>(null);
  const [storyRegenerating, setStoryRegenerating] = useState(false);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<UserAchievement[]>([]);
  const [challenges, setChallenges] = useState<ChallengeWithSubmission[]>([]);
  const [challengeLoading, setChallengeLoading] = useState<string | null>(null); // challengeId
  const [challengeSolutions, setChallengeSolutions] = useState<Record<string, string>>({});
  const [challengeSubTab, setChallengeSubTab] = useState<"challenges" | "leaderboard">("challenges");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingSection, setLoadingSection] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Messaging ──────────────────────────────────────────────────────────────
  const [chatUser, setChatUser] = useState<{ id: string; username: string; avatarUrl: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Tech stack filter ──────────────────────────────────────────────────────
  const [langFilter, setLangFilter] = useState<string>("All");

  // ── Connection Requests ────────────────────────────────────────────────────
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, "pending" | "accepted" | "declined">>({});
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequestWithProfile[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // ── Activity Feed ──────────────────────────────────────────────────────────
  const [feedItems, setFeedItems] = useState<ActivityFeedItem[]>([]);
  const [feedPage, setFeedPage] = useState(1);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  // ── Privacy ────────────────────────────────────────────────────────────────
  const [isPublic, setIsPublic] = useState<boolean>(initialProfile?.is_public !== false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // ── Refresh / Re-analysis ─────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState(0); // 0=idle 1=fetching 2=analyzing 3=done
  const [cooldownSeconds, setCooldownSeconds] = useState(() => {
    if (!initialProfile?.analysis_cached_at) return 0;
    const remaining = Math.ceil(
      (new Date(initialProfile.analysis_cached_at).getTime() + 24 * 3600 * 1000 - Date.now()) / 1000
    );
    return Math.max(0, remaining);
  });
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleNotificationNavigate = (link: string) => {
    if (link.startsWith("tab:")) {
      const tabName = link.slice(4) as Tab;
      setTab(tabName);
      if (tabName === "requests") loadRequests();
      if (tabName === "matches" && matches.length === 0) loadMatches();
      if (tabName === "achievements") loadAchievements();
      if (tabName === "challenges" && challenges.length === 0) loadChallenges();
    } else if (link.startsWith("chat:")) {
      const senderId = link.slice(5);
      setTab("matches");
      // Try to find the user in matches to open chat
      const match = matches.find((m) => m.profile.id === senderId);
      if (match) setChatUser({ id: senderId, username: match.profile.github_username, avatarUrl: match.profile.avatar_url });
    }
  };

  // Fetch unread count on mount + subscribe to new incoming messages
  const refreshUnread = useCallback(async () => {
    const res = await fetch("/api/messages/unread");
    if (res.ok) { const j = await res.json(); setUnreadCount(j.count ?? 0); }
  }, []);

  const loadConnectionStatuses = async () => {
    const res = await fetch("/api/connections");
    if (res.ok) {
      const { sent } = await res.json();
      const map: Record<string, "pending" | "accepted" | "declined"> = {};
      for (const s of sent ?? []) map[s.to_user_id] = s.status;
      setConnectionStatuses(map);
    }
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    const res = await fetch("/api/connections/requests");
    if (res.ok) {
      const { requests } = await res.json();
      setPendingRequests(requests ?? []);
      setPendingRequestCount((requests ?? []).length);
    }
    setRequestsLoading(false);
  };

  const loadFeed = async (page = 1) => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/feed?page=${page}`);
      if (res.ok) {
        const { items, hasMore } = await res.json();
        setFeedItems(prev => page === 1 ? (items ?? []) : [...prev, ...(items ?? [])]);
        setFeedHasMore(hasMore);
        setFeedPage(page);
      }
    } catch { /* non-critical */ }
    setFeedLoading(false);
  };

  const togglePrivacy = async () => {
    setPrivacyLoading(true);
    try {
      const newVal = !isPublic;
      const res = await fetch("/api/profile/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newVal }),
      });
      if (res.ok) setIsPublic(newVal);
    } catch { /* non-critical */ }
    setPrivacyLoading(false);
  };

  // Countdown tick
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds(s => {
        if (s <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runRefresh = async () => {
    if (refreshing || cooldownSeconds > 0) return;
    setRefreshing(true);
    setRefreshStep(1);
    setError(null);
    try {
      // Step 1: fetch GitHub + Step 2: AI re-analysis
      const stepTimer = setTimeout(() => setRefreshStep(2), 3000);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      clearTimeout(stepTimer);
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 429 && json.cooldownUntil) {
          const remaining = Math.ceil((new Date(json.cooldownUntil).getTime() - Date.now()) / 1000);
          setCooldownSeconds(Math.max(0, remaining));
        }
        throw new Error(json.error);
      }
      setProfile(json.profile);
      setRefreshStep(3);

      // Regenerate story card after profile refresh
      try {
        const scRes = await fetch("/api/story-card", { method: "POST" });
        if (scRes.ok) { const scJson = await scRes.json(); setStoryCard(scJson.card); }
      } catch { /* non-critical */ }

      // Update cooldown to 24h from now
      setCooldownSeconds(24 * 3600);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cooldownRef.current = setInterval(() => {
        setCooldownSeconds(s => {
          if (s <= 1) { clearInterval(cooldownRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshStep(0), 2000);
    }
  };

  useEffect(() => {
    refreshUnread();
    loadRequests();
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` }, () => {
        setUnreadCount((c) => c + 1);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` }, () => {
        refreshUnread();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "connection_requests", filter: `to_user_id=eq.${userId}` }, () => {
        setPendingRequestCount((c) => c + 1);
        loadRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
    loadConnectionStatuses(); // load request statuses alongside matches
  });

  const loadCachedMatches = () => withLoad("matches", async () => {
    const res = await fetch("/api/match/cached");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setMatches(json.matches ?? []);
    loadConnectionStatuses();
  });

  const loadStoryCard = () => withLoad("story", async () => {
    const res = await fetch("/api/story-card");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setStoryCard(json.card); setTab("story");
  });

  const regenerateStoryCard = async () => {
    setStoryRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/story-card", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setStoryCard(json.card);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setStoryRegenerating(false);
    }
  };

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

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) { const j = await res.json(); setLeaderboard(j.entries ?? []); }
    } catch { /* non-critical */ }
    setLeaderboardLoading(false);
  };

  const handleSendRequest = async (matchedUserId: string) => {
    const match = matches.find((m) => m.profile.id === matchedUserId);
    if (!match) return;
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: matchedUserId, compatibility: match.compatibility }),
      });
      if (res.ok) {
        setConnectionStatuses((prev) => ({ ...prev, [matchedUserId]: "pending" }));
      }
    } catch { /* non-critical */ }
  };

  const handleAcceptRequest = async (requestId: string, fromUserId: string) => {
    const res = await fetch(`/api/connections/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      setPendingRequestCount((c) => Math.max(0, c - 1));
      setConnectionStatuses((prev) => ({ ...prev, [fromUserId]: "accepted" }));
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    const res = await fetch(`/api/connections/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    if (res.ok) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      setPendingRequestCount((c) => Math.max(0, c - 1));
    }
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

  // ── Derived: unique languages across all matches (sorted by frequency) ─────
  const availableLangs = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const m of matches) {
      for (const lang of m.profile.languages ?? []) {
        freq[lang] = (freq[lang] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([lang]) => lang);
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (langFilter === "All") return matches;
    return matches.filter((m) => (m.profile.languages ?? []).includes(langFilter));
  }, [matches, langFilter]);

  return (
    <div style={S.page}>
      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
      <div className="hide-mobile" style={{ position: "fixed", top: "-200px", left: "30%", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0, animation: "float1 12s ease-in-out infinite" }} />

      {/* Nav */}
      <nav className="nav-bar" style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={S.logo}>D</div>
          <span style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>DevMatch</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <NotificationsPanel userId={userId} onNavigate={handleNotificationNavigate} />
          <a
            href="/dashboard/settings"
            title="Settings"
            style={{
              width: "28px", height: "28px", borderRadius: "8px", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "#475569", textDecoration: "none", fontSize: "16px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#94a3b8"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.1)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#475569"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; }}
          >
            ⚙
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt={githubUsername} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "2px solid rgba(124,58,237,0.5)" }} />
          <span className="hide-mobile" style={{ fontSize: "13px", color: "#64748b", fontFamily: "monospace" }}>@{githubUsername}</span>
          <button onClick={signOut} className="hide-mobile" style={{ fontSize: "12px", color: "#475569", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
            onMouseOver={e => (e.currentTarget.style.color = "#94a3b8")}
            onMouseOut={e => (e.currentTarget.style.color = "#475569")}>
            Sign out
          </button>
        </div>
      </nav>

      <main style={{ position: "relative", zIndex: 10, width: "min(680px, 100% - 24px)", margin: "0 auto", padding: "28px 0" }}>

        {/* Tab bar */}
        <div className="scroll-tabs" style={{
          gap: "4px", padding: "5px",
          background: "rgba(13,13,26,0.9)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px", marginBottom: "28px",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => {
              setTab(t.id);
              if (t.id === "challenges" && challenges.length === 0 && !loading) loadChallenges();
              if (t.id === "story" && !storyCard && !loading) loadStoryCard();
              if (t.id === "requests") loadRequests();
              if (t.id === "feed" && feedItems.length === 0 && !feedLoading) loadFeed(1);
              if (t.id === "achievements" && !loading) loadAchievements();
              if (t.id === "matches" && !loading) loadCachedMatches();
            }} style={{
              flexShrink: 0, padding: "9px 12px", borderRadius: "10px", fontSize: "13px",
              fontWeight: 600, cursor: "pointer", transition: "all 0.15s", border: "none",
              position: "relative", whiteSpace: "nowrap",
              ...(tab === t.id
                ? { background: "rgba(124,58,237,0.2)", color: "#c4b5fd", boxShadow: "0 0 0 1px rgba(124,58,237,0.3)" }
                : { background: "transparent", color: "#475569" }),
            }}>
              {t.label}
              {t.id === "matches" && unreadCount > 0 && (
                <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {t.id === "requests" && pendingRequestCount > 0 && (
                <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, background: "#f59e0b", color: "#000", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                  {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                </span>
              )}
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
                </div>
                {/* Refresh Analysis panel */}
                <RefreshPanel
                  profile={profile}
                  refreshing={refreshing}
                  refreshStep={refreshStep}
                  cooldownSeconds={cooldownSeconds}
                  onRefresh={runRefresh}
                />
                {/* Privacy toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "12px", background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.08)", marginTop: "4px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>Public Profile</div>
                    <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                      {isPublic ? "Anyone can view your full profile" : "Only connections can view your full profile"}
                    </div>
                  </div>
                  <button
                    onClick={togglePrivacy}
                    disabled={privacyLoading}
                    style={{
                      width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: privacyLoading ? "not-allowed" : "pointer", flexShrink: 0,
                      background: isPublic ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: "3px", width: "18px", height: "18px", borderRadius: "50%",
                      background: isPublic ? "#34d399" : "#475569",
                      left: isPublic ? "23px" : "3px",
                      transition: "left 0.2s, background 0.2s",
                    }} />
                  </button>
                </div>
                {/* Public profile link */}
                <div style={{ fontSize: "12px", color: "#475569" }}>
                  Your profile: <a href={`/dev/${githubUsername}`} style={{ color: "#a78bfa", textDecoration: "none" }}>/dev/{githubUsername}</a>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Matches Tab ── */}
        {tab === "matches" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {isLoading("matches") ? (
              <><MatchSkeleton /><MatchSkeleton /><MatchSkeleton /></>
            ) : matches.length === 0 ? (
              <EmptyState icon="⬡" title="No matches yet" desc={profile ? "Run the AI matchmaker to find your top compatible developers." : "Analyze your GitHub profile first to find matches."}>
                {profile
                  ? <PrimaryBtn onClick={loadMatches} loading={loading} label="Find My Matches" />
                  : <SecondaryBtn onClick={() => setTab("profile")} loading={false} label="Go to Profile" />}
              </EmptyState>
            ) : (
              <>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Your Matches</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                      {matches.length} compatible developer{matches.length !== 1 ? "s" : ""} found
                    </div>
                  </div>
                  <button
                    onClick={loadMatches}
                    disabled={loading}
                    style={{
                      padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      cursor: loading ? "not-allowed" : "pointer", border: "1px solid rgba(167,139,250,0.3)",
                      background: "rgba(167,139,250,0.08)", color: loading ? "#475569" : "#a78bfa",
                      transition: "all 0.15s",
                    }}
                  >
                    {loading ? "Refreshing…" : "Refresh Matches"}
                  </button>
                </div>

                {/* Filter chips */}
                {availableLangs.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", paddingBottom: "2px" }}>
                    {["All", ...availableLangs].map((lang) => {
                      const active = langFilter === lang;
                      return (
                        <button
                          key={lang}
                          onClick={() => setLangFilter(lang)}
                          style={{
                            padding: "5px 13px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                            cursor: "pointer", border: "none", transition: "all 0.12s",
                            ...(active
                              ? { background: "rgba(124,58,237,0.25)", color: "#c4b5fd", boxShadow: "0 0 0 1px rgba(124,58,237,0.4)" }
                              : { background: "rgba(255,255,255,0.05)", color: "#64748b" }),
                          }}
                          onMouseOver={e => { if (!active) e.currentTarget.style.color = "#94a3b8"; }}
                          onMouseOut={e => { if (!active) e.currentTarget.style.color = "#64748b"; }}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                )}

                {langFilter !== "All" && (
                  <p style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>
                    {filteredMatches.length} of {matches.length} match {langFilter}
                  </p>
                )}

                {filteredMatches.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: "14px" }}>
                    No matches use <strong style={{ color: "#94a3b8" }}>{langFilter}</strong>.
                    <button onClick={() => setLangFilter("All")} style={{ display: "block", margin: "12px auto 0", fontSize: "13px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Show all matches
                    </button>
                  </div>
                ) : (
                  filteredMatches.map(m => (
                    <MatchCard
                      key={m.profile.id}
                      match={m}
                      requestStatus={connectionStatuses[m.profile.id] ?? "none"}
                      onSendRequest={handleSendRequest}
                      onMessage={connectionStatuses[m.profile.id] === "accepted" ? (id, username, avatarUrl) => setChatUser({ id, username, avatarUrl }) : undefined}
                    />
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* ── Requests Tab ── */}
        {tab === "requests" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>Connection Requests</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                  {requestsLoading ? "Loading…" : `${pendingRequests.length} pending`}
                </div>
              </div>
              <button onClick={loadRequests} disabled={requestsLoading} style={{ fontSize: "12px", color: "#475569", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", cursor: "pointer", padding: "5px 10px" }}>
                Refresh
              </button>
            </div>

            {requestsLoading && <><RequestSkeleton /><RequestSkeleton /></>}

            {!requestsLoading && pendingRequests.length === 0 && (
              <EmptyState icon="🤝" title="No pending requests" desc="When other developers send you connection requests, they'll appear here.">
                <SecondaryBtn onClick={() => setTab("matches")} loading={false} label="Find Matches" />
              </EmptyState>
            )}

            {!requestsLoading && pendingRequests.map((req) => {
              const p = req.from_profile;
              const identityColor: Record<string, string> = { builder: "#f59e0b", learner: "#34d399", maintainer: "#60a5fa", explorer: "#f472b6" };
              const ic = identityColor[p.coding_identity] ?? "#a78bfa";
              return (
                <div key={req.id} style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "18px", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Profile row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.avatar_url} alt={p.github_username} style={{ width: "48px", height: "48px", borderRadius: "50%", border: `2px solid ${ic}55`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "15px", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.display_name ?? p.github_username}
                      </div>
                      <div style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace" }}>@{p.github_username}</div>
                      <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", padding: "2px 9px", borderRadius: "20px", background: `${ic}18`, border: `1px solid ${ic}33`, color: ic, fontWeight: 600, textTransform: "capitalize" }}>{p.coding_identity}</span>
                        <span style={{ fontSize: "11px", padding: "2px 9px", borderRadius: "20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b", textTransform: "capitalize" }}>{p.experience_level}</span>
                        {p.languages.slice(0, 3).map(l => (
                          <span key={l} style={{ fontSize: "11px", padding: "2px 9px", borderRadius: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" }}>{l}</span>
                        ))}
                      </div>
                    </div>
                    {req.compatibility_score && (
                      <div style={{ textAlign: "center", flexShrink: 0, padding: "8px 14px", borderRadius: "12px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{req.compatibility_score}</div>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "2px" }}>match</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleAcceptRequest(req.id, req.from_user_id)}
                      style={{ flex: 1, padding: "10px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #059669, #047857)", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
                      onMouseOver={e => (e.currentTarget.style.opacity = "0.9")}
                      onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                    >
                      ✓ Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(req.id)}
                      style={{ flex: 1, padding: "10px", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#f87171", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
                      onMouseOver={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Feed Tab ── */}
        {tab === "feed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>Activity Feed</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>What developers are up to</div>
              </div>
              <button onClick={() => loadFeed(1)} disabled={feedLoading} style={{ fontSize: "12px", color: "#475569", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", cursor: "pointer", padding: "5px 10px" }}>
                Refresh
              </button>
            </div>

            {feedLoading && feedItems.length === 0 && (
              <><FeedSkeleton /><FeedSkeleton /><FeedSkeleton /></>
            )}

            {!feedLoading && feedItems.length === 0 && (
              <EmptyState icon="◈" title="No activity yet" desc="Activity from developers will appear here as people join, connect, and complete challenges.">
                <SecondaryBtn onClick={() => loadFeed(1)} loading={feedLoading} label="Refresh" />
              </EmptyState>
            )}

            {feedItems.map(item => (
              <FeedCard key={item.id} item={item} currentUserId={userId} />
            ))}

            {feedHasMore && (
              <button
                onClick={() => loadFeed(feedPage + 1)}
                disabled={feedLoading}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: feedLoading ? "#475569" : "#94a3b8", fontWeight: 600, fontSize: "14px", cursor: feedLoading ? "not-allowed" : "pointer" }}
              >
                {feedLoading ? "Loading…" : "Load More"}
              </button>
            )}
          </div>
        )}

        {/* ── Story Card Tab ── */}
        {tab === "story" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4px", width: "100%" }}>
            {isLoading("story") ? <StorySkeleton /> : !storyCard ? (
              <EmptyState icon="⟡" title="No story card yet" desc={profile ? "Your AI developer card is loading…" : "Analyze your profile first."}>
                {profile ? <PrimaryBtn onClick={loadStoryCard} loading={loading} label="Generate Story Card" /> : <SecondaryBtn onClick={() => setTab("profile")} loading={false} label="Go to Profile" />}
              </EmptyState>
            ) : (
              <StoryCardComponent
                card={storyCard}
                username={githubUsername}
                avatarUrl={avatarUrl}
                onRegenerate={regenerateStoryCard}
                regenerating={storyRegenerating}
              />
            )}
          </div>
        )}

        {/* ── Achievements Tab ── */}
        {tab === "achievements" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {isLoading("achievements") ? (
              <><AchievementSkeleton /><AchievementSkeleton /><AchievementSkeleton /></>
            ) : (
              (() => {
                const allSlugs = Object.keys(ACHIEVEMENTS) as AchievementSlug[];
                const unlockedSlugs = new Set(achievements.map((a) => a.achievement_slug));
                const lockedSlugs = allSlugs.filter((s) => !unlockedSlugs.has(s));
                const total = allSlugs.length;
                const unlocked = achievements.length;

                return (
                  <>
                    {/* Header */}
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Achievements</div>
                          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                            {unlocked} of {total} unlocked
                          </div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa" }}>
                          {unlocked}<span style={{ fontSize: 14, color: "#475569", fontWeight: 500 }}>/{total}</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          borderRadius: 99,
                          width: `${(unlocked / total) * 100}%`,
                          background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                    </div>

                    {/* Unlocked */}
                    {achievements.length === 0 ? (
                      <EmptyState icon="✦" title="No achievements yet" desc="Connect with developers and solve challenges to earn badges." />
                    ) : (
                      achievements.map((a, i) => <AchievementCard key={a.id} achievement={a} index={i} />)
                    )}

                    {/* Locked */}
                    {lockedSlugs.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 8, marginBottom: 2 }}>
                          Locked
                        </div>
                        {lockedSlugs.map((slug) => (
                          <LockedAchievementCard key={slug} slug={slug} />
                        ))}
                      </>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}

        {/* ── Challenges Tab ── */}
        {tab === "challenges" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Sub-tab bar */}
            <div style={{ display: "flex", gap: "4px", padding: "4px", background: "rgba(13,13,26,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px" }}>
              {(["challenges", "leaderboard"] as const).map((st) => (
                <button key={st} onClick={() => {
                  setChallengeSubTab(st);
                  if (st === "challenges" && challenges.length === 0 && !loading) loadChallenges();
                  if (st === "leaderboard" && leaderboard.length === 0 && !leaderboardLoading) loadLeaderboard();
                }} style={{
                  flex: 1, padding: "8px", borderRadius: "9px", fontSize: "13px", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s", border: "none",
                  ...(challengeSubTab === st
                    ? { background: "rgba(124,58,237,0.2)", color: "#c4b5fd", boxShadow: "0 0 0 1px rgba(124,58,237,0.3)" }
                    : { background: "transparent", color: "#475569" }),
                }}>
                  {st === "challenges" ? "⚡ Challenges" : "🏆 Leaderboard"}
                </button>
              ))}
            </div>

            {/* ── Challenges sub-tab ── */}
            {challengeSubTab === "challenges" && (
              <>
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
              </>
            )}

            {/* ── Leaderboard sub-tab ── */}
            {challengeSubTab === "leaderboard" && (
              <LeaderboardPanel entries={leaderboard} loading={leaderboardLoading} onRefresh={loadLeaderboard} />
            )}
          </div>
        )}
      </main>

      <AchievementToast achievements={newAchievements} onDismiss={() => setNewAchievements([])} />

      {/* Chat panel */}
      {chatUser && (
        <ChatPanel
          currentUserId={userId}
          otherUser={chatUser}
          onClose={() => setChatUser(null)}
          onMessageRead={refreshUnread}
        />
      )}

      {/* Onboarding modal — shown once on first login */}
      {showOnboarding && (
        <OnboardingModal
          githubUsername={githubUsername}
          avatarUrl={avatarUrl}
          initialProfile={profile}
          onComplete={(completedProfile) => {
            setProfile(completedProfile);
            setShowOnboarding(false);
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

/* ── Profile Card ── */
function ProfileCard({ profile, avatarUrl }: { profile: UserProfile; avatarUrl: string }) {
  const identityColor: Record<string, string> = { builder: "#f59e0b", learner: "#34d399", maintainer: "#60a5fa", explorer: "#f472b6" };
  const c = identityColor[profile.coding_identity] ?? "#a78bfa";
  const badges = computeSkillBadges(profile);
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
      <div style={{ marginBottom: badges.length > 0 ? "14px" : 0 }}>
        <div style={{ fontSize: "10px", color: "#334155", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px", fontWeight: 600 }}>Passions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{profile.passion_areas.slice(0, 4).map(p => <Chip key={p} label={p} accent />)}</div>
      </div>
      {badges.length > 0 && <SkillBadges badges={badges} />}
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
    <div className="grid-stats">
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

function RequestSkeleton() {
  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <div className="skeleton" style={{ width: "48px", height: "48px", borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "7px" }}>
          <div className="skeleton" style={{ height: "15px", width: "140px", borderRadius: "6px" }} />
          <div className="skeleton" style={{ height: "11px", width: "100px", borderRadius: "6px" }} />
          <div style={{ display: "flex", gap: "6px" }}>
            {[64, 72, 56].map((w, i) => <div key={i} className="skeleton" style={{ height: "18px", width: `${w}px`, borderRadius: "20px" }} />)}
          </div>
        </div>
        <div className="skeleton" style={{ width: "56px", height: "56px", borderRadius: "12px", flexShrink: 0 }} />
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <div className="skeleton" style={{ flex: 1, height: "40px", borderRadius: "12px" }} />
        <div className="skeleton" style={{ flex: 1, height: "40px", borderRadius: "12px" }} />
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 16px", display: "flex", gap: "12px", alignItems: "center" }}>
      <div className="skeleton" style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "7px" }}>
        <div className="skeleton" style={{ height: "13px", width: "60%", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "11px", width: "35%", borderRadius: "6px" }} />
      </div>
    </div>
  );
}

function FeedCard({ item, currentUserId }: { item: import("@/types").ActivityFeedItem; currentUserId: string }) {
  const EMOJIS = ["👍", "❤️", "🔥", "🚀", "💡"];
  type FeedComment = import("@/types").FeedComment;

  const [reactions, setReactions] = useState<import("@/types").FeedReaction[]>(item.reactions ?? []);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentCount, setCommentCount] = useState(item.commentCount ?? 0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reactingEmoji, setReactingEmoji] = useState<string | null>(null);

  const toggleReaction = async (emoji: string) => {
    if (reactingEmoji) return;
    setReactingEmoji(emoji);
    // Optimistic update
    setReactions(prev => {
      const existing = prev.find(r => r.emoji === emoji);
      if (existing) {
        if (existing.reacted) {
          const newCount = existing.count - 1;
          return newCount === 0
            ? prev.filter(r => r.emoji !== emoji)
            : prev.map(r => r.emoji === emoji ? { ...r, count: newCount, reacted: false } : r);
        } else {
          return prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r);
        }
      }
      return [...prev, { emoji, count: 1, reacted: true }];
    });
    await fetch(`/api/feed/${item.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    setReactingEmoji(null);
  };

  const loadComments = async () => {
    if (commentsLoaded) return;
    const res = await fetch(`/api/feed/${item.id}/comments`);
    const data = await res.json();
    setComments(data.comments ?? []);
    setCommentsLoaded(true);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(v => !v);
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/feed/${item.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    const data = await res.json();
    if (data.comment) {
      setComments(prev => [...prev, data.comment]);
      setCommentCount(c => c + 1);
      setCommentText("");
    }
    setSubmitting(false);
  };

  const actionLabels: Record<string, string> = {
    joined: "joined DevMatch",
    connected: "connected with",
    achievement: "unlocked an achievement",
    challenge: "solved a challenge",
  };

  const actionColors: Record<string, string> = {
    joined: "#34d399",
    connected: "#a78bfa",
    achievement: "#fbbf24",
    challenge: "#22d3ee",
    admin_post: "#a78bfa",
  };

  const timeAgo = (() => {
    const diff = Date.now() - new Date(item.created_at).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  // ── Shared reaction + comment bar ─────────────────────────────────────────
  const InteractionBar = () => (
    <div style={{ marginTop: 12 }}>
      {/* Emoji reaction row */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        {EMOJIS.map(emoji => {
          const r = reactions.find(x => x.emoji === emoji);
          const active = r?.reacted ?? false;
          return (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              disabled={reactingEmoji === emoji}
              title={emoji}
              style={{
                padding: "3px 9px", borderRadius: "20px", fontSize: "13px",
                cursor: "pointer", border: "none", transition: "all 0.12s",
                display: "flex", alignItems: "center", gap: "4px",
                background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.05)",
                boxShadow: active ? "0 0 0 1px rgba(167,139,250,0.4)" : "none",
              }}
            >
              <span>{emoji}</span>
              {r && r.count > 0 && (
                <span style={{ fontSize: "11px", color: active ? "#c4b5fd" : "#64748b", fontVariantNumeric: "tabular-nums" }}>
                  {r.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Comment toggle */}
        <button
          onClick={toggleComments}
          style={{
            marginLeft: "auto", padding: "3px 10px", borderRadius: "20px",
            fontSize: "12px", cursor: "pointer", border: "none",
            background: showComments ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
            color: showComments ? "#94a3b8" : "#475569", transition: "all 0.12s",
            display: "flex", alignItems: "center", gap: "5px",
          }}
        >
          <span>💬</span>
          <span>{commentCount > 0 ? commentCount : ""} {commentCount === 1 ? "comment" : commentCount > 1 ? "comments" : "Comment"}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: "8px" }}>
          {!commentsLoaded && (
            <div style={{ fontSize: 12, color: "#475569" }}>Loading…</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.user.avatar_url} alt={c.user.github_username} style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "7px 11px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.isOwn ? "#c4b5fd" : "#94a3b8", marginRight: 6 }}>
                  {c.user.display_name ?? c.user.github_username}
                </span>
                <span style={{ fontSize: 13, color: "#e2e8f0" }}>{c.content}</span>
              </div>
            </div>
          ))}
          {commentsLoaded && comments.length === 0 && (
            <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "4px 0" }}>No comments yet. Be the first!</div>
          )}
          {/* Comment input */}
          <div style={{ display: "flex", gap: "8px", marginTop: 4 }}>
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value.slice(0, 200))}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              placeholder="Write a comment…"
              style={{
                flex: 1, padding: "8px 12px", borderRadius: "10px", fontSize: "13px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0", outline: "none", fontFamily: "inherit",
              }}
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || submitting}
              style={{
                padding: "8px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                cursor: !commentText.trim() || submitting ? "not-allowed" : "pointer",
                border: "none", transition: "all 0.12s",
                background: commentText.trim() ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)",
                color: commentText.trim() ? "#c4b5fd" : "#475569",
              }}
            >
              {submitting ? "…" : "Post"}
            </button>
          </div>
          {commentText.length > 160 && (
            <div style={{ fontSize: 11, color: commentText.length >= 200 ? "#ef4444" : "#64748b", textAlign: "right" }}>
              {200 - commentText.length} left
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Admin broadcast post ───────────────────────────────────────────────────
  if (item.action_type === "admin_post") {
    const title = item.metadata?.title as string | undefined;
    const content = item.metadata?.content as string | undefined;

    return (
      <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "14px", padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#a78bfa", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", padding: "2px 8px", borderRadius: 20 }}>
            DevMatch
          </span>
          <span style={{ fontSize: 11, color: "#475569" }}>{timeAgo}</span>
        </div>
        {title && <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{title}</div>}
        {content && <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65 }}>{content}</div>}
        <InteractionBar />
      </div>
    );
  }

  // ── Regular activity post ──────────────────────────────────────────────────
  const color = actionColors[item.action_type] ?? "#94a3b8";

  return (
    <div style={{ background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <a href={`/dev/${item.actor.github_username}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.actor.avatar_url} alt={item.actor.github_username} style={{ width: "36px", height: "36px", borderRadius: "50%", border: `1.5px solid ${color}44`, flexShrink: 0, display: "block" }} />
      </a>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", color: "#e2e8f0", lineHeight: 1.5 }}>
          <a href={`/dev/${item.actor.github_username}`} style={{ color: "#f1f5f9", fontWeight: 700, textDecoration: "none" }}>
            {item.actor.display_name ?? item.actor.github_username}
          </a>
          {" "}
          <span style={{ color: color }}>{actionLabels[item.action_type] ?? item.action_type}</span>
          {item.target && item.action_type === "connected" && (
            <>
              {" "}
              <a href={`/dev/${item.target.github_username}`} style={{ color: "#f1f5f9", fontWeight: 700, textDecoration: "none" }}>
                {item.target.display_name ?? item.target.github_username}
              </a>
            </>
          )}
          {item.action_type === "achievement" && !!item.metadata?.name && (
            <span style={{ color: "#64748b" }}> — {item.metadata.icon as string} {item.metadata.name as string}</span>
          )}
          {item.action_type === "challenge" && !!item.metadata?.title && (
            <span style={{ color: "#64748b" }}> — {item.metadata.title as string}</span>
          )}
        </div>
        <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px" }}>{timeAgo}</div>
        <InteractionBar />
      </div>
    </div>
  );
}

/* ── Refresh Analysis Panel ─────────────────────────────────────────────────── */
interface RefreshPanelProps {
  profile: UserProfile;
  refreshing: boolean;
  refreshStep: number;
  cooldownSeconds: number;
  onRefresh: () => void;
}

function RefreshPanel({ profile, refreshing, refreshStep, cooldownSeconds, onRefresh }: RefreshPanelProps) {
  const lastAnalyzed = profile.analysis_cached_at
    ? (() => {
        const diff = Date.now() - new Date(profile.analysis_cached_at).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
      })()
    : "never";

  const fmtCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
    return `${sec}s`;
  };

  const steps = ["Fetching GitHub data…", "AI re-analyzing…", "Profile updated ✓"];
  const inCooldown = cooldownSeconds > 0;

  return (
    <div style={{
      padding: "16px 18px", borderRadius: "14px",
      background: "rgba(13,13,26,0.95)", border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>Profile Analysis</div>
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
            Last analyzed: <span style={{ color: "#64748b" }}>{lastAnalyzed}</span>
            {inCooldown && !refreshing && (
              <span style={{ color: "#f59e0b", marginLeft: "8px" }}>· Available in {fmtCountdown(cooldownSeconds)}</span>
            )}
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing || inCooldown}
          style={{
            padding: "9px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
            cursor: refreshing || inCooldown ? "not-allowed" : "pointer",
            transition: "all 0.15s", border: "none", flexShrink: 0,
            ...(inCooldown
              ? { background: "rgba(255,255,255,0.04)", color: "#334155" }
              : refreshing
              ? { background: "rgba(124,58,237,0.15)", color: "#a78bfa" }
              : { background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.2))", color: "#c4b5fd", boxShadow: "0 0 16px rgba(124,58,237,0.15)" }),
          }}
        >
          {refreshing ? (
            <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ width: 12, height: 12, border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
              Refreshing…
            </span>
          ) : inCooldown ? (
            `⏳ ${fmtCountdown(cooldownSeconds)}`
          ) : (
            "↻ Refresh Analysis"
          )}
        </button>
      </div>

      {/* Progress steps */}
      {refreshing && refreshStep > 0 && (
        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {steps.map((label, i) => {
            const stepNum = i + 1;
            const done = refreshStep > stepNum;
            const active = refreshStep === stepNum;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "9px", fontWeight: 700,
                  ...(done
                    ? { background: "rgba(52,211,153,0.2)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399" }
                    : active
                    ? { background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#334155" }),
                }}>
                  {done ? "✓" : stepNum}
                </div>
                <span style={{ fontSize: "12px", color: done ? "#34d399" : active ? "#a78bfa" : "#334155", transition: "color 0.3s" }}>
                  {label}
                </span>
                {active && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa", animation: "pulse-ring 1s ease-in-out infinite", flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Done state */}
      {!refreshing && refreshStep === 3 && (
        <div style={{ marginTop: "10px", fontSize: "12px", color: "#34d399", display: "flex", alignItems: "center", gap: "6px" }}>
          ✓ Profile refreshed — story card regenerated
        </div>
      )}
    </div>
  );
}

/* ── Leaderboard Panel ────────────────────────────────────────────────────── */
function LeaderboardPanel({ entries, loading, onRefresh }: {
  entries: LeaderboardEntry[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  const medalColors = ["#fbbf24", "#94a3b8", "#cd7c2f"];

  const fmtHrs = (h: number | null) => {
    if (h === null) return "—";
    if (h < 1) return `${Math.round(h * 60)}m`;
    return `${h.toFixed(1)}h`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "12px", color: "#475569" }}>
          {loading ? "Loading…" : `${entries.length} developer${entries.length !== 1 ? "s" : ""} on the board`}
        </div>
        <button onClick={onRefresh} disabled={loading} style={{ fontSize: "12px", color: "#475569", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", cursor: "pointer", padding: "5px 10px" }}>
          Refresh
        </button>
      </div>

      {loading && <><FeedSkeleton /><FeedSkeleton /><FeedSkeleton /></>}

      {!loading && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: "14px" }}>
          No one has solved a challenge yet. Be first!
        </div>
      )}

      {entries.map((e) => {
        const isMedal = e.rank <= 3;
        const medalColor = isMedal ? medalColors[e.rank - 1] : null;
        return (
          <a key={e.user_id} href={`/dev/${e.github_username}`} style={{ textDecoration: "none" }}>
            <div style={{
              background: "rgba(13,13,26,0.95)",
              border: `1px solid ${isMedal ? `${medalColor}33` : "rgba(255,255,255,0.08)"}`,
              borderRadius: "16px", padding: "14px 16px",
              display: "flex", alignItems: "center", gap: "14px",
              boxShadow: isMedal ? `0 0 20px ${medalColor}0d` : "none",
              transition: "transform 0.12s",
              cursor: "pointer",
            }}
              onMouseEnter={e2 => (e2.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"}
              onMouseLeave={e2 => (e2.currentTarget as HTMLDivElement).style.transform = "translateY(0)"}
            >
              {/* Rank */}
              <div style={{ width: "28px", textAlign: "center", flexShrink: 0 }}>
                {isMedal ? (
                  <span style={{ fontSize: "20px" }}>{medals[e.rank - 1]}</span>
                ) : (
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>#{e.rank}</span>
                )}
              </div>

              {/* Avatar */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.avatar_url} alt={e.github_username} style={{ width: "38px", height: "38px", borderRadius: "50%", border: `2px solid ${medalColor ? `${medalColor}55` : "rgba(255,255,255,0.1)"}`, flexShrink: 0 }} />

              {/* Name + stats */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.display_name ?? e.github_username}
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                  {e.easy_count > 0 && <span style={{ fontSize: "11px", padding: "1px 7px", borderRadius: "10px", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>{e.easy_count} easy</span>}
                  {e.medium_count > 0 && <span style={{ fontSize: "11px", padding: "1px 7px", borderRadius: "10px", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>{e.medium_count} medium</span>}
                  {e.hard_count > 0 && <span style={{ fontSize: "11px", padding: "1px 7px", borderRadius: "10px", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>{e.hard_count} hard</span>}
                  {e.streak > 0 && <span style={{ fontSize: "11px", padding: "1px 7px", borderRadius: "10px", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }}>🔥 {e.streak}d streak</span>}
                </div>
              </div>

              {/* Total score + fastest */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: medalColor ?? "#64748b", lineHeight: 1 }}>{e.total_completed}</div>
                <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>solved</div>
                {(e.fastest_hard_hrs !== null || e.fastest_medium_hrs !== null || e.fastest_easy_hrs !== null) && (
                  <div style={{ fontSize: "10px", color: "#334155", marginTop: "3px" }}>
                    fastest {fmtHrs(e.fastest_hard_hrs ?? e.fastest_medium_hrs ?? e.fastest_easy_hrs)}
                  </div>
                )}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

