import { createHmac, timingSafeEqual } from "node:crypto";
import { validateSafeExternalUrl } from "./ssrf";

export function signHmacSha256(payload: string, secret: string): string {
  const digest = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
  return `sha256=${digest}`;
}

export function verifyHmacSha256(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signHmacSha256(payload, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface EmitWebhookInput {
  targetUrl: string;
  secret: string;
  event: string;
  source: string;
  signatureHeaderName?: string;
  data: Record<string, unknown>;
  fetcher?: typeof fetch;
}

export interface EmitWebhookResult {
  sent: boolean;
  signature: string;
  statusCode?: number;
  error?: string;
}

export async function emitSignedWebhook(
  input: EmitWebhookInput,
): Promise<EmitWebhookResult> {
  const body = JSON.stringify({
    event: input.event,
    source: input.source,
    timestamp: new Date().toISOString(),
    data: input.data,
  });
  const signature = signHmacSha256(body, input.secret);
  const headerName = input.signatureHeaderName ?? "X-PingPulse-Signature";

  const ssrf = await validateSafeExternalUrl(input.targetUrl);
  if (!ssrf.allowed || !ssrf.normalizedUrl) {
    return {
      sent: false,
      signature,
      error: ssrf.reason ?? "Webhook target blocked by SSRF guard",
    };
  }

  try {
    const fetcher = input.fetcher ?? fetch;
    const res = await fetcher(ssrf.normalizedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headerName]: signature,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        sent: false,
        signature,
        statusCode: res.status,
        error: `HTTP ${res.status}`,
      };
    }

    return {
      sent: true,
      signature,
      statusCode: res.status,
    };
  } catch (err) {
    return {
      sent: false,
      signature,
      error: err instanceof Error ? err.message : "Webhook delivery failed",
    };
  }
}
