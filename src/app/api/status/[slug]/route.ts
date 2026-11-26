import { getPublicStatusBySlug } from "@/core/service";
import { db } from "@/db";
import { getRequestId } from "@/lib/logger";
import { jsonResponse, problemResponse } from "@/lib/problem-details";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const requestId = getRequestId(request);
  const { slug } = await context.params;
  const status = await getPublicStatusBySlug(db, slug);
  if (!status) {
    return problemResponse({
      status: 404,
      title: "Status Page Not Found",
      detail: `Página de estado '${slug}' no encontrada.`,
      requestId,
    });
  }
  return jsonResponse(status, { requestId });
}
