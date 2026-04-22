import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import type { Challenge } from "@/types/admin";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("challenges")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenges: data as Challenge[] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, difficulty } = await request.json();
  if (!title || !description) {
    return NextResponse.json({ error: "title and description are required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("challenges")
    .insert({ title, description, difficulty: difficulty ?? "medium", is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenge: data as Challenge });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { challengeId, isActive } = await request.json();
  if (!challengeId || isActive === undefined) {
    return NextResponse.json({ error: "challengeId and isActive required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("challenges")
    .update({ is_active: isActive })
    .eq("id", challengeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = user.user_metadata?.user_name ?? user.user_metadata?.login ?? "";
  if (!isAdmin(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { challengeId } = await request.json();
  if (!challengeId) return NextResponse.json({ error: "challengeId required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from("challenges").delete().eq("id", challengeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
