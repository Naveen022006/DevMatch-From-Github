"use client";

import { useState, useRef, useEffect } from "react";
import type { UserProfile } from "@/types";

const NOTIFICATION_TYPES = [
  { key: "connection_request", label: "Connection Requests", desc: "When someone sends you a connection request" },
  { key: "connection_accepted", label: "Connection Accepted", desc: "When someone accepts your request" },
  { key: "message", label: "New Messages", desc: "When you receive a new message" },
  { key: "achievement", label: "Achievements", desc: "When you unlock an achievement" },
  { key: "challenge_result", label: "Challenge Results", desc: "When your challenge submission is evaluated" },
] as const;

interface Props {
  profile: UserProfile;
  avatarUrl: string;
  githubUsername: string;
}

export default function SettingsClient({ profile, avatarUrl, githubUsername }: Props) {
  // ── Profile section ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.human_description ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ── Personal Info section ─────────────────────────────────────────────────────
  const [age, setAge] = useState(profile.age != null ? String(profile.age) : "");
  const [place, setPlace] = useState(profile.place ?? "");
  const [role, setRole] = useState(profile.role ?? "");
  const [gender, setGender] = useState(profile.gender ?? "");
  const [contactEmail, setContactEmail] = useState(profile.contact_email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // ── Privacy section ───────────────────────────────────────────────────────────
  const [isPublic, setIsPublic] = useState(profile.is_public !== false);
  const [hideFromFeed, setHideFromFeed] = useState(profile.hide_from_feed === true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  // ── Notifications section ─────────────────────────────────────────────────────
  const defaultPrefs = NOTIFICATION_TYPES.reduce<Record<string, boolean>>((acc, t) => {
    acc[t.key] = profile.notification_preferences?.[t.key] !== false; // default on
    return acc;
  }, {});
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(defaultPrefs);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  // ── Account section ───────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const saveProfile = async () => {    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Save failed");
    }
    setProfileSaving(false);
  };

  const savePersonalInfo = async () => {
    setPersonalSaving(true);
    setPersonalError(null);
    setPersonalSaved(false);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: age.trim() ? Number(age) : null,
          place: place.trim() || null,
          role: role.trim() || null,
          gender: gender || null,
          contact_email: contactEmail.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPersonalSaved(true);
      setTimeout(() => setPersonalSaved(false), 3000);
    } catch (e) {
      setPersonalError(e instanceof Error ? e.message : "Save failed");
    }
    setPersonalSaving(false);
  };

  const savePrivacy = async () => {
    setPrivacySaving(true);
    setPrivacyError(null);
    setPrivacySaved(false);
    try {
      const res = await fetch("/api/settings/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic, hideFromFeed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 3000);
    } catch (e) {
      setPrivacyError(e instanceof Error ? e.message : "Save failed");
    }
    setPrivacySaving(false);
  };

  const saveNotifications = async () => {
    setNotifSaving(true);
    setNotifError(null);
    setNotifSaved(false);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: notifPrefs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 3000);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Save failed");
    }
    setNotifSaving(false);
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== githubUsername) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/settings/account", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = "/";
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Deletion failed");
      setDeleting(false);
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: "rgba(13,13,26,0.95)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "18px",
    padding: "26px 28px",
    marginBottom: "20px",
  };

  const label: React.CSSProperties = {
    fontSize: "12px", fontWeight: 600, color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: "0.08em",
    display: "block", marginBottom: "7px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)", color: "#e2e8f0",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "16px", fontWeight: 700, color: "#f1f5f9", marginBottom: "4px",
  };

  const sectionDesc: React.CSSProperties = {
    fontSize: "12px", color: "#475569", marginBottom: "20px",
  };

  return (
    <div style={{
      background: "#060610", minHeight: "100vh", color: "#e2e8f0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Background grid */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

      {/* Nav */}
      <nav className="nav-bar" style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(6,6,16,0.88)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a href="/dashboard" style={{
            fontSize: "13px", color: "#64748b", textDecoration: "none",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            ← Dashboard
          </a>
          <span style={{ color: "#334155" }}>·</span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>Settings</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt={githubUsername} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "2px solid rgba(124,58,237,0.4)" }} />
          <span style={{ fontSize: "13px", color: "#64748b", fontFamily: "monospace" }}>@{githubUsername}</span>
        </div>
      </nav>

      <main style={{ position: "relative", zIndex: 10, width: "min(640px, 100% - 24px)", margin: "0 auto", padding: "28px 0 64px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9", marginBottom: "28px" }}>
          Account Settings
        </h1>

        {/* ── Profile Section ── */}
        <div style={card}>
          <div style={sectionTitle}>Profile</div>
          <div style={sectionDesc}>Edit how others see your name and bio</div>

          <div style={{ marginBottom: "16px" }}>
            <label style={label}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={githubUsername}
              maxLength={80}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={label}>Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="A short description about yourself..."
              maxLength={500}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
            <div style={{ fontSize: "11px", color: "#334155", marginTop: "4px", textAlign: "right" }}>
              {bio.length}/500
            </div>
          </div>

          {profileError && <ErrorMsg msg={profileError} onDismiss={() => setProfileError(null)} />}
          <SaveBtn onClick={saveProfile} saving={profileSaving} saved={profileSaved} />
        </div>

        {/* ── Personal Info Section ── */}
        <div style={card}>
          <div style={sectionTitle}>Personal Info</div>
          <div style={sectionDesc}>Basic details about you — all fields are optional</div>

          <div className="grid-2col" style={{ marginBottom: "14px" }}>
            {/* Age */}
            <div>
              <label style={label}>Age</label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 24"
                min={13}
                max={120}
                style={inputStyle}
              />
            </div>

            {/* Gender */}
            <div>
              <label style={label}>Gender</label>
              <SelectField
                value={gender}
                onChange={setGender}
                placeholder="Select…"
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "non-binary", label: "Non-binary" },
                  { value: "prefer-not-to-say", label: "Prefer not to say" },
                ]}
                inputStyle={inputStyle}
              />
            </div>
          </div>

          {/* Place */}
          <div style={{ marginBottom: "14px" }}>
            <label style={label}>Location</label>
            <input
              type="text"
              value={place}
              onChange={e => setPlace(e.target.value)}
              placeholder="e.g. Chennai, India"
              maxLength={100}
              style={inputStyle}
            />
          </div>

          {/* Role */}
          <div style={{ marginBottom: "14px" }}>
            <label style={label}>Role / Title</label>
            <SelectField
              value={role}
              onChange={setRole}
              placeholder="Select your role…"
              options={[
                { value: "Frontend Developer", label: "Frontend Developer" },
                { value: "Backend Developer", label: "Backend Developer" },
                { value: "Full-Stack Developer", label: "Full-Stack Developer" },
                { value: "Mobile Developer", label: "Mobile Developer" },
                { value: "Data Scientist", label: "Data Scientist" },
                { value: "ML / AI Engineer", label: "ML / AI Engineer" },
                { value: "DevOps Engineer", label: "DevOps Engineer" },
                { value: "Security Engineer", label: "Security Engineer" },
                { value: "Student", label: "Student" },
                { value: "Other", label: "Other" },
              ]}
              inputStyle={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
            {/* Email */}
            <div>
              <label style={label}>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={200}
                style={inputStyle}
              />
            </div>

            {/* Phone */}
            <div>
              <label style={label}>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                maxLength={30}
                style={inputStyle}
              />
            </div>
          </div>

          {personalError && <ErrorMsg msg={personalError} onDismiss={() => setPersonalError(null)} />}
          <SaveBtn onClick={savePersonalInfo} saving={personalSaving} saved={personalSaved} />
        </div>

        {/* ── Privacy Section ── */}
        <div style={card}>
          <div style={sectionTitle}>Privacy</div>
          <div style={sectionDesc}>Control your visibility on DevMatch</div>

          <ToggleRow
            label="Public Profile"
            desc="Anyone can view your full profile page at /dev/username"
            enabled={isPublic}
            onChange={setIsPublic}
          />
          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "14px 0" }} />
          <ToggleRow
            label="Hide from Activity Feed"
            desc="Your joins, connections, and achievements won't appear in others' feeds"
            enabled={hideFromFeed}
            onChange={setHideFromFeed}
          />

          <div style={{ marginTop: "20px" }}>
            {privacyError && <ErrorMsg msg={privacyError} onDismiss={() => setPrivacyError(null)} />}
            <SaveBtn onClick={savePrivacy} saving={privacySaving} saved={privacySaved} />
          </div>
        </div>

        {/* ── Notifications Section ── */}
        <div style={card}>
          <div style={sectionTitle}>Notifications</div>
          <div style={sectionDesc}>Choose which notifications you receive</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {NOTIFICATION_TYPES.map((t, i) => (
              <div key={t.key}>
                {i > 0 && <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />}
                <ToggleRow
                  label={t.label}
                  desc={t.desc}
                  enabled={notifPrefs[t.key] !== false}
                  onChange={v => setNotifPrefs(prev => ({ ...prev, [t.key]: v }))}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: "20px" }}>
            {notifError && <ErrorMsg msg={notifError} onDismiss={() => setNotifError(null)} />}
            <SaveBtn onClick={saveNotifications} saving={notifSaving} saved={notifSaved} />
          </div>
        </div>

        {/* ── Account Section ── */}
        <div style={{ ...card, border: "1px solid rgba(239,68,68,0.18)" }}>
          <div style={sectionTitle}>Account</div>
          <div style={sectionDesc}>Manage your account and data</div>

          {/* Sign out */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", borderRadius: "12px",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            marginBottom: "12px",
          }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>Sign Out</div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>Sign out of DevMatch on this device</div>
            </div>
            <a
              href="/api/auth/signout"
              onClick={async (e) => {
                e.preventDefault();
                const { createClient } = await import("@/lib/supabase/client");
                const sb = createClient();
                await sb.auth.signOut();
                window.location.href = "/";
              }}
              style={{
                padding: "9px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8", textDecoration: "none", cursor: "pointer", flexShrink: 0,
              }}
            >
              Sign Out
            </a>
          </div>

          {/* Delete account */}
          <div style={{
            padding: "14px 16px", borderRadius: "12px",
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#f87171" }}>Delete Account</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  Permanently delete your account and all data. This cannot be undone.
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                style={{
                  padding: "9px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                  border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.1)",
                  color: "#f87171", cursor: "pointer", flexShrink: 0,
                }}
                onMouseOver={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                onMouseOut={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div style={{
            background: "#0d0d1a", border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: "20px", padding: "32px", maxWidth: "440px", width: "100%",
            boxShadow: "0 0 60px rgba(239,68,68,0.12)",
          }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#f87171", marginBottom: "8px" }}>
              ⚠ Delete Account
            </div>
            <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.65, marginBottom: "20px" }}>
              This will permanently delete your profile, matches, messages, achievements, and all other data. <strong style={{ color: "#f1f5f9" }}>This cannot be undone.</strong>
            </p>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "8px" }}>
                Type your GitHub username <strong style={{ color: "#94a3b8" }}>@{githubUsername}</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={githubUsername}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: "10px",
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.06)", color: "#f87171",
                  fontSize: "14px", outline: "none", boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
                onKeyDown={e => { if (e.key === "Enter" && deleteConfirm === githubUsername) deleteAccount(); }}
              />
            </div>
            {deleteError && <ErrorMsg msg={deleteError} onDismiss={() => setDeleteError(null)} />}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); setDeleteError(null); }}
                style={{
                  flex: 1, padding: "11px", borderRadius: "12px", fontWeight: 600, fontSize: "14px",
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                  color: "#94a3b8", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting || deleteConfirm !== githubUsername}
                style={{
                  flex: 1, padding: "11px", borderRadius: "12px", fontWeight: 700, fontSize: "14px",
                  border: "none", cursor: deleting || deleteConfirm !== githubUsername ? "not-allowed" : "pointer",
                  background: deleteConfirm === githubUsername
                    ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                    : "rgba(239,68,68,0.12)",
                  color: deleteConfirm === githubUsername ? "#fff" : "#475569",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                {deleting ? (
                  <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Deleting…</>
                ) : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function ToggleRow({ label, desc, enabled, onChange }: {
  label: string; desc: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>{label}</div>
        <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        style={{
          width: "44px", height: "24px", borderRadius: "12px", border: "none",
          cursor: "pointer", flexShrink: 0, position: "relative",
          background: enabled ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)",
          transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: "3px", width: "18px", height: "18px", borderRadius: "50%",
          background: enabled ? "#34d399" : "#475569",
          left: enabled ? "23px" : "3px",
          transition: "left 0.2s, background 0.2s",
        }} />
      </button>
    </div>
  );
}

function SaveBtn({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        padding: "10px 24px", borderRadius: "12px", fontWeight: 700, fontSize: "14px",
        border: "none", cursor: saving ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        ...(saved
          ? { background: "rgba(52,211,153,0.15)", color: "#34d399" }
          : saving
          ? { background: "rgba(124,58,237,0.15)", color: "#a78bfa" }
          : { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", boxShadow: "0 0 20px rgba(124,58,237,0.3)" }),
        display: "flex", alignItems: "center", gap: "8px",
      }}
    >
      {saving ? (
        <><span style={{ width: 13, height: 13, border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Saving…</>
      ) : saved ? "✓ Saved" : "Save Changes"}
    </button>
  );
}

function ErrorMsg({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
      fontSize: "13px", color: "#f87171",
    }}>
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder, inputStyle }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  inputStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: selected ? "#e2e8f0" : "#475569",
        }}
      >
        <span>{selected ? selected.label : (placeholder ?? "Select…")}</span>
        <span style={{
          fontSize: "10px", color: "#475569",
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.2s", flexShrink: 0,
        }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "10px", zIndex: 50, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={() => { onChange(opt.value); setOpen(false); }}
              style={{
                width: "100%", padding: "10px 14px",
                background: opt.value === value ? "rgba(124,58,237,0.15)" : "transparent",
                border: "none",
                color: opt.value === value ? "#c4b5fd" : "#94a3b8",
                fontSize: "14px", textAlign: "left", cursor: "pointer",
                display: "block", fontFamily: "inherit",
              }}
              onMouseOver={e => { if (opt.value !== value) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseOut={e => { e.currentTarget.style.background = opt.value === value ? "rgba(124,58,237,0.15)" : "transparent"; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
