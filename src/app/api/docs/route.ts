import { getPingPulseOpenApiSpec } from "@/contracts/openapi-spec";
import { getRequestId } from "@/lib/logger";
import { renderOpenApiDocsHtml } from "@/lib/openapi";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const html = renderOpenApiDocsHtml({
    title: "PingPulse API",
    specUrl: "/api/openapi.json",
    spec: getPingPulseOpenApiSpec(),
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
