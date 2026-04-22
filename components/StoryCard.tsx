"use client";

import { useRef, useCallback } from "react";
import type { StoryCard } from "@/types";

interface StoryCardComponentProps {
  card: StoryCard;
  username: string;
  avatarUrl?: string;
}

export function StoryCardComponent({ card, username, avatarUrl }: StoryCardComponentProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const color = card.primaryColor;

  const downloadAsPng = useCallback(async () => {
    if (!cardRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "#060610",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `${username}-devcard.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [username]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "28px",
      width: "100%",
      padding: "8px 0 24px",
    }}>

      {/* Card */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "480px",
          borderRadius: "24px",
          overflow: "hidden",
          userSelect: "none",
          background: `linear-gradient(145deg, #060610 0%, #0d0d1a 55%, ${color}1a 100%)`,
          border: `1px solid ${color}44`,
          boxShadow: `0 0 80px ${color}25, 0 0 160px ${color}0f, 0 8px 32px rgba(0,0,0,0.6)`,
          padding: "40px 36px 44px",
        }}
      >
        {/* Top glow orb */}
        <div style={{
          position: "absolute",
          top: "-60px",
          right: "-60px",
          width: "220px",
          height: "220px",
          borderRadius: "50%",
          background: color,
          opacity: 0.18,
          filter: "blur(60px)",
          pointerEvents: "none",
        }} />

        {/* Bottom glow */}
        <div style={{
          position: "absolute",
          bottom: "-20px",
          left: "-20px",
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          background: color,
          opacity: 0.09,
          filter: "blur(50px)",
          pointerEvents: "none",
        }} />

        {/* Subtle grid texture */}
        <div style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />

        {/* Header */}
        <div style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "28px",
        }}>
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={username}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                flexShrink: 0,
                border: `2px solid ${color}66`,
              }}
            />
          )}
          <div>
            <p style={{
              margin: 0,
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: `${color}99`,
              fontFamily: "monospace",
              marginBottom: "3px",
            }}>
              Developer Card
            </p>
            <p style={{
              margin: 0,
              fontSize: "14px",
              fontFamily: "monospace",
              fontWeight: 600,
              color,
            }}>
              @{username}
            </p>
          </div>
          <div style={{
            marginLeft: "auto",
            fontSize: "10px",
            padding: "3px 10px",
            borderRadius: "20px",
            fontFamily: "monospace",
            letterSpacing: "0.1em",
            background: `${color}18`,
            border: `1px solid ${color}33`,
            color: `${color}cc`,
            flexShrink: 0,
          }}>
            DEVMATCH
          </div>
        </div>

        {/* Divider */}
        <div style={{
          position: "relative",
          zIndex: 10,
          height: "1px",
          marginBottom: "28px",
          background: `linear-gradient(90deg, ${color}88, ${color}22, transparent)`,
        }} />

        {/* Lines */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", gap: "22px" }}>
          <CardLine number="I" text={card.line1} color={color} large />
          <CardLine number="II" text={card.line2} color={color} />
          <CardLine number="III" text={card.line3} color={color} />
          <CardLine number="IV" text={card.line4} color={color} italic />
        </div>

        {/* Footer */}
        <div style={{
          position: "relative",
          zIndex: 10,
          marginTop: "32px",
          paddingTop: "16px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "10px", color: "#334155", fontFamily: "monospace", letterSpacing: "0.1em" }}>
            DevMatch ✦ 2025
          </span>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 10px ${color}`,
            animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
          }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={downloadAsPng}
          style={{
            padding: "11px 24px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
            background: `${color}22`,
            border: `1px solid ${color}55`,
            color,
          }}
          onMouseOver={e => { e.currentTarget.style.background = `${color}33`; e.currentTarget.style.transform = "scale(1.03)"; }}
          onMouseOut={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.transform = "scale(1)"; }}
        >
          Download PNG
        </button>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: `${username}'s DevCard`, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }}
          style={{
            padding: "11px 24px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
          }}
          onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.transform = "scale(1.03)"; }}
          onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "scale(1)"; }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

function CardLine({
  number,
  text,
  color,
  large,
  italic,
}: {
  number: string;
  text: string;
  color: string;
  large?: boolean;
  italic?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      <span style={{
        fontSize: "10px",
        fontFamily: "monospace",
        marginTop: large ? "5px" : "3px",
        flexShrink: 0,
        width: "16px",
        textAlign: "right",
        userSelect: "none",
        color: `${color}55`,
      }}>
        {number}
      </span>
      <p style={{
        margin: 0,
        lineHeight: 1.4,
        fontSize: large ? "22px" : "15px",
        fontWeight: large ? 700 : 500,
        fontStyle: italic ? "italic" : "normal",
        color: large ? "#ffffff" : "rgba(255,255,255,0.82)",
      }}>
        {text}
      </p>
    </div>
  );
}
