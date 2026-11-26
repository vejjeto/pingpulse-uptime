import { GET as getBadge } from "@/app/api/badge/[monitorId]/route";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getMonitorById } from "@/app/api/monitors/[id]/route";
import { GET as getOpenApi } from "@/app/api/openapi.json/route";
import type { HeartbeatRecord, MonitorRecord } from "@/contracts/pingpulse";
import { renderUptimeBadgeSvg } from "@/core/badge";
import { evaluateIncidentTransition } from "@/core/incidents";
import { getPublicStatusBySlug, probeMonitorById } from "@/core/service";
import {
  buildDailyBuckets,
  buildWindowMetrics,
  computePercentile,
  computeUptimePercent,
} from "@/core/telemetry";
import { computeTlsStatus } from "@/core/tls-inspector";
import {
  probeTargetUrl,
  runWithConcurrency,
  validateSafeExternalUrl,
} from "@/core/worker";
import { createPingPulseDb } from "@/db";
import { buildPgWindowMetricsQuery } from "@/db/queries.pg";
import { ensureSeeded } from "@/db/seed-data";
import { validateEnv } from "@/lib/env";
import { problemResponse } from "@/lib/problem-details";
import { signHmacSha256, verifyHmacSha256 } from "@/lib/webhooks";
import { afterEach, describe, expect, it } from "vitest";

const SAMPLE_MONITOR: MonitorRecord = {
  id: "mon-test",
  slug: "test-service",
  name: "Test Service",
  url: "https://example.com/health",
  method: "GET",
  expectedStatus: 200,
  intervalSeconds: 60,
  timeoutMs: 3000,
  webhookUrl: "https://hooks.example.com/pingpulse",
  isActive: true,
  isPublic: true,
  createdAt: new Date().toISOString(),
};

afterEach(() => {
  process.env.SKIP_ENV_VALIDATION = undefined;
});

describe("PingPulse DNS Anti-SSRF & Redirect Hop Guard", () => {
  it("blocks private IPv4, loopback, link-local, IPv6 ::1/ULA, localhost, and non-http protocols", async () => {
    const blockedUrls = [
      "http://127.0.0.1/health",
      "http://10.0.0.5/internal",
      "http://172.16.4.12/metrics",
      "http://192.168.1.1/admin",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]:3000/",
      "http://[fc00::1]/secret",
      "http://localhost:3007/api/health",
      "file:///etc/passwd",
    ];

    for (const url of blockedUrls) {
      const res = await validateSafeExternalUrl(url);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBeTruthy();
    }
  });

  it("blocks DNS resolution to private IP addresses", async () => {
    const fakeLookup = (async () => [
      { address: "10.12.0.8", family: 4 },
    ]) as unknown as NonNullable<
      Parameters<typeof validateSafeExternalUrl>[1]
    >["lookup"];

    const res = await validateSafeExternalUrl(
      "https://evil.example.com/health",
      {
        lookup: fakeLookup,
      },
    );
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("10.12.0.8");
  });

  it("blocks HTTP redirects pointing to private/loopback/metadata IPs", async () => {
    const redirectFetch: typeof fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest/meta-data/" },
      });

    const res = await probeTargetUrl({
      url: "https://93.184.216.34/start",
      fetcher: redirectFetch,
    });

    expect(res.allowed).toBe(false);
    expect(res.status).toBe("down");
    expect(res.ssrfReason).toContain("169.254.169.254");
  });

  it("stops after 3 redirect hops", async () => {
    const loopFetch: typeof fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://93.184.216.34/next" },
      });

    const res = await probeTargetUrl({
      url: "https://93.184.216.34/start",
      fetcher: loopFetch,
    });

    expect(res.allowed).toBe(false);
    expect(res.ssrfReason).toContain("3");
  });
});

describe("PingPulse telemetry math (P50/P95/P99, uptime %, 30d buckets, PG parity)", () => {
  it("computes exact percentiles P50, P95, P99 and uptime percentage", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(computePercentile([], 95)).toBe(0);
    expect(computePercentile([42], 99)).toBe(42);
    expect(computePercentile(samples, 50)).toBe(50.5);
    expect(computePercentile(samples, 95)).toBe(95.05);
    expect(computePercentile(samples, 99)).toBe(99.01);
    expect(computeUptimePercent(19, 20)).toBe(95);
    expect(computeUptimePercent(0, 0)).toBe(100);
  });

  it("builds 24h window metrics and 30 daily buckets accurately", () => {
    const now = Date.now();
    const hbs: HeartbeatRecord[] = [
      {
        id: "1",
        monitorId: "m",
        status: "up",
        httpStatus: 200,
        latencyMs: 20,
        errorMessage: null,
        checkedAt: new Date(now - 1000 * 60 * 10).toISOString(),
      },
      {
        id: "2",
        monitorId: "m",
        status: "down",
        httpStatus: 503,
        latencyMs: 3000,
        errorMessage: "503",
        checkedAt: new Date(now - 1000 * 60 * 5).toISOString(),
      },
    ];

    const w24 = buildWindowMetrics(hbs, "24h", now);
    expect(w24.checksTotal).toBe(2);
    expect(w24.checksOk).toBe(1);
    expect(w24.uptimePercent).toBe(50);

    const buckets = buildDailyBuckets(hbs, 30, now);
    expect(buckets).toHaveLength(30);
    expect(buckets[29]?.status).toBe("degraded");
    expect(buckets[29]?.uptimePercent).toBe(50);
  });

  it("builds parameterized PostgreSQL PERCENTILE_CONT query", () => {
    const query = buildPgWindowMetricsQuery("mon-acme-api", "24h");
    expect(query).toBeDefined();
  });
});

