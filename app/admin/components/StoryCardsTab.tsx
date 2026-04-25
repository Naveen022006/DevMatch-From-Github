"use client";

import Image from "next/image";
import type { AdminStoryCard } from "@/types/admin";

interface Props {
  cards: AdminStoryCard[] | null;
  loading: boolean;
}

export default function StoryCardsTab({ cards, loading }: Props) {
  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
        Story Cards
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
        {cards ? `${cards.length} cards` : "Loading…"}
      </p>

      {loading && (
        <div className="grid-cards">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {!loading && cards && (
        <>
          {cards.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>
              No story cards yet.
            </div>
          ) : (
            <div className="grid-cards">
              {cards.map((card) => {
                const borderColor = (card.primary_color ?? "#a78bfa") + "44";
                return (
                  <div
                    key={card.id}
                    style={{
                      background: "rgba(13,13,26,0.95)",
                      border: `1px solid ${borderColor}`,
                      borderRadius: 12,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {/* User row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {card.user.avatar_url ? (
                        <Image
                          src={card.user.avatar_url}
                          alt={card.user.github_username}
                          width={32}
                          height={32}
                          style={{ borderRadius: "50%" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#1e293b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            color: "#94a3b8",
                          }}
                        >
                          {card.user.github_username[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 13 }}>
                          @{card.user.github_username}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {new Date(card.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div
                        style={{
                          marginLeft: "auto",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: card.primary_color ?? "#a78bfa",
                          flexShrink: 0,
                        }}
                      />
                    </div>

                    {/* Story lines */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[card.line1, card.line2, card.line3, card.line4].map((line, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              color: card.primary_color ?? "#a78bfa",
                              fontWeight: 700,
                              marginTop: 2,
                              flexShrink: 0,
                            }}
                          >
                            {i + 1}.
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}
                            title={line}
                          >
                            {line}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
