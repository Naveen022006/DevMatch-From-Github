import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Load existing profile if available
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <DashboardClient
      userId={user.id}
      githubUsername={user.user_metadata?.user_name ?? ""}
      avatarUrl={user.user_metadata?.avatar_url ?? ""}
      initialProfile={profile}
    />
  );
}
