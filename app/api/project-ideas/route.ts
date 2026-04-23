import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { nimChat } from "@/lib/nvidia/client";
import type { UserProfile, ProjectIdea } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getMatchId(
  service: ReturnType<typeof createServiceClient>,
  uid1: string,
  uid2: string
): Promise<string | null> {
  const [a, b] = [uid1, uid2].sort();
  const { data } = await service
    .from("matches")
    .select("id")
    .eq("user_id_1", a)
    .eq("user_id_2", b)
    .single();
  return data?.id ?? null;
}

// ── GET — fetch existing ideas for a match ────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const otherUserId = request.nextUrl.searchParams.get("otherUserId");
  if (!otherUserId) return NextResponse.json({ error: "otherUserId required" }, { status: 400 });

  const service = createServiceClient();
  const matchId = await getMatchId(service, user.id, otherUserId);
  if (!matchId) return NextResponse.json({ ideas: [], savedIdeaIndex: null });

  const { data } = await service
    .from("project_ideas")
    .select("ideas_json, saved_idea_index")
    .eq("match_id", matchId)
    .single();

  if (!data) return NextResponse.json({ ideas: [], savedIdeaIndex: null });

  return NextResponse.json({
    ideas: data.ideas_json as ProjectIdea[],
    savedIdeaIndex: data.saved_idea_index as number | null,
  });
}

// ── POST — generate (or regenerate) project ideas ────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { otherUserId } = await request.json() as { otherUserId: string };
  if (!otherUserId) return NextResponse.json({ error: "otherUserId required" }, { status: 400 });

  const service = createServiceClient();

  // Look up the match
  const matchId = await getMatchId(service, user.id, otherUserId);
  if (!matchId)
    return NextResponse.json({ error: "No match found between these users" }, { status: 404 });

  // Fetch both profiles
  const [p1Res, p2Res] = await Promise.all([
    service.from("user_profiles").select("*").eq("id", user.id).single(),
    service.from("user_profiles").select("*").eq("id", otherUserId).single(),
  ]);

  if (!p1Res.data || !p2Res.data)
    return NextResponse.json({ error: "Could not load profiles" }, { status: 400 });

  const p1 = p1Res.data as UserProfile;
  const p2 = p2Res.data as UserProfile;

  // Build AI prompt
  const combinedLangs = [...new Set([...p1.languages.slice(0, 5), ...p2.languages.slice(0, 5)])];
  const combinedPassions = [...new Set([...p1.passion_areas, ...p2.passion_areas])];

  const system = `You are a creative technical project ideation assistant.
Generate 3 collaborative project ideas for two developers based on their combined skills.
Each idea must be practical, achievable, and genuinely interesting.
Return ONLY valid JSON — an array of exactly 3 objects. No extra text.`;

  const userMsg = `Developer 1: @${p1.github_username}
Identity: ${p1.coding_identity} | Level: ${p1.experience_level}
Languages: ${p1.languages.slice(0, 5).join(", ")}
Passions: ${p1.passion_areas.join(", ")}

Developer 2: @${p2.github_username}
Identity: ${p2.coding_identity} | Level: ${p2.experience_level}
Languages: ${p2.languages.slice(0, 5).join(", ")}
Passions: ${p2.passion_areas.join(", ")}

Combined tech: ${combinedLangs.join(", ")}
Combined interests: ${combinedPassions.join(", ")}

Generate 3 project ideas. Each must have:
- title: short catchy project name
- description: 2-3 sentences explaining what it does and why it's interesting
- techStack: array of 3-5 technologies (pick from their combined languages + sensible additions)
- difficulty: one of "beginner", "intermediate", "advanced"

Return JSON array: [{"title":"...","description":"...","techStack":[...],"difficulty":"..."}]`;

  let ideas: ProjectIdea[];
  try {
    const raw = await nimChat(system, userMsg, 1000);
    let parsed: ProjectIdea[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      parsed = match ? JSON.parse(match[0]) : [];
    }
    if (!Array.isArray(parsed) || parsed.length === 0)
      throw new Error("AI returned no ideas");
    // Ensure exactly 3, sanitize
    ideas = parsed.slice(0, 3).map((idea) => ({
      title: String(idea.title ?? "Untitled Project"),
      description: String(idea.description ?? ""),
      techStack: Array.isArray(idea.techStack) ? idea.techStack.map(String) : [],
      difficulty: (["beginner", "intermediate", "advanced"].includes(idea.difficulty)
        ? idea.difficulty
        : "intermediate") as ProjectIdea["difficulty"],
    }));
  } catch (e) {
    return NextResponse.json(
      { error: `AI generation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  // Upsert to DB
  const { error: upsertErr } = await service
    .from("project_ideas")
    .upsert(
      { match_id: matchId, ideas_json: ideas, saved_idea_index: null },
      { onConflict: "match_id" }
    );

  if (upsertErr)
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ ideas, savedIdeaIndex: null });
}

// ── PATCH — save a specific idea ──────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { otherUserId, savedIdeaIndex } = await request.json() as {
    otherUserId: string;
    savedIdeaIndex: number | null;
  };

  if (!otherUserId) return NextResponse.json({ error: "otherUserId required" }, { status: 400 });

  const service = createServiceClient();
  const matchId = await getMatchId(service, user.id, otherUserId);
  if (!matchId) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { error } = await service
    .from("project_ideas")
    .update({ saved_idea_index: savedIdeaIndex })
    .eq("match_id", matchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
