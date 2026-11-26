import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import type { PingPulseDb } from "./index";
import { heartbeats, incidents, monitors } from "./schema";

interface SeedMonitorSpec {
  id: string;
  slug: string;
  name: string;
  url: string;
  baseLatency: number;
  jitter: number;
  downDayOffsets: number[];
}

const SEED_MONITORS: readonly SeedMonitorSpec[] = [
  {
    id: "mon-acme-api",
    slug: "acme-api",
    name: "Acme Core API",
    url: "https://api.acme-cloud.dev/health",
    baseLatency: 28,
    jitter: 18,
    downDayOffsets: [],
  },
  {
    id: "mon-acme-auth",
    slug: "acme-auth",
    name: "Acme Auth Gateway",
    url: "https://auth.acme-cloud.dev/health",
    baseLatency: 46,
    jitter: 32,
    downDayOffsets: [11],
  },
  {
    id: "mon-acme-cdn",
    slug: "acme-cdn",
    name: "Acme Edge CDN",
    url: "https://cdn.acme-cloud.dev/health",
    baseLatency: 21,
    jitter: 14,
    downDayOffsets: [],
  },
  {
    id: "mon-acme-payments",
    slug: "acme-payments",
    name: "Acme Payments API",
    url: "https://payments.acme-cloud.dev/health",
    baseLatency: 54,
    jitter: 35,
    downDayOffsets: [6],
  },
];

function deterministicFraction(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function build30DayHeartbeats(
  spec: SeedMonitorSpec,
  monitorIndex: number,
  nowMs: number,
) {
  const rows: Array<typeof heartbeats.$inferInsert> = [];
  const checksPerDay = 6;

  for (let day = 29; day >= 0; day -= 1) {
    const isDegradedDay = spec.downDayOffsets.includes(day);
    for (let slot = 0; slot < checksPerDay; slot += 1) {
      const hoursAgo = day * 24 + (checksPerDay - slot) * 3.5;
      const checkedAt = new Date(nowMs - hoursAgo * 3600 * 1000).toISOString();
      const frac = deterministicFraction(
        (monitorIndex + 1) * 1000 + day * 17 + slot,
      );

      const isFailure = isDegradedDay && slot === 2;
      const isSpike = !isFailure && frac > 0.92;
      const latencyMs = isFailure
        ? 4100
        : Math.round(
            spec.baseLatency + frac * spec.jitter + (isSpike ? 140 : 0),
          );

      rows.push({
        id: `hb-${spec.slug}-${day}-${slot}`,
        monitorId: spec.id,
        status: isFailure ? "down" : isSpike ? "degraded" : "up",
        httpStatus: isFailure ? 503 : 200,
        latencyMs,
        errorMessage: isFailure ? "Upstream timeout after 4000ms" : null,
        checkedAt,
      });
    }
  }

  return rows;
}

export async function ensureSeeded(
  db: PingPulseDb,
): Promise<{ seeded: boolean }> {
  const [existing] = await db.select({ total: count() }).from(monitors);
  if ((existing?.total ?? 0) > 0) {
    return { seeded: false };
  }

  const nowMs = Date.now();
  const createdAt = new Date(nowMs - 30 * 24 * 3600 * 1000).toISOString();

  await db.insert(monitors).values(
    SEED_MONITORS.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      url: m.url,
      method: "GET",
      expectedStatus: 200,
      intervalSeconds: 60,
      timeoutMs: 5000,
      webhookUrl: null,
      isActive: true,
      isPublic: true,
      createdAt,
    })),
  );

  const allHeartbeats = SEED_MONITORS.flatMap((spec, idx) =>
    build30DayHeartbeats(spec, idx, nowMs),
  );

  const chunkSize = 100;
  for (let i = 0; i < allHeartbeats.length; i += chunkSize) {
    await db.insert(heartbeats).values(allHeartbeats.slice(i, i + chunkSize));
  }

  const incidentStart = new Date(
    nowMs - 6 * 24 * 3600 * 1000 - 18 * 60 * 1000,
  ).toISOString();
  const incidentEnd = new Date(
    nowMs - 6 * 24 * 3600 * 1000 - 4 * 60 * 1000,
  ).toISOString();

  await db.insert(incidents).values({
    id: `inc-${randomUUID().slice(0, 8)}`,
    monitorId: "mon-acme-payments",
    status: "resolved",
    cause: "HTTP 503 — Pool de conexiones saturado en pico de checkout",
    startedAt: incidentStart,
    resolvedAt: incidentEnd,
  });

  return { seeded: true };
}
