import { ProbeMonitorSchema } from "@/contracts/pingpulse";
import { probeMonitorById } from "@/core/service";
import { db } from "@/db";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  let body: unknown = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw);
  } catch {
    return problemResponse({
      status: 400,
      title: "Invalid JSON",
      detail: "El cuerpo de la petición no es JSON válido.",
      requestId,
    });
  }

  const parsed = ProbeMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse({
      status: 400,
      title: "Validation Error",
      detail: "Parámetros de sondeo inválidos.",
      requestId,
      extensions: { issues: parsed.error.flatten() },
    });
  }

  const result = await probeMonitorById(db, id, {
    simulateFailure: parsed.data.simulateFailure,
  });

  if (!result) {
    return problemResponse({
      status: 404,
      title: "Not Found",
      detail: `Monitor '${id}' no encontrado.`,
      requestId,
    });
  }

  return jsonResponse(result, { requestId });
}
