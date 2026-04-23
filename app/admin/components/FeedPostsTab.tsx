"use client";

import { useState, useEffect, useCallback } from "react";

interface AdminPost {
  id: string;
  actor_id: string;
  action_type: string;
  metadata: {
    title: string;
    content: string;
    topic: string | null;
    admin_username: string;
  };
  created_at: string;
}

interface Props {
  onError: (msg: string) => void;
}

export default function FeedPostsTab({ onError }: Props) {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(false);

  // Compose form
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feed-posts");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPosts(json.posts ?? []);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setDraftTitle("");
    setDraftContent("");
    setPublishedId(null);
    try {
      const res = await fetch("/api/admin/feed-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", topic: topic.trim(), context: context.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDraftTitle(json.title ?? "");
      setDraftContent(json.content ?? "");
    } catch (e) {
      onError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!draftTitle.trim() || !draftContent.trim()) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/feed-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          title: draftTitle.trim(),
          content: draftContent.trim(),
          topic: topic.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPublishedId(json.post?.id ?? null);
      setTopic("");
      setContext("");
      setDraftTitle("");
      setDraftContent("");
      setPosts((prev) => [json.post, ...prev]);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to publish post");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      const res = await fetch("/api/admin/feed-posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
      fetchPosts();
    }
  }

  const hasDraft = draftTitle.trim() || draftContent.trim();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
          Feed Posts
        </div>
        <div style={{ fontSize: 13, color: "#475569" }}>
          Use AI to generate and publish community posts directly to the developer feed.
        </div>
      </div>

      {/* ── Compose Panel ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(167,139,250,0.05)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 16, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Compose with AI
        </div>

        {/* Topic input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>
            Topic / Prompt
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !generating && topic.trim() && handleGenerate()}
            placeholder="e.g. Tips for finding the right coding partner, New TypeScript features…"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e2e8f0",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Optional context */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>
            Additional Context <span style={{ color: "#475569" }}>(optional)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Any specific angle, data, or tone to include…"
            rows={2}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e2e8f0",
              fontSize: 13,
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !topic.trim()}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: "none",
            background: generating || !topic.trim() ? "rgba(167,139,250,0.2)" : "rgba(167,139,250,0.85)",
            color: generating || !topic.trim() ? "#7c6dad" : "#0f0f1e",
            fontWeight: 700,
            fontSize: 14,
            cursor: generating || !topic.trim() ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {generating ? "Generating…" : "Generate with AI"}
        </button>

        {/* Draft preview + edit */}
        {hasDraft && (
          <div
            style={{
              marginTop: 20,
              background: "rgba(13,13,26,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Preview & Edit
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 5 }}>Title</label>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7,
                  padding: "8px 12px",
                  color: "#f1f5f9",
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 5 }}>Content</label>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7,
                  padding: "8px 12px",
                  color: "#cbd5e1",
                  fontSize: 14,
                  lineHeight: 1.6,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handlePublish}
                disabled={publishing || !draftTitle.trim() || !draftContent.trim()}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: publishing ? "rgba(52,211,153,0.2)" : "rgba(52,211,153,0.85)",
                  color: publishing ? "#1e5c46" : "#0f2b21",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: publishing ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                {publishing ? "Publishing…" : "Publish to Feed"}
              </button>
              <button
                onClick={() => { setDraftTitle(""); setDraftContent(""); }}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {publishedId && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: 13 }}>
            Post published to feed successfully.
          </div>
        )}
      </div>

      {/* ── Published Posts ─────────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 14, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Published Posts ({posts.length})
        </div>

        {loading && (
          <div style={{ color: "#475569", fontSize: 13, padding: "20px 0" }}>Loading…</div>
        )}

        {!loading && posts.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "#475569",
              fontSize: 14,
              border: "1px dashed rgba(255,255,255,0.07)",
              borderRadius: 10,
            }}
          >
            No posts published yet. Generate your first post above.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map((post) => (
            <PostRow key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PostRow({
  post,
  onDelete,
}: {
  post: AdminPost;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const timeAgo = (() => {
    const diff = Date.now() - new Date(post.created_at).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <div
      style={{
        background: "rgba(13,13,26,0.7)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      {/* Indicator */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#a78bfa",
          marginTop: 5,
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>
          {post.metadata?.title}
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 8 }}>
          {post.metadata?.content}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#475569" }}>{timeAgo}</span>
          {post.metadata?.topic && (
            <span
              style={{
                fontSize: 11,
                color: "#7c6dad",
                background: "rgba(167,139,250,0.1)",
                padding: "2px 8px",
                borderRadius: 20,
              }}
            >
              {post.metadata.topic}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <div>
        {confirming ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => onDelete(post.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.15)",
                color: "#f87171",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "transparent",
                color: "#64748b",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.05)",
              color: "#f87171",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
