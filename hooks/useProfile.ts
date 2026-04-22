"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(data as UserProfile | null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProfile(json.profile as UserProfile);
      return json.profile as UserProfile;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, error, analyze, setProfile };
}