describe("PingPulse bounded concurrency worker & AbortController timeout", () => {
  it("enforces max 5 concurrent tasks in runWithConcurrency and preserves output order", async () => {
    let active = 0;
    let maxObserved = 0;

    const tasks = Array.from({ length: 16 }, (_, idx) => async () => {
      active += 1;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1;
      return idx * 2;
    });

    const results = await runWithConcurrency(tasks, 5);
    expect(maxObserved).toBeLessThanOrEqual(5);
    expect(maxObserved).toBeGreaterThan(1);
    expect(results).toEqual(Array.from({ length: 16 }, (_, idx) => idx * 2));
  });

  it("handles AbortController timeout cleanly in probeTargetUrl", async () => {
    const slowFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });

    const res = await probeTargetUrl({
      url: "https://93.184.216.34/health",
      timeoutMs: 40,
      fetcher: slowFetch,
    });

    expect(res.allowed).toBe(true);
    expect(res.status).toBe("down");
    expect(res.errorMessage).toContain("Timeout tras 40ms");
  });
});

describe("PingPulse incident state machine & HMAC-SHA256 webhooks", () => {
  it("opens incident only on 2nd consecutive failure and resolves on recovery", async () => {
    const firstFailure = await evaluateIncidentTransition({
      monitor: SAMPLE_MONITOR,
      previousStatusesDesc: ["up", "up"],
      openIncident: null,
      newStatus: "down",
      cause: "HTTP 503",
      checkedAt: "2026-11-25T10:00:00.000Z",
      sendWebhook: false,
    });

    expect(firstFailure.action).toBe("none");
    expect(firstFailure.consecutiveFailures).toBe(1);
    expect(firstFailure.incident).toBeNull();

    const secondFailure = await evaluateIncidentTransition({
      monitor: SAMPLE_MONITOR,
      previousStatusesDesc: ["down", "up"],
      openIncident: null,
      newStatus: "down",
      cause: "HTTP 503",
      checkedAt: "2026-11-25T10:01:00.000Z",
      sendWebhook: false,
    });

    expect(secondFailure.action).toBe("opened");
    expect(secondFailure.consecutiveFailures).toBe(2);
    expect(secondFailure.incident?.status).toBe("open");
    expect(secondFailure.webhook?.headerName).toBe("X-PingPulse-Signature");
    expect(secondFailure.webhook?.signature.startsWith("sha256=")).toBe(true);

    const recovery = await evaluateIncidentTransition({
      monitor: SAMPLE_MONITOR,
      previousStatusesDesc: ["down", "down"],
      openIncident: secondFailure.incident,
      newStatus: "up",
      cause: null,
      checkedAt: "2026-11-25T10:02:00.000Z",
      sendWebhook: false,
    });

    expect(recovery.action).toBe("resolved");
    expect(recovery.incident?.status).toBe("resolved");
    expect(recovery.incident?.resolvedAt).toBe("2026-11-25T10:02:00.000Z");
    expect(recovery.webhook?.event).toBe("monitor.incident_resolved");
  });

  it("verifies HMAC X-PingPulse-Signature integrity", () => {
    const secret = "pingpulse-test-secret";
    const payload = JSON.stringify({
      event: "monitor.incident_opened",
      monitorId: "mon-1",
    });
    const sig = signHmacSha256(payload, secret);

    expect(verifyHmacSha256(payload, sig, secret)).toBe(true);
    expect(verifyHmacSha256(`${payload}tampered`, sig, secret)).toBe(false);
    expect(verifyHmacSha256(payload, "sha256=deadbeef", secret)).toBe(false);
  });
});

