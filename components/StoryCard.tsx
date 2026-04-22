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
    <div className="flex flex-col items-center gap-6 w-full animate-fade-up">
      {/* Card */}
      <div
        ref={cardRef}
        className="relative w-full max-w-[380px] rounded-2xl overflow-hidden select-none"
        style={{
          background: `linear-gradient(145deg, #060610 0%, #0d0d1a 55%, ${color}1a 100%)`,
          border: `1px solid ${color}44`,
          boxShadow: `0 0 60px ${color}22, 0 0 120px ${color}0a`,
          padding: "36px 32px 40px",
        }}
      >
        {/* Top glow orb */}
        <div
          className="absolute -top-12 -right-12 w-52 h-52 rounded-full blur-3xl pointer-events-none"
          style={{ background: color, opacity: 0.15 }}
        />
        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ background: color, opacity: 0.07 }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-center gap-3 mb-7">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={username}
              className="w-9 h-9 rounded-full shrink-0"
              style={{ border: `2px solid ${color}66` }}
            />
          )}
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: `${color}88` }}>
              Developer Card
            </p>
            <p className="text-sm font-mono font-medium" style={{ color }}>
              @{username}
            </p>
          </div>
          <div
            className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-mono tracking-wider"
            style={{
              background: `${color}18`,
              border: `1px solid ${color}33`,
              color: `${color}cc`,
            }}
          >
            DEVMATCH
          </div>
        </div>

        {/* Divider */}
        <div
          className="relative z-10 h-px mb-7"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color}22, transparent)` }}
        />

        {/* Lines */}
        <div className="relative z-10 space-y-6">
          <Line number="I" text={card.line1} color={color} large />
          <Line number="II" text={card.line2} color={color} />
          <Line number="III" text={card.line3} color={color} />
          <Line number="IV" text={card.line4} color={color} italic />
        </div>

        {/* Footer */}
        <div
          className="relative z-10 mt-9 pt-4 flex items-center justify-between"
          style={{ borderTop: `1px solid rgba(255,255,255,0.05)` }}
        >
          <span className="text-[10px] text-slate-600 font-mono tracking-wider">
            DevMatch ✦ 2024
          </span>
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={downloadAsPng}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          style={{
            background: `${color}22`,
            border: `1px solid ${color}55`,
            color,
          }}
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
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
          }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

function Line({
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
    <div className="flex gap-3 items-start">
      <span
        className="text-[10px] font-mono mt-1 shrink-0 w-5 text-right select-none"
        style={{ color: `${color}66` }}
      >
        {number}
      </span>
      <p
        className={`leading-snug ${large ? "text-xl font-bold" : "text-[15px] font-medium"} ${italic ? "italic" : ""}`}
        style={{ color: large ? "#ffffff" : "rgba(255,255,255,0.82)" }}
      >
        {text}
      </p>
    </div>
  );
}
