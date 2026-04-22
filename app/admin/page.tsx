import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const username =
    user.user_metadata?.user_name ??
    user.user_metadata?.login ??
    "";

  if (!isAdmin(username)) redirect("/dashboard");

  return (
    <AdminDashboardClient
      githubUsername={username}
      avatarUrl={user.user_metadata?.avatar_url ?? ""}
    />
  );
}
