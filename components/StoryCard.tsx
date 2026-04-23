"use client";

import { useRef, useCallback, useState } from "react";
import type { StoryCard } from "@/types";

interface StoryCardComponentProps {
  card: StoryCard;
  username: string;
  avatarUrl?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function StoryCardComponent({ card, username, avatarUrl, onRegenerate, regenerating }: StoryCardComponentProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
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

  const profileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/dev/${username}`;

  const shareOnTwitter = useCallback(() => {
    const text = encodeURIComponent(`Check out my developer story card on DevMatch! ✦`);
    const url = encodeURIComponent(profileUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
  }, [profileUrl]);

  const shareOnLinkedIn = useCallback(() => {
    const url = encodeURIComponent(profileUrl);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank", "noopener,noreferrer");
  }, [profileUrl]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = profileUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [profileUrl]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "28px",
      width: "100%",
      paddingBottom: "32px",
    }}>

      {/* Card */}
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: "100%",
          borderRadius: "24px",
          overflow: "hidden",
          userSelect: "none",
          background: `linear-gradient(145deg, #060610 0%, #0d0d1a 55%, ${color}1a 100%)`,
          border: `1px solid ${color}44`,
          boxShadow: `0 0 80px ${color}25, 0 0 160px ${color}0f, 0 8px 40px rgba(0,0,0,0.7)`,
          padding: "44px 40px 48px",
        }}
      >
        {/* Top glow orb */}
        <div style={{
          position: "absolute",
          top: "-80px",
          right: "-80px",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          background: color,
          opacity: 0.18,
          filter: "blur(80px)",
          pointerEvents: "none",
        }} />
        {/* Bottom glow */}
        <div style={{
          position: "absolute",
          bottom: "-40px",
          left: "-40px",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background: color,
          opacity: 0.09,
          filter: "blur(60px)",
          pointerEvents: "none",
        }} />
        {/* Grid texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        {/* Header */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={username}
              style={{ width: "48px", height: "48px", borderRadius: "50%", flexShrink: 0, border: `2px solid ${color}66` }}
            />
          )}
          <div>
            <p style={{ margin: 0, fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: `${color}88`, fontFamily: "monospace", marginBottom: "4px" }}>
              Developer Card
            </p>
            <p style={{ margin: 0, fontSize: "15px", fontFamily: "monospace", fontWeight: 600, color }}>
              @{username}
            </p>
          </div>
          <div style={{
            marginLeft: "auto",
            fontSize: "10px",
            padding: "4px 12px",
            borderRadius: "20px",
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            background: `${color}18`,
            border: `1px solid ${color}33`,
            color: `${color}cc`,
            flexShrink: 0,
            fontWeight: 700,
          }}>
            DEVMATCH
          </div>
        </div>

        {/* Divider */}
        <div style={{
          position: "relative", zIndex: 10, height: "1px", marginBottom: "32px",
          background: `linear-gradient(90deg, ${color}88, ${color}22, transparent)`,
        }} />

        {/* Lines */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", gap: "24px" }}>
          <CardLine number="I" text={card.line1} color={color} large />
          <CardLine number="II" text={card.line2} color={color} />
          <CardLine number="III" text={card.line3} color={color} />
          <CardLine number="IV" text={card.line4} color={color} italic />
        </div>

        {/* Footer */}
        <div style={{
          position: "relative", zIndex: 10, marginTop: "36px", paddingTop: "18px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "10px", color: "#334155", fontFamily: "monospace", letterSpacing: "0.12em" }}>
            DevMatch ✦ 2025
          </span>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: color, boxShadow: `0 0 10px ${color}`,
            animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
          }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={downloadAsPng}
          style={{
            padding: "11px 20px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s",
            background: `${color}22`, border: `1px solid ${color}55`, color,
          }}
          onMouseOver={e => { e.currentTarget.style.background = `${color}33`; e.currentTarget.style.transform = "scale(1.03)"; }}
          onMouseOut={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.transform = "scale(1)"; }}
        >
          ↓ Download PNG
        </button>
        <button
          onClick={shareOnTwitter}
          style={{
            padding: "11px 20px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s",
            background: "rgba(29,161,242,0.1)", border: "1px solid rgba(29,161,242,0.3)", color: "#1da1f2",
          }}
          onMouseOver={e => { e.currentTarget.style.background = "rgba(29,161,242,0.18)"; e.currentTarget.style.transform = "scale(1.03)"; }}
          onMouseOut={e => { e.currentTarget.style.background = "rgba(29,161,242,0.1)"; e.currentTarget.style.transform = "scale(1)"; }}
        >
          𝕏 Twitter
        </button>
        <button
          onClick={shareOnLinkedIn}
          style={{
            padding: "11px 20px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s",
            background: "rgba(10,102,194,0.1)", border: "1px solid rgba(10,102,194,0.3)", color: "#0a66c2",
          }}
          onMouseOver={e => { e.currentTarget.style.background = "rgba(10,102,194,0.18)"; e.currentTarget.style.transform = "scale(1.03)"; }}
          onMouseOut={e => { e.currentTarget.style.background = "rgba(10,102,194,0.1)"; e.currentTarget.style.transform = "scale(1)"; }}
        >
          in LinkedIn
        </button>
        <button
          onClick={copyLink}
          style={{
            padding: "11px 20px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s",
            background: copied ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)",
            border: copied ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.1)",
            color: copied ? "#34d399" : "#94a3b8",
          }}
          onMouseOver={e => { if (!copied) { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.transform = "scale(1.03)"; } }}
          onMouseOut={e => { if (!copied) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "scale(1)"; } }}
        >
          {copied ? "✓ Copied!" : "⎘ Copy Link"}
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            style={{
              padding: "11px 20px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
              cursor: regenerating ? "not-allowed" : "pointer", transition: "all 0.15s",
              background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)",
              color: regenerating ? "#475569" : "#a78bfa",
              display: "flex", alignItems: "center", gap: "8px",
            }}
            onMouseOver={e => { if (!regenerating) e.currentTarget.style.background = "rgba(124,58,237,0.18)"; }}
            onMouseOut={e => { e.currentTarget.style.background = "rgba(124,58,237,0.1)"; }}
          >
            {regenerating ? (
              <><span style={{ width: 13, height: 13, border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Regenerating…</>
            ) : "✦ Regenerate"}
          </button>
        )}
      </div>
    </div>
  );
}

function CardLine({ number, text, color, large, italic }: {
  number: string; text: string; color: string; large?: boolean; italic?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "18px", alignItems: "flex-start" }}>
      <span style={{
        fontSize: "10px", fontFamily: "monospace",
        marginTop: large ? "6px" : "3px",
        flexShrink: 0, width: "14px", textAlign: "right",
        userSelect: "none", color: `${color}55`,
        letterSpacing: "0.05em",
      }}>
        {number}
      </span>
      <p style={{
        margin: 0,
        lineHeight: large ? 1.3 : 1.55,
        fontSize: large ? "24px" : "15px",
        fontWeight: large ? 800 : 500,
        fontStyle: italic ? "italic" : "normal",
        color: large ? "#ffffff" : "rgba(255,255,255,0.82)",
        letterSpacing: large ? "-0.02em" : "normal",
      }}>
        {text}
      </p>
    </div>
  );
}
