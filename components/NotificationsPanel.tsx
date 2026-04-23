"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  user_id: string;
  type: "connection_request" | "connection_accepted" | "message" | "achievement" | "challenge_result";
  message: string;
  link: string;
  read: boolean;
  created_at: string;
}

interface Props {
  userId: string;
  onNavigate: (link: string) => void;
}

const TYPE_ICON: Record<string, string> = {
  connection_request: "🤝",
  connection_accepted: "✓",
  message: "💬",
  achievement: "✦",
  challenge_result: "⚡",
};

const TYPE_COLOR: Record<string, string> = {
  connection_request: "#a78bfa",
  connection_accepted: "#34d399",
  message: "#22d3ee",
  achievement: "#fbbf24",
  challenge_result: "#f472b6",
};

export function NotificationsPanel({ userId, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const j = await res.json();
        setNotifications(j.notifications ?? []);
        setUnread(j.unread ?? 0);
      }
    } catch { /* non-critical */ }
    setLoading(false);
  }, []);

  // Fetch on mount once
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev].slice(0, 50));
          setUnread((c) => c + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((c) => Math.max(0, c - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setMarkingAll(false);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    onNavigate(n.link);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetchNotifications(); }}
        style={{
          position: "relative", width: "34px", height: "34px", borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.1)", background: open ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.05)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", color: open ? "#c4b5fd" : "#64748b", fontSize: "16px",
        }}
        onMouseOver={e => { if (!open) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
        onMouseOut={e => { if (!open) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "-4px", right: "-4px",
            minWidth: "16px", height: "16px", borderRadius: "8px",
            background: "#ef4444", color: "#fff", fontSize: "9px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
            border: "2px solid #060610",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0,
          width: "340px", maxHeight: "480px",
          background: "rgba(10,10,22,0.98)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px", boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          zIndex: 999, display: "flex", flexDirection: "column",
          backdropFilter: "blur(20px)", overflow: "hidden",
          animation: "fade-in 0.15s ease-out",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "#f1f5f9" }}>
              Notifications
              {unread > 0 && (
                <span style={{ marginLeft: "7px", padding: "1px 7px", borderRadius: "10px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "11px", fontWeight: 700 }}>
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                style={{ fontSize: "11px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                {markingAll ? "…" : "Mark all read"}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#475569", fontSize: "13px" }}>Loading…</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔔</div>
                <div style={{ fontSize: "13px", color: "#475569" }}>No notifications yet</div>
              </div>
            ) : (
              notifications.map((n) => {
                const ic = TYPE_ICON[n.type] ?? "●";
                const col = TYPE_COLOR[n.type] ?? "#64748b";
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    style={{
                      width: "100%", textAlign: "left", padding: "12px 16px",
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      background: n.read ? "transparent" : "rgba(124,58,237,0.06)",
                      border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)",
                      cursor: "pointer", transition: "background 0.12s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = n.read ? "rgba(255,255,255,0.03)" : "rgba(124,58,237,0.1)")}
                    onMouseOut={e => (e.currentTarget.style.background = n.read ? "transparent" : "rgba(124,58,237,0.06)")}
                  >
                    {/* Icon */}
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${col}18`, border: `1px solid ${col}33`, fontSize: "14px",
                    }}>
                      {ic}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", color: n.read ? "#64748b" : "#e2e8f0", lineHeight: 1.45 }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: "11px", color: "#334155", marginTop: "3px" }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#a78bfa", flexShrink: 0, marginTop: "4px" }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
