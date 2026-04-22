import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateStoryCard } from "@/lib/story/generator";
import type { UserProfile } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const { data: profile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found. Please analyze your GitHub first." },
        { status: 404 }
      );
    }

    const card = await generateStoryCard(profile as UserProfile);

    return NextResponse.json({ card });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Story card generation failed";
    console.error("[story-card]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Force regeneration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Delete cached card to force regeneration
    await serviceClient
      .from("story_cards")
      .delete()
      .eq("user_id", user.id);

    const { data: profile } = await serviceClient
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const card = await generateStoryCard(profile as UserProfile);

    return NextResponse.json({ card });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regeneration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
