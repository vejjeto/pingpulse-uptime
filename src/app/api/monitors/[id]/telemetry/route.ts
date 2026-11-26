import { TimeWindowSchema } from "@/contracts/pingpulse";
import { getMonitorTelemetry } from "@/core/service";
import { db } from "@/db";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const url = new URL(request.url);
  const rawWindow = url.searchParams.get("window") ?? "24h";
  const parsedWindow = TimeWindowSchema.safeParse(rawWindow);

  if (!parsedWindow.success) {
    return problemResponse({
      status: 400,
      title: "Invalid Time Window",
      detail: "Ventana inválida. Usa 24h, 7d o 30d.",
      requestId,
    });
  }

  const telemetry = await getMonitorTelemetry(db, id, parsedWindow.data);
  if (!telemetry) {
    return problemResponse({
      status: 404,
      title: "Not Found",
      detail: `Monitor '${id}' no encontrado.`,
      requestId,
    });
  }

  return jsonResponse(telemetry, { requestId });
}
