import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserProfile } from "@/types";
import SettingsClient from "./SettingsClient";

export const metadata = {
  title: "Settings — DevMatch",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  return (
    <SettingsClient
      profile={profile as UserProfile}
      avatarUrl={user.user_metadata?.avatar_url ?? profile.avatar_url}
      githubUsername={profile.github_username}
    />
  );
}
