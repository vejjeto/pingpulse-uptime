import { randomUUID } from "node:crypto";
import type {
  CreateMonitorInput,
  HeartbeatRecord,
  HeartbeatStatus,
  IncidentRecord,
  MonitorRecord,
  MonitorSummary,
  PublicStatusResponse,
  StatusServiceItem,
  TelemetryResponse,
  TimeWindow,
} from "@/contracts/pingpulse";
import type { PingPulseDb } from "@/db";
import { heartbeats, incidents, monitors } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  type IncidentTransitionResult,
  evaluateIncidentTransition,
} from "./incidents";
import {
  buildDailyBuckets,
  buildTelemetrySummary,
  buildWindowMetrics,
} from "./telemetry";
import {
  probeTargetUrl,
  runWithConcurrency,
  validateSafeExternalUrl,
} from "./worker";

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `monitor-${randomUUID().slice(0, 6)}`;
}

function toHeartbeatRecord(
  row: typeof heartbeats.$inferSelect,
): HeartbeatRecord {
  return {
    ...row,
    status: row.status as HeartbeatStatus,
  };
}

function toIncidentRecord(row: typeof incidents.$inferSelect): IncidentRecord {
  return {
    ...row,
    status: row.status as IncidentRecord["status"],
  };
}

function countConsecutiveFailures(
  descRows: readonly HeartbeatRecord[],
): number {
  let count = 0;
  for (const row of descRows) {
    if (row.status !== "down") break;
    count += 1;
  }
  return count;
}

export async function listMonitorSummaries(
  db: PingPulseDb,
): Promise<MonitorSummary[]> {
  const monitorRows = await db
    .select()
    .from(monitors)
    .orderBy(monitors.createdAt);
  const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recentRows = await db
    .select()
    .from(heartbeats)
    .where(gte(heartbeats.checkedAt, cutoff24h))
    .orderBy(desc(heartbeats.checkedAt));
  const openRows = await db
    .select()
    .from(incidents)
    .where(eq(incidents.status, "open"));

  const hbByMonitor = new Map<string, HeartbeatRecord[]>();
  for (const row of recentRows) {
    const list = hbByMonitor.get(row.monitorId) ?? [];
    list.push(toHeartbeatRecord(row));
    hbByMonitor.set(row.monitorId, list);
  }

  const incidentByMonitor = new Map<string, IncidentRecord>();
  for (const row of openRows) {
    incidentByMonitor.set(row.monitorId, toIncidentRecord(row));
  }

  return monitorRows.map((m) => {
    const list = hbByMonitor.get(m.id) ?? [];
    const latest = list[0] ?? null;
    const metrics24h = buildWindowMetrics(list, "24h");
    const openIncident = incidentByMonitor.get(m.id) ?? null;

    return {
      ...m,
      currentStatus: openIncident ? "down" : (latest?.status ?? "up"),
      lastLatencyMs: latest?.latencyMs ?? null,
      lastCheckedAt: latest?.checkedAt ?? null,
      uptime24h: metrics24h.uptimePercent,
      p95_24h: metrics24h.p95Ms,
      openIncident,
      consecutiveFailures: countConsecutiveFailures(list),
    };
  });
}

export async function createMonitor(
  db: PingPulseDb,
  input: CreateMonitorInput,
): Promise<
  { ok: true; monitor: MonitorRecord } | { ok: false; error: string }
> {
  const urlCheck = await validateSafeExternalUrl(input.url);
  if (!urlCheck.allowed) {
    return {
      ok: false,
      error: urlCheck.reason ?? "URL bloqueada por SSRF guard",
    };
  }

  const webhookUrl = input.webhookUrl?.trim() || null;
  if (webhookUrl) {
    const webhookCheck = await validateSafeExternalUrl(webhookUrl);
    if (!webhookCheck.allowed) {
      return {
        ok: false,
        error: webhookCheck.reason ?? "Webhook URL bloqueada por SSRF guard",
      };
    }
  }

  const slug = input.slug
    ? input.slug
    : `${slugify(input.name)}-${randomUUID().slice(0, 4)}`;
  const record: MonitorRecord = {
    id: `mon-${randomUUID().slice(0, 8)}`,
    slug,
    name: input.name,
    url: urlCheck.normalizedUrl ?? input.url,
    method: input.method,
    expectedStatus: input.expectedStatus,
    intervalSeconds: input.intervalSeconds,
    timeoutMs: input.timeoutMs,
    webhookUrl,
    isActive: true,
    isPublic: input.isPublic,
    createdAt: new Date().toISOString(),
  };

  await db.insert(monitors).values(record);
  return { ok: true, monitor: record };
}

export async function getMonitorTelemetry(
  db: PingPulseDb,
  monitorId: string,
  window: TimeWindow,
): Promise<TelemetryResponse | null> {
  const [monitor] = await db
    .select()
    .from(monitors)
    .where(eq(monitors.id, monitorId))
    .limit(1);
  if (!monitor) return null;

  const cutoff30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const hbRows = await db
    .select()
    .from(heartbeats)
    .where(
      and(
        eq(heartbeats.monitorId, monitorId),
        gte(heartbeats.checkedAt, cutoff30d),
      ),
    )
    .orderBy(desc(heartbeats.checkedAt));

  const incidentRows = await db
    .select()
    .from(incidents)
    .where(eq(incidents.monitorId, monitorId))
    .orderBy(desc(incidents.startedAt));

  return buildTelemetrySummary({
    monitor,
    heartbeats: hbRows.map(toHeartbeatRecord),
    incidents: incidentRows.map(toIncidentRecord),
    activeWindow: window,
  });
}

