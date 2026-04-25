/**
 * Keep-alive endpoint — called by the self-ping route to prevent Render
 * free-tier from spinning down after 15 minutes of inactivity.
 *
 * External trigger: GET /api/keep-alive
 * Self-trigger:     runs every 14 min via the instrumentation hook (see instrumentation.ts)
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
}
