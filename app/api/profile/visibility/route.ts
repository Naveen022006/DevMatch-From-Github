import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// PATCH /api/profile/visibility  — toggle public/private
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isPublic } = await request.json() as { isPublic: boolean };
  if (typeof isPublic !== "boolean")
    return NextResponse.json({ error: "isPublic (boolean) required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("user_profiles")
    .update({ is_public: isPublic })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, isPublic });
}
