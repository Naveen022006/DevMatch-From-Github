import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username") ?? "developer";

  const service = createServiceClient();

  // Fetch profile
  const { data: profile } = await service
    .from("user_profiles")
    .select("id, display_name, github_username, avatar_url, coding_identity, experience_level, languages")
    .eq("github_username", username)
    .single();

  // Fetch story card
  let storyLine1 = "";
  let storyLine2 = "";
  let cardColor = "#a78bfa";

  if (profile?.id) {
    const { data: sc } = await service
      .from("story_cards")
      .select("line1, line2, primary_color")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sc) {
      storyLine1 = sc.line1 ?? "";
      storyLine2 = sc.line2 ?? "";
      cardColor = sc.primary_color ?? "#a78bfa";
    }
  }

  const identityColors: Record<string, string> = {
    builder: "#f59e0b",
    learner: "#34d399",
    maintainer: "#60a5fa",
    explorer: "#f472b6",
  };

  const displayName = profile?.display_name ?? profile?.github_username ?? username;
  const identity = (profile?.coding_identity as string) ?? "developer";
  const level = (profile?.experience_level as string) ?? "";
  const langs: string[] = ((profile?.languages as string[] | null) ?? []).slice(0, 4);
  const color = cardColor ?? identityColors[identity] ?? "#a78bfa";
  const avatarUrl = (profile?.avatar_url as string | null) ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(145deg, #060610 0%, #0d0d1a 55%, #0d0d1a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow top-right */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: color,
            opacity: 0.12,
            filter: "blur(100px)",
          }}
        />
        {/* Glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: color,
            opacity: 0.07,
            filter: "blur(80px)",
          }}
        />

        {/* Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "900px",
            background: "rgba(13,13,26,0.9)",
            border: `2px solid ${color}44`,
            borderRadius: "32px",
            padding: "56px 64px",
            boxShadow: `0 0 80px ${color}25`,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "40px" }}>
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                width={80}
                height={80}
                style={{ borderRadius: "50%", border: `3px solid ${color}66` }}
                alt={username}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "32px", fontWeight: 800, color: "#f1f5f9" }}>
                {displayName}
              </span>
              <span style={{ fontSize: "16px", color: `${color}bb`, fontFamily: "monospace" }}>
                @{username}
              </span>
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontSize: "13px",
                padding: "6px 18px",
                borderRadius: "20px",
                background: `${color}18`,
                border: `1px solid ${color}44`,
                color,
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              DEVMATCH
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              background: `linear-gradient(90deg, ${color}88, ${color}22, transparent)`,
              marginBottom: "36px",
            }}
          />

          {/* Story lines */}
          {storyLine1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "36px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.3,
                  letterSpacing: "-0.02em",
                }}
              >
                {storyLine1}
              </p>
              {storyLine2 && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "17px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.7)",
                    lineHeight: 1.5,
                  }}
                >
                  {storyLine2}
                </p>
              )}
            </div>
          ) : (
            <p
              style={{
                margin: "0 0 36px",
                fontSize: "20px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.45)",
                fontStyle: "italic",
              }}
            >
              Developer on DevMatch
            </p>
          )}

          {/* Badges */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "14px",
                padding: "6px 16px",
                borderRadius: "20px",
                background: `${color}18`,
                border: `1px solid ${color}33`,
                color,
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {identity}
            </span>
            {level && (
              <span
                style={{
                  fontSize: "14px",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#94a3b8",
                  textTransform: "capitalize",
                }}
              >
                {level}
              </span>
            )}
            {langs.map((lang) => (
              <span
                key={lang}
                style={{
                  fontSize: "14px",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#64748b",
                }}
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
