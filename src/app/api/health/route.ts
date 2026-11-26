import { db } from "@/db";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";
import { sql } from "drizzle-orm";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const startedAt = performance.now();

  try {
    await db.run(sql`SELECT 1`);
    const dbLatencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    return jsonResponse(
      {
        status: "ok",
        service: "pingpulse-uptime",
        version: "2.0.0",
        dbLatencyMs,
        timestamp: new Date().toISOString(),
      },
      { requestId },
    );
  } catch (err) {
    return problemResponse({
      status: 503,
      title: "Service Unavailable",
      detail:
        err instanceof Error ? err.message : "Database health check failed",
      requestId,
    });
  }
}
