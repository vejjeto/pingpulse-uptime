import { inspectTlsCertificate } from "@/core/tls-inspector";
import { db } from "@/db";
import { monitors } from "@/db/schema";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const [monitor] = await db
    .select()
    .from(monitors)
    .where(eq(monitors.id, id))
    .limit(1);
  if (!monitor) {
    return problemResponse({
      status: 404,
      title: "Not Found",
      detail: `Monitor '${id}' no encontrado.`,
      requestId,
    });
  }

  const tls = await inspectTlsCertificate(monitor.url, 1500);
  return jsonResponse({ monitorId: id, tls }, { requestId });
}