describe("PingPulse TLS Expiry Inspector & Dynamic SVG Badge", () => {
  it("computes TLS expiry days and status thresholds accurately", () => {
    const nowMs = Date.parse("2026-11-25T00:00:00.000Z");
    const valid = computeTlsStatus("2027-02-25T00:00:00.000Z", nowMs);
    expect(valid.status).toBe("valid");
    expect(valid.daysRemaining).toBe(92);

    const expiring = computeTlsStatus("2026-12-02T00:00:00.000Z", nowMs);
    expect(expiring.status).toBe("expiring_soon");
    expect(expiring.daysRemaining).toBe(7);

    const expired = computeTlsStatus("2026-11-20T00:00:00.000Z", nowMs);
    expect(expired.status).toBe("expired");
    expect(expired.daysRemaining).toBe(-5);

    const invalid = computeTlsStatus("not-a-date", nowMs);
    expect(invalid.status).toBe("unavailable");
  });

  it("renders valid SVG badge XML and serves /api/badge/[monitorId].svg", async () => {
    const svg = renderUptimeBadgeSvg({
      name: "Acme Core API",
      uptimePercent: 99.95,
      status: "up",
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("Acme Core API");
    expect(svg).toContain("99.95% UP");
    expect(svg).toContain("#10b981");

    const res = await getBadge(
      new Request("http://localhost:3007/api/badge/mon-acme-api.svg"),
      {
        params: Promise.resolve({ monitorId: "mon-acme-api.svg" }),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    const body = await res.text();
    expect(body).toContain("<svg");
  });
});

describe("PingPulse Env, RFC 7807, SQLite persistence & Observability", () => {
  it("validates env and honors SKIP_ENV_VALIDATION=true", () => {
    expect(() =>
      validateEnv({
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow(/Invalid environment configuration/);

    const skipped = validateEnv({
      SKIP_ENV_VALIDATION: "true",
      NEXT_PUBLIC_APP_URL: "not-a-url",
    });
    expect(skipped.DATABASE_URL).toBe("file:./data/pingpulse.db");
  });

  it("returns RFC 7807 application/problem+json with x-request-id", async () => {
    const res = problemResponse({
      status: 400,
      title: "Bad Request",
      detail: "Invalid payload",
      requestId: "req-test-123",
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(res.headers.get("x-request-id")).toBe("req-test-123");

    const notFoundRes = await getMonitorById(
      new Request("http://localhost:3007/api/monitors/non-existent", {
        headers: { "x-request-id": "req-404" },
      }),
      { params: Promise.resolve({ id: "non-existent" }) },
    );
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(notFoundRes.headers.get("x-request-id")).toBe("req-404");
  });

  it("persists 2-strike failure -> incident -> recovery cycle in SQLite", async () => {
    const { db, sqlite } = createPingPulseDb(":memory:");
    try {
      const seedRes = await ensureSeeded(db);
      expect(seedRes.seeded).toBe(true);

      const fail1 = await probeMonitorById(db, "mon-acme-api", {
        simulateFailure: true,
        sendWebhook: false,
      });
      expect(fail1?.transition.action).toBe("none");

      const fail2 = await probeMonitorById(db, "mon-acme-api", {
        simulateFailure: true,
        sendWebhook: false,
      });
      expect(fail2?.transition.action).toBe("opened");
      expect(fail2?.transition.incident?.status).toBe("open");

      const statusDuringOutage = await getPublicStatusBySlug(db, "public");
      expect(statusDuringOutage?.overallStatus).toBe("outage");

      const okFetch: typeof fetch = async () =>
        new Response("ok", { status: 200 });
      // Use a monitor with a public IP or mock DNS? Here we test recovery with a public IP monitor:
      await db.insert((await import("@/db/schema")).monitors).values({
        id: "mon-recovery-ip",
        slug: "recovery-ip",
        name: "Recovery IP",
        url: "https://93.184.216.34/health",
        method: "GET",
        expectedStatus: 200,
        intervalSeconds: 60,
        timeoutMs: 3000,
        webhookUrl: null,
        isActive: true,
        isPublic: true,
        createdAt: new Date().toISOString(),
      });

      await probeMonitorById(db, "mon-recovery-ip", {
        simulateFailure: true,
        sendWebhook: false,
      });
      await probeMonitorById(db, "mon-recovery-ip", {
        simulateFailure: true,
        sendWebhook: false,
      });
      const recovered = await probeMonitorById(db, "mon-recovery-ip", {
        fetcher: okFetch,
        sendWebhook: false,
      });
      expect(recovered?.transition.action).toBe("resolved");
    } finally {
      sqlite.close();
    }
  });

  it("returns healthy /api/health (pingpulse-uptime) and valid /api/openapi.json spec", async () => {
    const healthRes = await getHealth(
      new Request("http://localhost:3007/api/health"),
    );
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get("x-request-id")).toBeTruthy();
    const healthJson = (await healthRes.json()) as {
      status: string;
      service: string;
    };
    expect(healthJson.status).toBe("ok");
    expect(healthJson.service).toBe("pingpulse-uptime");

    const openapiRes = await getOpenApi(
      new Request("http://localhost:3007/api/openapi.json"),
    );
    expect(openapiRes.status).toBe(200);
    const spec = (await openapiRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/monitors"]).toBeDefined();
    expect(spec.paths["/api/badge/{monitorId}"]).toBeDefined();
  });
});
