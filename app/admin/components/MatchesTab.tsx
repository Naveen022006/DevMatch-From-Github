"use client";

import { useState } from "react";
import Image from "next/image";
import type { AdminMatch } from "@/types/admin";

const BORDER = "rgba(255,255,255,0.09)";

interface Props {
  matches: AdminMatch[] | null;
  loading: boolean;
  onDelete: (matchId: string) => void;
}

function scoreColor(n: number): string {
  if (n >= 90) return "#22d3ee";
  if (n >= 75) return "#a78bfa";
  if (n >= 60) return "#34d399";
  return "#94a3b8";
}

function UserCell({ user }: { user: AdminMatch["user1"] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {user.avatar_url ? (
        <Image
          src={user.avatar_url}
          alt={user.github_username}
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
          {user.github_username[0]?.toUpperCase()}
        </div>
      )}
      <span style={{ color: "#e2e8f0", fontWeight: 500, fontSize: 13 }}>
        @{user.github_username}
      </span>
    </div>
  );
}

export default function MatchesTab({ matches, loading, onDelete }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (confirmId === id) {
      onDelete(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 3000);
    }
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
        Matches
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
        {matches ? `${matches.length} matches` : "Loading…"}
      </p>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {!loading && matches && (
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["User 1", "User 2", "Total", "Tech", "Learn", "Collab", "Vibe", "Reason", "Date", ""].map(
                  (h) => (
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
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr
                  key={m.id}
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
                    <UserCell user={m.user1} />
                  </td>
                  <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                    <UserCell user={m.user2} />
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: scoreColor(m.compatibility_total) }} className="whitespace-nowrap">
                    {m.compatibility_total}%
                  </td>
                  <td style={{ padding: "10px 12px", color: scoreColor(m.technical_synergy) }} className="whitespace-nowrap">
                    {m.technical_synergy}
                  </td>
                  <td style={{ padding: "10px 12px", color: scoreColor(m.learning_potential) }} className="whitespace-nowrap">
                    {m.learning_potential}
                  </td>
                  <td style={{ padding: "10px 12px", color: scoreColor(m.collaboration_score) }} className="whitespace-nowrap">
                    {m.collaboration_score}
                  </td>
                  <td style={{ padding: "10px 12px", color: scoreColor(m.personality_fit) }} className="whitespace-nowrap">
                    {m.personality_fit}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", maxWidth: 200 }}>
                    <span title={m.match_reason}>
                      {m.match_reason?.length > 60
                        ? m.match_reason.slice(0, 60) + "…"
                        : m.match_reason ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }} className="whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(m.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: `1px solid ${confirmId === m.id ? "#ef4444" : "rgba(239,68,68,0.3)"}`,
                        background: confirmId === m.id ? "rgba(239,68,68,0.2)" : "transparent",
                        color: confirmId === m.id ? "#ef4444" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        transition: "all 0.15s",
                      }}
                    >
                      {confirmId === m.id ? "Confirm?" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {matches.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>
              No matches yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
