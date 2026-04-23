"use client";

import { useState } from "react";

interface Props {
  targetUserId: string;
  targetUsername: string;
  viewerId: string;
  isMatch: boolean;
}

export function ProfileActions({ targetUserId, targetUsername, viewerId, isMatch }: Props) {
  const [status, setStatus] = useState<"none" | "pending" | "accepted">(
    isMatch ? "accepted" : "none"
  );
  const [sending, setSending] = useState(false);

  if (status === "accepted") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 22px", borderRadius: "14px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontWeight: 700, fontSize: "14px" }}>
        ✓ Connected
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 22px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b", fontWeight: 600, fontSize: "14px" }}>
        ⏳ Request Sent
      </div>
    );
  }

  const handleConnect = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: targetUserId }),
      });
      if (res.ok) setStatus("pending");
    } catch { /* non-critical */ }
    finally { setSending(false); }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={sending}
      style={{
        display: "inline-flex", alignItems: "center", gap: "8px",
        padding: "13px 28px", borderRadius: "14px",
        background: sending ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
        color: sending ? "#475569" : "#fff",
        fontWeight: 700, fontSize: "15px", border: "none", cursor: sending ? "not-allowed" : "pointer",
        boxShadow: sending ? "none" : "0 0 24px rgba(124,58,237,0.3)",
        transition: "all 0.15s",
      }}
    >
      {sending ? "Sending…" : `Connect with @${targetUsername} →`}
    </button>
  );
}
