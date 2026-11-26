import { CreateMonitorSchema } from "@/contracts/pingpulse";
import { createMonitor, listMonitorSummaries } from "@/core/service";
import { db } from "@/db";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const items = await listMonitorSummaries(db);
  return jsonResponse({ monitors: items }, { requestId });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemResponse({
      status: 400,
      title: "Invalid JSON",
      detail: "El cuerpo de la petición no es JSON válido.",
      requestId,
    });
  }

  const parsed = CreateMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse({
      status: 400,
      title: "Validation Error",
      detail: "Datos de monitor inválidos.",
      requestId,
      extensions: { issues: parsed.error.flatten() },
    });
  }

  const created = await createMonitor(db, parsed.data);
  if (!created.ok) {
    return problemResponse({
      status: 400,
      title: "SSRF / Monitor Policy Violation",
      detail: created.error,
      requestId,
    });
  }

  return jsonResponse({ monitor: created.monitor }, { status: 201, requestId });
}
