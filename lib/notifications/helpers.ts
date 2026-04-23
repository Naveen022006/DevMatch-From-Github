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
