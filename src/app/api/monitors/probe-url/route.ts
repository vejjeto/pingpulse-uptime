import { ProbeUrlSchema } from "@/contracts/pingpulse";
import { probeTargetUrl } from "@/core/worker";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";

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

  const parsed = ProbeUrlSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse({
      status: 400,
      title: "Validation Error",
      detail: "URL o parámetros de sondeo inválidos.",
      requestId,
      extensions: { issues: parsed.error.flatten() },
    });
  }

  const result = await probeTargetUrl({ ...parsed.data, inspectTls: true });
  if (!result.allowed) {
    return problemResponse({
      status: 400,
      title: "SSRF Guard Blocked",
      detail: result.ssrfReason ?? "Bloqueado por guard anti-SSRF",
      requestId,
      extensions: { probe: result },
    });
  }

  return jsonResponse({ probe: result }, { requestId });
}
