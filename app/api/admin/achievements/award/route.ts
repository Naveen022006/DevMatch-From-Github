import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { nimChat } from "@/lib/nvidia/client";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import type { AchievementSlug, UserProfile } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, achievementSlug, customMessage } = await request.json() as {
    userId: string;
    achievementSlug: AchievementSlug;
    customMessage?: string;
  };

  if (!userId || !achievementSlug)
    return NextResponse.json({ error: "userId and achievementSlug required" }, { status: 400 });

  if (!ACHIEVEMENTS[achievementSlug])
    return NextResponse.json({ error: "Invalid achievement slug" }, { status: 400 });

  const service = createServiceClient();

  // Fetch target user's profile for personalised AI message
  const { data: profile } = await service
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile)
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  // Generate unlock message (custom or AI)
  let unlockMessage = customMessage?.trim() || "";
  if (!unlockMessage) {
    const achievement = ACHIEVEMENTS[achievementSlug];
    const ctx = {
      username: profile.github_username,
      codingIdentity: profile.coding_identity,
      topLanguages: (profile.languages ?? []).slice(0, 3),
      experienceLevel: profile.experience_level,
    };
    try {
      unlockMessage = await nimChat(
        "Write a 2-sentence personalized achievement unlock message for a developer. " +
        "Make it warm and specific to their identity. Plain text only, no JSON.",
        `Achievement: "${achievement.name}" — ${achievement.description}\nDeveloper: ${JSON.stringify(ctx)}`,
        200
      );
    } catch {
      unlockMessage = `You've been awarded ${ACHIEVEMENTS[achievementSlug].name}! Keep building amazing things.`;
    }
  }

  // Upsert — admin can overwrite an existing achievement with a new message
  const { data, error } = await service
    .from("user_achievements")
    .upsert(
      {
        user_id: userId,
        achievement_slug: achievementSlug,
        unlock_message: unlockMessage,
        related_user_id: null,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "user_id,achievement_slug" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    achievement: {
      ...data,
      user: {
        id: profile.id,
        github_username: (profile as UserProfile).github_username,
        avatar_url: (profile as UserProfile).avatar_url,
        display_name: (profile as UserProfile).display_name,
      },
    },
  });
}
