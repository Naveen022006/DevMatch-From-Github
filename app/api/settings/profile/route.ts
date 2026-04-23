import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { displayName, bio } = await request.json() as {
    displayName?: string;
    bio?: string;
  };

  const updates: Record<string, string> = {};
  if (displayName !== undefined) updates.display_name = displayName.trim().slice(0, 80);
  if (bio !== undefined) updates.human_description = bio.trim().slice(0, 500);

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const { error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
