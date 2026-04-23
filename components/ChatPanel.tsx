"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";

interface ChatUser {
  id: string;
  username: string;
  avatarUrl: string;
}

interface ChatPanelProps {
  currentUserId: string;
  otherUser: ChatUser;
  onClose: () => void;
  onMessageRead: () => void; // notify parent to refresh unread count
}

export function ChatPanel({ currentUserId, otherUser, onClose, onMessageRead }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // Mark messages as read
  const markRead = useCallback(async () => {
    await fetch("/api/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId: otherUser.id }),
    });
    onMessageRead();
  }, [otherUser.id, onMessageRead]);

  // Fetch conversation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/messages?with=${otherUser.id}`);
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) { setError(json.error); setLoading(false); return; }
      setMessages(json.messages);
      setLoading(false);
      scrollToBottom();
      await markRead();
    })();
    return () => { cancelled = true; };
  }, [otherUser.id, markRead, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${[currentUserId, otherUser.id].sort().join(":")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id !== otherUser.id) return; // not from this conversation
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          scrollToBottom();
          markRead();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, otherUser.id]);

  // Auto-focus input
  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);

    // Optimistic insert
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: otherUser.id,
      content: text,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    scrollToBottom();

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: otherUser.id, content: text }),
    });
    const json = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(json.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      return;
    }
    // Replace optimistic with real message
    setMessages((prev) =>
      prev.map((m) => (m.id === optimistic.id ? (json.message as Message) : m))
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const last = acc[acc.length - 1];
    if (last?.date === date) { last.msgs.push(msg); }
    else { acc.push({ date, msgs: [msg] }); }
    return acc;
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 49,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: "min(420px, 100vw)",
        display: "flex", flexDirection: "column",
        background: "#0a0a1a",
        borderLeft: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.6)",
        animation: "slideInRight 0.22s ease-out",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(13,13,26,0.98)",
          flexShrink: 0,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={otherUser.avatarUrl}
            alt={otherUser.username}
            style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid rgba(124,58,237,0.5)", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{otherUser.username}
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>Developer</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "4px 8px", borderRadius: 6 }}
            onMouseOver={e => (e.currentTarget.style.color = "#94a3b8")}
            onMouseOut={e => (e.currentTarget.style.color = "#475569")}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "20px 0" }}>
              {[70, 50, 80, 55].map((w, i) => (
                <div key={i} style={{
                  alignSelf: i % 2 === 0 ? "flex-start" : "flex-end",
                  height: 36, width: `${w}%`, borderRadius: 12,
                  background: "rgba(255,255,255,0.05)",
                  animation: "skeleton-pulse 1.4s ease-in-out infinite",
                }} />
              ))}
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 60 }}>
              <div style={{ fontSize: 36 }}>💬</div>
              <div style={{ fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.6 }}>
                No messages yet.<br />Say hello to @{otherUser.username}!
              </div>
            </div>
          )}

          {!loading && groupedMessages.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date separator */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                <span style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: "0.08em" }}>{date}</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
              </div>

              {/* Message bubbles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {msgs.map((msg) => {
                  const isMine = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMine ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={{
                        maxWidth: "78%",
                        padding: "10px 14px",
                        borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        fontSize: 14,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                        ...(isMine
                          ? { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff" }
                          : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }),
                      }}>
                        {msg.content}
                      </div>
                      <span style={{ fontSize: 10, color: "#334155", marginTop: 3, paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0 }}>
                        {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: "0 18px 8px", padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>×</button>
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: "14px 18px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(13,13,26,0.98)",
          display: "flex", gap: 10, alignItems: "center",
          flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={`Message @${otherUser.username}…`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: "#e2e8f0",
              fontSize: 14, outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            style={{
              padding: "11px 18px", borderRadius: 12, border: "none",
              background: !draft.trim() || sending ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: !draft.trim() || sending ? "#475569" : "#fff",
              cursor: !draft.trim() || sending ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 700, flexShrink: 0,
              transition: "all 0.15s",
              boxShadow: draft.trim() && !sending ? "0 0 16px rgba(124,58,237,0.35)" : "none",
            }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </>
  );
}
