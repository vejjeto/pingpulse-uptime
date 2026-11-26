import type { HeartbeatStatus } from "@/contracts/pingpulse";
import { type SsrfValidationResult, validateSafeExternalUrl } from "@/lib/ssrf";
import { type TlsCertInfo, inspectTlsCertificate } from "./tls-inspector";

export { validateSafeExternalUrl };

const MAX_REDIRECT_HOPS = 3;

export interface ProbeExecutionOptions {
  url: string;
  method?: string;
  expectedStatus?: number;
  timeoutMs?: number;
  degradedThresholdMs?: number;
  fetcher?: typeof fetch;
  inspectTls?: boolean;
  tlsInspector?: (url: string, timeoutMs?: number) => Promise<TlsCertInfo>;
}

export interface ProbeExecutionResult {
  allowed: boolean;
  status: HeartbeatStatus;
  httpStatus: number | null;
  latencyMs: number;
  resolvedIp?: string;
  errorMessage: string | null;
  ssrfReason?: string;
  tls?: TlsCertInfo;
}

/**
 * Runs async task factories with a strict semaphore concurrency cap.
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency = 5,
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const maxWorkers = Math.max(1, Math.floor(concurrency));
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex;
      nextIndex += 1;
      const task = tasks[current];
      if (task) {
        results[current] = await task();
      }
    }
  }

  const workerCount = Math.min(maxWorkers, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

/**
 * Validates target URL and every redirect hop (up to 3 hops) against SSRF rules
 * before running an AbortController-bounded HTTP probe.
 */
export async function probeTargetUrl(
  options: ProbeExecutionOptions,
): Promise<ProbeExecutionResult> {
  const initialCheck: SsrfValidationResult = await validateSafeExternalUrl(
    options.url,
  );

  if (!initialCheck.allowed || !initialCheck.normalizedUrl) {
    return {
      allowed: false,
      status: "down",
      httpStatus: null,
      latencyMs: 0,
      errorMessage: initialCheck.reason ?? "Blocked by SSRF guard",
      ssrfReason: initialCheck.reason ?? "Blocked by SSRF guard",
    };
  }

  const timeoutMs = options.timeoutMs ?? 5000;
  const expectedStatus = options.expectedStatus ?? 200;
  const degradedThresholdMs = options.degradedThresholdMs ?? 1500;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  let currentUrl = initialCheck.normalizedUrl;
  let currentIp = initialCheck.resolvedIp;

  try {
    let response: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
      response = await fetcher(currentUrl, {
        method: options.method ?? "GET",
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "PingPulse-Monitor/2.0" },
      });

      if (!isRedirectStatus(response.status)) {
        break;
      }

      const location = response.headers.get("location");
      if (!location) {
        break;
      }

      if (hop === MAX_REDIRECT_HOPS) {
        return {
          allowed: false,
          status: "down",
          httpStatus: response.status,
          latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
          errorMessage: `Máximo de ${MAX_REDIRECT_HOPS} redirecciones excedido`,
          ssrfReason: `Máximo de ${MAX_REDIRECT_HOPS} redirecciones excedido`,
        };
      }

      const resolvedRedirect = new URL(location, currentUrl).toString();
      const hopCheck = await validateSafeExternalUrl(resolvedRedirect);
      if (!hopCheck.allowed || !hopCheck.normalizedUrl) {
        return {
          allowed: false,
          status: "down",
          httpStatus: response.status,
          latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
          errorMessage: hopCheck.reason ?? "Redirect blocked by SSRF guard",
          ssrfReason: hopCheck.reason ?? "Redirect blocked by SSRF guard",
        };
      }

      currentUrl = hopCheck.normalizedUrl;
      currentIp = hopCheck.resolvedIp;
    }

    if (!response) {
      return {
        allowed: true,
        status: "down",
        httpStatus: null,
        latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
        errorMessage: "Empty probe response",
      };
    }

    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const isExpected = response.status === expectedStatus;
    const status: HeartbeatStatus = !isExpected
      ? "down"
      : latencyMs > degradedThresholdMs
        ? "degraded"
        : "up";

    const tlsInspector = options.tlsInspector ?? inspectTlsCertificate;
    const tlsInfo =
      options.inspectTls && currentUrl.startsWith("https://")
        ? await tlsInspector(currentUrl, Math.min(2500, timeoutMs))
        : undefined;

    return {
      allowed: true,
      status,
      httpStatus: response.status,
      latencyMs,
      ...(currentIp ? { resolvedIp: currentIp } : {}),
      ...(tlsInfo ? { tls: tlsInfo } : {}),
      errorMessage: isExpected
        ? null
        : `HTTP ${response.status} (esperado ${expectedStatus})`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `Timeout tras ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : "Probe request failed";
    return {
      allowed: true,
      status: "down",
      httpStatus: null,
      latencyMs,
      ...(currentIp ? { resolvedIp: currentIp } : {}),
      errorMessage: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
