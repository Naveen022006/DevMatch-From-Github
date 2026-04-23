import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { preferences } = await request.json() as {
    preferences: Record<string, boolean>;
  };

  if (!preferences || typeof preferences !== "object")
    return NextResponse.json({ error: "preferences object required" }, { status: 400 });

  const { error } = await supabase
    .from("user_profiles")
    .update({ notification_preferences: preferences })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
