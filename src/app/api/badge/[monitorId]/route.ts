import { renderUptimeBadgeSvg } from "@/core/badge";
import { listMonitorSummaries } from "@/core/service";
import { db } from "@/db";
import { getRequestId } from "@/lib/logger";
import { problemResponse } from "@/lib/problem-details";

export async function GET(
  request: Request,
  context: { params: Promise<{ monitorId: string }> },
) {
  const requestId = getRequestId(request);
  const { monitorId: rawParam } = await context.params;
  const monitorId = rawParam.endsWith(".svg")
    ? rawParam.slice(0, -4)
    : rawParam;

  const monitors = await listMonitorSummaries(db);
  const monitor = monitors.find(
    (m) => m.id === monitorId || m.slug === monitorId,
  );

  if (!monitor) {
    return problemResponse({
      status: 404,
      title: "Monitor not found",
      detail: `Monitor '${monitorId}' no encontrado para generar badge SVG.`,
      requestId,
    });
  }

  const svg = renderUptimeBadgeSvg({
    name: monitor.name,
    uptimePercent: monitor.uptime24h,
    status: monitor.currentStatus,
  });

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "x-request-id": requestId,
    },
  });
}
