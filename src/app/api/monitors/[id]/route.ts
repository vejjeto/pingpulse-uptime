import { deleteMonitorById, getMonitorTelemetry } from "@/core/service";
import { db } from "@/db";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const telemetry = await getMonitorTelemetry(db, id, "24h");
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const deleted = await deleteMonitorById(db, id);
  if (!deleted) {
    return problemResponse({
      status: 404,
      title: "Not Found",
      detail: `Monitor '${id}' no encontrado.`,
      requestId,
    });
  }
  return jsonResponse({ deleted: true, id }, { requestId });
}
