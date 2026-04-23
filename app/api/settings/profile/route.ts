import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    displayName?: string;
    bio?: string;
    age?: number | null;
    place?: string | null;
    role?: string | null;
    gender?: string | null;
    contact_email?: string | null;
    phone?: string | null;
  };

  const updates: Record<string, unknown> = {};

  if (body.displayName !== undefined)
    updates.display_name = body.displayName.trim().slice(0, 80);

  if (body.bio !== undefined)
    updates.human_description = body.bio.trim().slice(0, 500);

  if (body.age !== undefined) {
    const age = body.age === null ? null : Number(body.age);
    if (age !== null && (isNaN(age) || age < 13 || age > 120))
      return NextResponse.json({ error: "Age must be between 13 and 120" }, { status: 400 });
    updates.age = age;
  }

  if (body.place !== undefined)
    updates.place = body.place === null ? null : body.place.trim().slice(0, 100);

  if (body.role !== undefined)
    updates.role = body.role === null ? null : body.role.trim().slice(0, 80);

  const VALID_GENDERS = ["male", "female", "non-binary", "prefer-not-to-say"];
  if (body.gender !== undefined) {
    if (body.gender !== null && !VALID_GENDERS.includes(body.gender))
      return NextResponse.json({ error: "Invalid gender value" }, { status: 400 });
    updates.gender = body.gender;
  }

  if (body.contact_email !== undefined) {
    if (body.contact_email !== null && body.contact_email.trim() && !body.contact_email.includes("@"))
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    updates.contact_email = body.contact_email === null ? null : body.contact_email.trim().slice(0, 200);
  }

  if (body.phone !== undefined)
    updates.phone = body.phone === null ? null : body.phone.trim().slice(0, 30);

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const { error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
