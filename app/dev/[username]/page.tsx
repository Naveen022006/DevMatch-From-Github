import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { UserProfile, StoryCard } from "@/types";
import { ProfileActions } from "./ProfileActions";
import { SkillBadges } from "@/components/SkillBadges";
import { computeSkillBadges } from "@/lib/badges/compute";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const ogUrl = `/api/og?username=${encodeURIComponent(username)}`;
  const profileUrl = `/dev/${username}`;
  return {
    title: `${username} — DevMatch`,
    description: `View ${username}'s developer profile on DevMatch`,
    openGraph: {
      title: `${username} — DevMatch`,
      description: `View ${username}'s developer story card and profile on DevMatch`,
      url: profileUrl,
      siteName: "DevMatch",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${username}'s DevMatch card` }],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${username} — DevMatch`,
      description: `View ${username}'s developer story card and profile on DevMatch`,
      images: [ogUrl],
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;

  const service = createServiceClient();

  // Fetch profile by github_username
  const { data: profile } = await service
    .from("user_profiles")
    .select("*")
    .eq("github_username", username)
    .single();

  if (!profile) notFound();

  const typedProfile = profile as UserProfile;

  // Check if viewer is logged in
  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();

  // Check if viewer is a connected match
  let isMatch = false;
  if (viewer && viewer.id !== typedProfile.id) {
    const [uid1, uid2] = [viewer.id, typedProfile.id].sort();
    const { data: matchRow } = await service
      .from("matches")
      .select("id")
      .eq("user_id_1", uid1)
      .eq("user_id_2", uid2)
      .single();
    isMatch = !!matchRow;
  }
  const isSelf = viewer?.id === typedProfile.id;
  const canViewFull = typedProfile.is_public !== false || isMatch || isSelf;

  // Fetch story card if full view
  let storyCard: StoryCard | null = null;
  if (canViewFull) {
    const { data: sc } = await service
      .from("story_cards")
      .select("line1, line2, line3, line4, primary_color")
      .eq("user_id", typedProfile.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (sc) {
      storyCard = {
        line1: sc.line1,
        line2: sc.line2,
        line3: sc.line3,
        line4: sc.line4,
        primaryColor: sc.primary_color,
      };
    }
  }

  const identityColors: Record<string, string> = {
    builder: "#f59e0b", learner: "#34d399", maintainer: "#60a5fa", explorer: "#f472b6",
  };
  const primaryColor = storyCard?.primaryColor ?? identityColors[typedProfile.coding_identity] ?? "#a78bfa";
  const skillBadges = computeSkillBadges(typedProfile);

  // Private + not a match: show minimal card
  if (!canViewFull) {
    return (
      <div style={{ background: "#060610", minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "400px", textAlign: "center", padding: "40px 24px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={typedProfile.avatar_url} alt={username} style={{ width: "90px", height: "90px", borderRadius: "50%", border: "3px solid rgba(124,58,237,0.4)", marginBottom: "20px" }} />
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9", marginBottom: "6px" }}>
            {typedProfile.display_name ?? typedProfile.github_username}
          </div>
          <div style={{ fontSize: "14px", color: "#475569", fontFamily: "monospace", marginBottom: "24px" }}>@{username}</div>
          <div style={{ padding: "14px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", fontSize: "13px", color: "#64748b", marginBottom: "24px" }}>
            This profile is private. Connect with {typedProfile.display_name ?? username} to view their full profile.
          </div>
          {viewer ? (
            <ProfileActions targetUserId={typedProfile.id} targetUsername={username} viewerId={viewer.id} isMatch={isMatch} />
          ) : (
            <a href="/" style={{ display: "inline-block", padding: "12px 24px", borderRadius: "12px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontWeight: 700, fontSize: "14px", textDecoration: "none" }}>
              Join DevMatch →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#060610", minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" }}>
      {/* Background grid */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
      <div style={{ position: "fixed", top: "-200px", left: "30%", width: "700px", height: "700px", borderRadius: "50%", background: `radial-gradient(circle, ${primaryColor}12 0%, transparent 65%)`, pointerEvents: "none", zIndex: 0 }} className="hide-mobile" />

      <main className="profile-container" style={{ position: "relative", zIndex: 10 }}>

        {/* Back link */}
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#475569", textDecoration: "none", marginBottom: "28px" }}
          onMouseOver={undefined} onMouseOut={undefined}>
          ← DevMatch
        </a>

        {/* Hero card */}
        <div style={{ background: "rgba(13,13,26,0.95)", border: `1px solid ${primaryColor}33`, borderRadius: "22px", padding: "clamp(16px, 4vw, 28px)", marginBottom: "18px", boxShadow: `0 0 40px ${primaryColor}0d` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "18px", marginBottom: "20px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={typedProfile.avatar_url} alt={username} style={{ width: "72px", height: "72px", borderRadius: "16px", border: `2px solid ${primaryColor}55`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9", marginBottom: "4px" }}>
                {typedProfile.display_name ?? typedProfile.github_username}
              </div>
              <div style={{ fontSize: "13px", color: "#475569", fontFamily: "monospace", marginBottom: "8px" }}>@{username}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "11px", padding: "3px 11px", borderRadius: "20px", background: `${primaryColor}18`, border: `1px solid ${primaryColor}33`, color: primaryColor, fontWeight: 600, textTransform: "capitalize" }}>
                  {typedProfile.coding_identity}
                </span>
                <span style={{ fontSize: "11px", padding: "3px 11px", borderRadius: "20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", textTransform: "capitalize" }}>
                  {typedProfile.experience_level}
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {typedProfile.human_description && (
            <p style={{ margin: "0 0 18px", fontSize: "14px", color: "#94a3b8", lineHeight: 1.7, borderLeft: `2px solid ${primaryColor}55`, paddingLeft: "14px" }}>
              {typedProfile.human_description}
            </p>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
            {[
              { label: "Repos", val: typedProfile.total_repos },
              { label: "Stars", val: typedProfile.total_stars },
              { label: "Commits", val: typedProfile.total_commits_estimate },
            ].map(s => (
              <div key={s.label} style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>{s.val.toLocaleString()}</div>
                <div style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Languages */}
          {typedProfile.languages?.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Languages</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {typedProfile.languages.slice(0, 8).map(lang => (
                  <span key={lang} style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Passion areas */}
          {typedProfile.passion_areas?.length > 0 && (
            <div style={{ marginBottom: skillBadges.length > 0 ? "16px" : 0 }}>
              <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Passion Areas</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {typedProfile.passion_areas.map(area => (
                  <span key={area} style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "20px", background: `${primaryColor}12`, border: `1px solid ${primaryColor}25`, color: primaryColor }}>
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skill Badges */}
          {skillBadges.length > 0 && <SkillBadges badges={skillBadges} />}
        </div>

        {/* Story Card */}
        {storyCard && (
          <div style={{ background: `linear-gradient(135deg, ${storyCard.primaryColor}18, ${storyCard.primaryColor}08)`, border: `1px solid ${storyCard.primaryColor}33`, borderRadius: "22px", padding: "28px 28px 32px", marginBottom: "18px" }}>
            <div style={{ fontSize: "11px", color: storyCard.primaryColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "18px", opacity: 0.8 }}>
              ✦ Developer Story Card
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { num: "I", text: storyCard.line1, large: true },
                { num: "II", text: storyCard.line2, large: false },
                { num: "III", text: storyCard.line3, large: false },
                { num: "IV", text: storyCard.line4, large: false, italic: true },
              ].map(line => (
                <div key={line.num} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "9px", color: `${storyCard!.primaryColor}55`, fontWeight: 700, letterSpacing: "0.12em", paddingTop: line.large ? "6px" : "2px", minWidth: "20px", flexShrink: 0 }}>
                    {line.num}
                  </span>
                  <p style={{ margin: 0, fontSize: line.large ? "20px" : "14px", fontWeight: line.large ? 800 : 500, color: line.large ? "#f1f5f9" : "#94a3b8", lineHeight: line.large ? 1.25 : 1.6, fontStyle: line.italic ? "italic" : "normal", letterSpacing: line.large ? "-0.02em" : "normal" }}>
                    {line.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {viewer && !isSelf ? (
            <ProfileActions targetUserId={typedProfile.id} targetUsername={username} viewerId={viewer.id} isMatch={isMatch} />
          ) : !viewer ? (
            <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "13px 28px", borderRadius: "14px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontWeight: 700, fontSize: "15px", textDecoration: "none", boxShadow: "0 0 24px rgba(124,58,237,0.3)" }}>
              Join DevMatch →
            </a>
          ) : null}
          <a href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "13px 22px", borderRadius: "14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", fontWeight: 600, fontSize: "14px", textDecoration: "none" }}>
            GitHub Profile ↗
          </a>
        </div>

      </main>
    </div>
  );
}