export async function deleteMonitorById(
  db: PingPulseDb,
  monitorId: string,
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(monitors)
    .where(eq(monitors.id, monitorId))
    .limit(1);
  if (!existing) return false;
  await db.delete(monitors).where(eq(monitors.id, monitorId));
  return true;
}

export async function probeMonitorById(
  db: PingPulseDb,
  monitorId: string,
  options?: {
    simulateFailure?: boolean;
    fetcher?: typeof fetch;
    sendWebhook?: boolean;
  },
): Promise<{
  monitor: MonitorRecord;
  heartbeat: HeartbeatRecord;
  transition: IncidentTransitionResult;
} | null> {
  const [monitor] = await db
    .select()
    .from(monitors)
    .where(eq(monitors.id, monitorId))
    .limit(1);
  if (!monitor) return null;

  const previousRows = await db
    .select()
    .from(heartbeats)
    .where(eq(heartbeats.monitorId, monitorId))
    .orderBy(desc(heartbeats.checkedAt))
    .limit(5);

  const [openIncidentRow] = await db
    .select()
    .from(incidents)
    .where(
      and(eq(incidents.monitorId, monitorId), eq(incidents.status, "open")),
    )
    .limit(1);

  const checkedAt = new Date().toISOString();
  const probe = options?.simulateFailure
    ? {
        allowed: true,
        status: "down" as const,
        httpStatus: 503,
        latencyMs: 5000,
        errorMessage: "Simulación manual de caída (HTTP 503)",
      }
    : await probeTargetUrl({
        url: monitor.url,
        method: monitor.method,
        expectedStatus: monitor.expectedStatus,
        timeoutMs: monitor.timeoutMs,
        ...(options?.fetcher ? { fetcher: options.fetcher } : {}),
      });

  const heartbeat: HeartbeatRecord = {
    id: `hb-${randomUUID().slice(0, 8)}`,
    monitorId,
    status: probe.status,
    httpStatus: probe.httpStatus,
    latencyMs: probe.latencyMs,
    errorMessage: probe.errorMessage,
    checkedAt,
  };

  await db.insert(heartbeats).values(heartbeat);

  const transition = await evaluateIncidentTransition({
    monitor,
    previousStatusesDesc: previousRows.map((r) => r.status as HeartbeatStatus),
    openIncident: openIncidentRow ? toIncidentRecord(openIncidentRow) : null,
    newStatus: heartbeat.status,
    cause: heartbeat.errorMessage,
    checkedAt,
    sendWebhook: options?.sendWebhook ?? true,
  });

  if (transition.action === "opened" && transition.incident) {
    await db.insert(incidents).values(transition.incident);
  } else if (transition.action === "resolved" && transition.incident) {
    await db
      .update(incidents)
      .set({ status: "resolved", resolvedAt: transition.incident.resolvedAt })
      .where(eq(incidents.id, transition.incident.id));
  }

  return { monitor, heartbeat, transition };
}

export async function probeAllActiveMonitors(db: PingPulseDb, concurrency = 5) {
  const active = await db
    .select()
    .from(monitors)
    .where(eq(monitors.isActive, true));
  const tasks = active.map((m) => () => probeMonitorById(db, m.id));
  return runWithConcurrency(tasks, concurrency);
}

export async function getPublicStatusBySlug(
  db: PingPulseDb,
  slug: string,
): Promise<PublicStatusResponse | null> {
  const isAggregateSlug =
    slug === "public" || slug === "core" || slug === "ecosystem";
  const targetMonitors = isAggregateSlug
    ? await db.select().from(monitors).where(eq(monitors.isPublic, true))
    : await db
        .select()
        .from(monitors)
        .where(and(eq(monitors.slug, slug), eq(monitors.isPublic, true)));

  const firstMonitor = targetMonitors[0];
  if (!firstMonitor) return null;

  const cutoff30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const allHeartbeats = await db
    .select()
    .from(heartbeats)
    .where(gte(heartbeats.checkedAt, cutoff30d))
    .orderBy(desc(heartbeats.checkedAt));
  const allIncidents = await db
    .select()
    .from(incidents)
    .orderBy(desc(incidents.startedAt));

  const monitorIds = new Set(targetMonitors.map((m) => m.id));
  const nameById = new Map(targetMonitors.map((m) => [m.id, m.name]));

  const services: StatusServiceItem[] = targetMonitors.map((m) => {
    const mHeartbeats = allHeartbeats
      .filter((h) => h.monitorId === m.id)
      .map(toHeartbeatRecord);
    const hasOpen = allIncidents.some(
      (i) => i.monitorId === m.id && i.status === "open",
    );
    const latest = mHeartbeats[0];
    const m30d = buildWindowMetrics(mHeartbeats, "30d");
    const m24h = buildWindowMetrics(mHeartbeats, "24h");

    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      url: m.url,
      currentStatus: hasOpen ? "down" : (latest?.status ?? "up"),
      uptime30d: m30d.uptimePercent,
      p95_24h: m24h.p95Ms,
      dailyBuckets: buildDailyBuckets(mHeartbeats, 30),
    };
  });

  const hasOutage = services.some((s) => s.currentStatus === "down");
  const hasDegraded = services.some((s) => s.currentStatus === "degraded");
  const overallStatus = hasOutage
    ? "outage"
    : hasDegraded
      ? "degraded"
      : "operational";

  return {
    slug,
    title: isAggregateSlug
      ? "Acme Cloud — Estado de Servicios"
      : `${firstMonitor.name} — Status Page`,
    overallStatus,
    services,
    incidents: allIncidents
      .filter((i) => monitorIds.has(i.monitorId))
      .slice(0, 15)
      .map((i) => ({
        ...toIncidentRecord(i),
        monitorName: nameById.get(i.monitorId) ?? i.monitorId,
      })),
    generatedAt: new Date().toISOString(),
  };
}
