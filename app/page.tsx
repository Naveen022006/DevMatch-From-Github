import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginButton from "@/components/LoginButton";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div style={{ background: "#060610", minHeight: "100vh", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif", overflowX: "hidden" }}>

      {/* ── Background grid ── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />

      {/* ── Glow orb top ── */}
      <div className="hide-mobile" style={{
        position: "fixed", top: "-200px", left: "50%", transform: "translateX(-30%)",
        width: "800px", height: "800px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 65%)",
        pointerEvents: "none", zIndex: 0,
        animation: "float1 12s ease-in-out infinite",
      }} />

      {/* ── Glow orb bottom ── */}
      <div className="hide-mobile" style={{
        position: "fixed", bottom: "-200px", right: "-100px",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(79,70,229,0.14) 0%, transparent 65%)",
        pointerEvents: "none", zIndex: 0,
        animation: "float2 16s ease-in-out infinite",
      }} />

      {/* ── Nav ── */}
      <nav className="landing-nav" style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        maxWidth: "1100px", margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DevMatch" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover" }} />
          <span style={{ fontWeight: 700, fontSize: "17px", color: "#fff", letterSpacing: "-0.3px" }}>DevMatch</span>
        </div>
        <div style={{
          fontSize: "12px", padding: "6px 14px", borderRadius: "20px",
          background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
          color: "#c4b5fd",
        }}>⚡ Powered by NVIDIA NIM</div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero-pad" style={{
        position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center",
      }}>
        {/* Badge */}
        <div className="animate-fade-in" style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "7px 16px", borderRadius: "24px",
          background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.35)",
          color: "#c4b5fd", fontSize: "13px", fontWeight: 500, marginBottom: "32px",
        }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#a78bfa", animation: "pulse-glow 2s infinite" }} />
          AI-powered developer friendship platform
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up" style={{
          fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 800,
          lineHeight: 1.08, letterSpacing: "-2px",
          color: "#fff", marginBottom: "24px", maxWidth: "750px",
        }}>
          Find your<br />
          <span style={{
            background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 45%, #60a5fa 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>developer tribe</span>
        </h1>

        {/* Subheading */}
        <p className="animate-fade-up delay-100" style={{
          fontSize: "18px", color: "#94a3b8", lineHeight: 1.7,
          maxWidth: "500px", marginBottom: "40px",
        }}>
          DevMatch analyzes your GitHub with AI to match you with developers who complement your skills, share your passions, and vibe with your coding soul.
        </p>

        {/* CTA */}
        <div className="animate-fade-up delay-200">
          <LoginButton />
        </div>

        {/* Feature pills */}
        <div className="animate-fade-up delay-300" style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: "10px", marginTop: "36px",
        }}>
          {["🔍 GitHub Analysis", "🤝 AI Matchmaking", "🃏 Story Cards", "🏆 Achievements"].map(f => (
            <span key={f} style={{
              fontSize: "13px", padding: "6px 14px", borderRadius: "20px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#64748b",
            }}>{f}</span>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{
        position: "relative", zIndex: 10,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "40px 24px",
      }}>
        <div className="grid-stats" style={{
          maxWidth: "700px", margin: "0 auto",
        }}>
          {[
            { value: "4", label: "Compatibility Dimensions" },
            { value: "70B", label: "AI Parameters" },
            { value: "5", label: "Achievement Types" },
            { value: "∞", label: "Connections" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0 16px" }}>
              <div style={{
                fontSize: "36px", fontWeight: 800, letterSpacing: "-1px",
                background: "linear-gradient(135deg, #a78bfa, #60a5fa)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "60px 20px", maxWidth: "960px", margin: "0 auto" }}>
        <p style={{
          textAlign: "center", fontSize: "11px", letterSpacing: "3px",
          textTransform: "uppercase", color: "#475569", marginBottom: "48px", fontWeight: 600,
        }}>Everything you need to connect</p>

        <div className="feature-grid">
          {[
            {
              icon: "⬡", iconColor: "#a78bfa", borderColor: "rgba(167,139,250,0.2)",
              title: "GitHub Analysis",
              desc: "Deep-dive analysis of your repos, commit patterns, peak hours, and coding identity using NVIDIA NIM AI.",
            },
            {
              icon: "◈", iconColor: "#60a5fa", borderColor: "rgba(96,165,250,0.2)",
              title: "AI Matchmaking",
              desc: "Scored across 4 dimensions — technical synergy, learning potential, collaboration style, and personality vibe.",
            },
            {
              icon: "⟡", iconColor: "#f472b6", borderColor: "rgba(244,114,182,0.2)",
              title: "Story Cards",
              desc: "AI-generated poetic developer tarot cards capturing your coding soul. Download as PNG and share anywhere.",
            },
            {
              icon: "✦", iconColor: "#34d399", borderColor: "rgba(52,211,153,0.2)",
              title: "Achievements",
              desc: "Earn personalized milestone badges as you connect with developers. Each unlock message is written just for you.",
            },
          ].map((f) => (
            <div key={f.title} style={{
              background: "rgba(13,13,26,0.9)", borderRadius: "16px",
              border: `1px solid ${f.borderColor}`,
              padding: "28px", display: "flex", gap: "18px", alignItems: "flex-start",
              backdropFilter: "blur(12px)",
              boxShadow: `0 0 0 1px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
              transition: "transform 0.2s",
            }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px", color: f.iconColor,
                background: `${f.borderColor}`,
                border: `1px solid ${f.iconColor}44`,
              }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: "#f1f5f9", marginBottom: "8px" }}>{f.title}</div>
                <div style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "0 16px 60px", maxWidth: "760px", margin: "0 auto" }}>
        <div style={{
          background: "rgba(124,58,237,0.08)", borderRadius: "20px",
          border: "1px solid rgba(124,58,237,0.25)", padding: "clamp(24px, 5vw, 48px) clamp(16px, 5vw, 40px)", textAlign: "center",
        }}>
          <p style={{ fontSize: "13px", color: "#7c3aed", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>How it works</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
            {[
              { step: "01", label: "Connect GitHub" },
              { step: "02", label: "AI Analyzes You" },
              { step: "03", label: "Meet Your Matches" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: "10px", padding: "12px 20px",
                }}>
                  <span style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 700, fontFamily: "monospace" }}>{s.step}</span>
                  <span style={{ fontSize: "14px", color: "#c4b5fd", fontWeight: 600 }}>{s.label}</span>
                </div>
                {i < 2 && <span style={{ color: "#374151", fontSize: "18px" }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{
        position: "relative", zIndex: 10, textAlign: "center",
        padding: "0 24px 80px",
      }}>
        <p style={{ color: "#475569", fontSize: "14px", marginBottom: "20px" }}>Ready to find your people?</p>
        <LoginButton />
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative", zIndex: 10, textAlign: "center", padding: "24px",
        borderTop: "1px solid rgba(255,255,255,0.05)", color: "#334155", fontSize: "12px",
      }}>
        Built with Next.js · Supabase · NVIDIA NIM &nbsp;·&nbsp; DevMatch 2024
      </footer>

    </div>
  );
}
