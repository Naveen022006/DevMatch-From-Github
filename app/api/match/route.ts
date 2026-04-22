import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { findMatches } from "@/lib/matching/algorithm";
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

    const matches = await findMatches(profile as UserProfile);

    return NextResponse.json({ matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Matching failed";
    console.error("[match]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
