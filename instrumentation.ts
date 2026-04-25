/**
 * Next.js instrumentation hook — runs once when the server starts.
 * In production (Render), it schedules a self-ping every 14 minutes
 * to prevent Render's free tier from spinning down the service.
 */
export async function register() {
  if (process.env.NODE_ENV !== "production") return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return;

  const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

  const ping = async () => {
    try {
      await fetch(`${appUrl}/api/keep-alive`, { cache: "no-store" });
    } catch {
      // Non-critical — server will still wake up on next real request
    }
  };

  // Wait 1 minute after startup before first ping, then repeat every 14 min
  setTimeout(() => {
    ping();
    setInterval(ping, INTERVAL_MS);
  }, 60_000);
}
