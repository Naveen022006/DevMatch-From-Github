import { createServiceClient } from "@/lib/supabase/server";

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "message"
  | "achievement"
  | "challenge_result";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  message: string;
  link: string;
}) {
  try {
    const service = createServiceClient();

    // Respect per-type notification preferences
    const { data: profile } = await service
      .from("user_profiles")
      .select("notification_preferences")
      .eq("id", params.userId)
      .single();

    const prefs = profile?.notification_preferences as Record<string, boolean> | null;
    if (prefs && prefs[params.type] === false) return; // user disabled this type

    await service.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      message: params.message,
      link: params.link,
      read: false,
    });
  } catch {
    // Fire-and-forget — never block main flow
  }
}
