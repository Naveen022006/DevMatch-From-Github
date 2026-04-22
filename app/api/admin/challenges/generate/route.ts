import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { nimChat } from "@/lib/nvidia/client";
import type { ChallengeDifficulty } from "@/types/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { topic, difficulty = "medium" } = (await request.json()) as {
    topic?: string;
    difficulty?: ChallengeDifficulty;
  };

  const systemPrompt = `You are a coding challenge designer for a developer social platform called DevMatch.
Generate practical, solvable coding challenges that developers can answer in 1-3 paragraphs.
Challenges should test real skills: algorithms, system design, debugging, architecture, or coding concepts.
Keep descriptions clear and concise — 3-5 sentences.
Return ONLY valid JSON, no extra text.`;

  const userMessage = `Generate a ${difficulty} coding challenge${topic ? ` about "${topic}"` : ""}.
Return JSON: { "title": string, "description": string }
The description should clearly state what the developer must do or explain.`;

  let raw: string;
  try {
    raw = await nimChat(systemPrompt, userMessage, 512);
  } catch (e) {
    return NextResponse.json(
      { error: `AI generation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  let parsed: { title: string; description: string };
  try {
    parsed = JSON.parse(raw);
    if (!parsed.title || !parsed.description) throw new Error("Missing fields");
  } catch {
    // Try to extract JSON from the raw response
    const match = raw.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "AI returned invalid JSON. Try again." }, { status: 500 });
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "Could not parse AI response." }, { status: 500 });
    }
  }

  return NextResponse.json({
    title: parsed.title,
    description: parsed.description,
    difficulty,
  });
}
