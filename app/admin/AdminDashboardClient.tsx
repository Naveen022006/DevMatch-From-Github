"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import OverviewTab from "./components/OverviewTab";
import UsersTab from "./components/UsersTab";
import MatchesTab from "./components/MatchesTab";
import AchievementsTab from "./components/AchievementsTab";
import StoryCardsTab from "./components/StoryCardsTab";
import LeaderboardTab from "./components/LeaderboardTab";
import FeedPostsTab from "./components/FeedPostsTab";
import type {
  AdminTab,
  AdminStats,
  AdminUser,
  AdminMatch,
  AdminAchievement,
  AchievementSlugCount,
  AdminStoryCard,
  Challenge,
} from "@/types/admin";
import type { LeaderboardEntry as LBEntry } from "@/app/api/leaderboard/route";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "matches", label: "Matches" },
  { id: "achievements", label: "Achievements" },
  { id: "story-cards", label: "Story Cards" },
  { id: "leaderboard", label: "Leaderboard 🏆" },
  { id: "feed-posts", label: "Feed Posts" },
];

interface Props {
  githubUsername: string;
  avatarUrl: string;
}

export default function AdminDashboardClient({ githubUsername, avatarUrl }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [loadingTab, setLoadingTab] = useState<AdminTab | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [matches, setMatches] = useState<AdminMatch[] | null>(null);
  const [achievements, setAchievements] = useState<AdminAchievement[] | null>(null);
  const [slugSummary, setSlugSummary] = useState<AchievementSlugCount[] | null>(null);
  const [cards, setCards] = useState<AdminStoryCard[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LBEntry[] | null>(null);
  const [lbChallenges, setLbChallenges] = useState<Challenge[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (stats) return;
    setLoadingTab("overview");
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setStats(json.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoadingTab(null);
    }
  }, [stats]);

  const fetchUsers = useCallback(async () => {
    if (users) return;
    setLoadingTab("users");
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(json.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoadingTab(null);
    }
  }, [users]);

  const fetchMatches = useCallback(async () => {
    if (matches) return;
    setLoadingTab("matches");
    setError(null);
    try {
      const res = await fetch("/api/admin/matches");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMatches(json.matches);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load matches");
    } finally {
      setLoadingTab(null);
    }
  }, [matches]);

  const fetchAchievements = useCallback(async () => {
    if (achievements) return;
    setLoadingTab("achievements");
    setError(null);
    try {
      const res = await fetch("/api/admin/achievements");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAchievements(json.achievements);
      setSlugSummary(json.slugSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load achievements");
    } finally {
      setLoadingTab(null);
    }
  }, [achievements]);

  const fetchCards = useCallback(async () => {
    if (cards) return;
    setLoadingTab("story-cards");
    setError(null);
    try {
      const res = await fetch("/api/admin/story-cards");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCards(json.cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load story cards");
    } finally {
      setLoadingTab(null);
    }
  }, [cards]);

  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const [lbRes, chRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/admin/challenges"),
      ]);
      if (lbRes.ok) { const j = await lbRes.json(); setLeaderboard(j.entries ?? []); }
      if (chRes.ok) { const j = await chRes.json(); setLbChallenges(j.challenges ?? []); }
    } catch { /* non-critical */ }
    setLbLoading(false);
  }, []);

  // Auto-load overview on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function handleTabSwitch(tab: AdminTab) {
    setActiveTab(tab);
    if (tab === "overview") fetchStats();
    else if (tab === "users") fetchUsers();
    else if (tab === "matches") fetchMatches();
    else if (tab === "achievements") fetchAchievements();
    else if (tab === "story-cards") fetchCards();
    else if (tab === "leaderboard") fetchLeaderboard();
  }

  // ─── Delete handlers (optimistic) ────────────────────────────────────────────

  async function handleDeleteUser(userId: string) {
    setUsers((prev) => prev?.filter((u) => u.id !== userId) ?? null);
    setStats((prev) =>
      prev ? { ...prev, totalUsers: Math.max(0, prev.totalUsers - 1) } : null
    );
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setUsers(null);
      fetchUsers();
    }
  }

  async function handleDeleteMatch(matchId: string) {
    setMatches((prev) => prev?.filter((m) => m.id !== matchId) ?? null);
    setStats((prev) =>
      prev ? { ...prev, totalMatches: Math.max(0, prev.totalMatches - 1) } : null
    );
    try {
      const res = await fetch("/api/admin/matches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setMatches(null);
      fetchMatches();
    }
  }

  async function handleDeleteAchievement(achievementId: string) {
    setAchievements((prev) => prev?.filter((a) => a.id !== achievementId) ?? null);
    setStats((prev) =>
      prev
        ? { ...prev, totalAchievements: Math.max(0, prev.totalAchievements - 1) }
        : null
    );
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievementId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setAchievements(null);
      fetchAchievements();
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060610",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(6,6,16,0.92)",
          backdropFilter: "blur(12px)",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>DevMatch</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 20,
              background: "rgba(239,68,68,0.2)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#f87171",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            ADMIN
          </span>
        </div>

        <Link
          href="/dashboard"
          style={{
            fontSize: 13,
            color: "#64748b",
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          ← Dashboard
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {avatarUrl && (
            <Image
              src={avatarUrl}
              alt={githubUsername}
              width={30}
              height={30}
              style={{ borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)" }}
            />
          )}
          <span style={{ fontSize: 13, color: "#94a3b8" }}>@{githubUsername}</span>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.09)",
            background: "transparent",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Sign out
        </button>
      </nav>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {/* Error banner */}
        {error && (
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
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 32,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            padding: 4,
            width: "fit-content",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              style={{
                padding: "8px 18px",
                borderRadius: 7,
                border: "none",
                background:
                  activeTab === tab.id ? "rgba(167,139,250,0.15)" : "transparent",
                color:
                  activeTab === tab.id ? "#a78bfa" : "#64748b",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: "all 0.15s",
                outline:
                  activeTab === tab.id
                    ? "1px solid rgba(167,139,250,0.25)"
                    : "none",
              }}
            >
              {tab.label}
              {loadingTab === tab.id && (
                <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 11 }}>…</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          style={{
            background: "rgba(13,13,26,0.6)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "28px 28px",
          }}
        >
          {activeTab === "overview" && (
            <OverviewTab stats={stats} loading={loadingTab === "overview"} />
          )}
          {activeTab === "users" && (
            <UsersTab
              users={users}
              loading={loadingTab === "users"}
              onDelete={handleDeleteUser}
            />
          )}
          {activeTab === "matches" && (
            <MatchesTab
              matches={matches}
              loading={loadingTab === "matches"}
              onDelete={handleDeleteMatch}
            />
          )}
          {activeTab === "achievements" && (
            <AchievementsTab
              achievements={achievements}
              slugSummary={slugSummary}
              loading={loadingTab === "achievements"}
              onDelete={handleDeleteAchievement}
              onAwardComplete={() => {
                // Force re-fetch achievements after bulk award
                setAchievements(null);
                setSlugSummary(null);
                fetchAchievements();
              }}
            />
          )}
          {activeTab === "story-cards" && (
            <StoryCardsTab
              cards={cards}
              loading={loadingTab === "story-cards"}
            />
          )}
          {activeTab === "leaderboard" && (
            <LeaderboardTab
              entries={leaderboard ?? []}
              challenges={lbChallenges}
              loading={lbLoading}
              onRefresh={fetchLeaderboard}
            />
          )}
          {activeTab === "feed-posts" && (
            <FeedPostsTab onError={setError} />
          )}
        </div>
      </div>
    </div>
  );
}
