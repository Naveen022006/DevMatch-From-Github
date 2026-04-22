import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username =
    user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: users, error } = await service
    .from("user_profiles")
    .select(
      "id, github_username, avatar_url, display_name, coding_identity, experience_level, languages, total_repos, total_stars, analysis_cached_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username =
    user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const service = createServiceClient();

  // Delete in FK-safe order
  await service.from("user_achievements").delete().eq("user_id", userId);
  await service.from("user_achievements").delete().eq("related_user_id", userId);
  await service.from("matches").delete().eq("user_id_1", userId);
  await service.from("matches").delete().eq("user_id_2", userId);
  await service.from("story_cards").delete().eq("user_id", userId);
  await service.from("user_profiles").delete().eq("id", userId);
  await service.auth.admin.deleteUser(userId);

  return NextResponse.json({ success: true });
}
