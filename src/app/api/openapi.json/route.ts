import { getPingPulseOpenApiSpec } from "@/contracts/openapi-spec";
import { getRequestId } from "@/lib/logger";
import { jsonResponse } from "@/lib/problem-details";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  return jsonResponse(getPingPulseOpenApiSpec(), { requestId });
}
