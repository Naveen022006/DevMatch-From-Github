import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DeveloperMatch, UserProfile, CompatibilityScore } from "@/types";

/**
 * GET /api/match/cached
 * Returns previously computed matches from the DB — no AI, instant.
 * Used to auto-populate the Matches tab on load.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceClient();

    // Fetch all match rows where this user is either side
    const { data: rows, error } = await service
      .from("matches")
      .select("*")
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .order("compatibility_total", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows?.length) return NextResponse.json({ matches: [] });

    // Collect the partner IDs
    const partnerIds = rows.map((r) =>
      r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1
    );

    const { data: profiles } = await service
      .from("user_profiles")
      .select("*")
      .in("id", partnerIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p as UserProfile])
    );

    const matches: DeveloperMatch[] = rows
      .map((r) => {
        const partnerId = r.user_id_1 === user.id ? r.user_id_2 : r.user_id_1;
        const profile = profileMap[partnerId];
        if (!profile) return null;

        const compatibility: CompatibilityScore = {
          technical_synergy: r.technical_synergy ?? 0,
          learning_potential: r.learning_potential ?? 0,
          collaboration_style: r.collaboration_score ?? 0,
          personality_fit: r.personality_fit ?? 0,
          total: r.compatibility_total ?? 0,
          reason: r.match_reason ?? "",
        };

        return { profile, compatibility } satisfies DeveloperMatch;
      })
      .filter((m): m is DeveloperMatch => m !== null);

    // Deduplicate by partner ID — keep the row with the highest total score
    const seen = new Map<string, DeveloperMatch>();
    for (const m of matches) {
      const existing = seen.get(m.profile.id);
      if (!existing || m.compatibility.total > existing.compatibility.total) {
        seen.set(m.profile.id, m);
      }
    }
    const deduplicated = Array.from(seen.values()).sort(
      (a, b) => b.compatibility.total - a.compatibility.total
    );

    return NextResponse.json({ matches: deduplicated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load cached matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
