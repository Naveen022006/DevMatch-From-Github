"use client";

import { useState } from "react";
import Image from "next/image";
import type { AdminUser } from "@/types/admin";

const BG_CARD = "rgba(13,13,26,0.95)";
const BORDER = "rgba(255,255,255,0.09)";

interface Props {
  users: AdminUser[] | null;
  loading: boolean;
  onDelete: (userId: string) => void;
}

export default function UsersTab({ users, loading, onDelete }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleDelete(userId: string) {
    if (confirmId === userId) {
      onDelete(userId);
      setConfirmId(null);
    } else {
      setConfirmId(userId);
      // Auto-cancel confirm after 3s
      setTimeout(() => setConfirmId((c) => (c === userId ? null : c)), 3000);
    }
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
        Users
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
        {users ? `${users.length} users` : "Loading…"}
      </p>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {!loading && users && (
        <div className="overflow-x-auto">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["User", "Identity", "Level", "Languages", "Repos", "Stars", "Analyzed", ""].map(
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
              {users.map((u) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: `1px solid ${BORDER}`,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background =
                      "rgba(255,255,255,0.03)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                  }
                >
                  <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {u.avatar_url ? (
                        <Image
                          src={u.avatar_url}
                          alt={u.github_username}
                          width={28}
                          height={28}
                          style={{ borderRadius: "50%" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#1e293b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            color: "#94a3b8",
                          }}
                        >
                          {u.github_username[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: "#e2e8f0" }}>
                          @{u.github_username}
                        </div>
                        {u.display_name && (
                          <div style={{ fontSize: 11, color: "#64748b" }}>{u.display_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: "rgba(167,139,250,0.15)",
                        color: "#a78bfa",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {u.coding_identity}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8" }} className="whitespace-nowrap">
                    {u.experience_level}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(u.languages ?? []).slice(0, 3).map((lang) => (
                        <span
                          key={lang}
                          style={{
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: "rgba(34,211,238,0.1)",
                            color: "#22d3ee",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {lang}
                        </span>
                      ))}
                      {(u.languages ?? []).length > 3 && (
                        <span style={{ fontSize: 10, color: "#64748b" }}>
                          +{(u.languages ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    style={{ padding: "10px 12px", color: "#94a3b8", textAlign: "right" }}
                    className="whitespace-nowrap"
                  >
                    {u.total_repos}
                  </td>
                  <td
                    style={{ padding: "10px 12px", color: "#fbbf24", textAlign: "right" }}
                    className="whitespace-nowrap"
                  >
                    ★ {u.total_stars}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }} className="whitespace-nowrap">
                    {u.analysis_cached_at
                      ? new Date(u.analysis_cached_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }} className="whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(u.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: `1px solid ${confirmId === u.id ? "#ef4444" : "rgba(239,68,68,0.3)"}`,
                        background:
                          confirmId === u.id ? "rgba(239,68,68,0.2)" : "transparent",
                        color: confirmId === u.id ? "#ef4444" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        transition: "all 0.15s",
                      }}
                    >
                      {confirmId === u.id ? "Confirm?" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>
              No users yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
