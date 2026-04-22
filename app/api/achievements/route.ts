import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  checkAndUnlockAchievements,
  getUserAchievements,
} from "@/lib/achievements/system";
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

    const achievements = await getUserAchievements(user.id);
    return NextResponse.json({ achievements });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch achievements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const body = await request.json();
    const {
      matchedUserId,
      compatibilityScore,
      completedChallenge,
      revivedRepo,
    } = body as {
      matchedUserId?: string;
      compatibilityScore?: number;
      completedChallenge?: boolean;
      revivedRepo?: boolean;
    };

    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let matchedProfile: UserProfile | undefined;
    if (matchedUserId) {
      const { data } = await serviceClient
        .from("user_profiles")
        .select("*")
        .eq("id", matchedUserId)
        .single();
      matchedProfile = data as UserProfile | undefined;
    }

    const unlocked = await checkAndUnlockAchievements({
      userId: user.id,
      profile: profile as UserProfile,
      matchedUserId,
      compatibilityScore,
      matchedProfile,
      completedChallenge,
      revivedRepo,
    });

    return NextResponse.json({ unlocked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Achievement check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
