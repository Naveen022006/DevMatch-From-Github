import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isPublic, hideFromFeed } = await request.json() as {
    isPublic?: boolean;
    hideFromFeed?: boolean;
  };

  const updates: Record<string, boolean> = {};
  if (isPublic !== undefined) updates.is_public = Boolean(isPublic);
  if (hideFromFeed !== undefined) updates.hide_from_feed = Boolean(hideFromFeed);

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const { error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
