import type { TimeWindow, WindowMetrics } from "@/contracts/pingpulse";
import { sql } from "drizzle-orm";

export interface PgSqlExecutor {
  execute<T = Record<string, unknown>>(
    query: ReturnType<typeof sql>,
  ): Promise<{ rows: T[] }>;
}

const WINDOW_INTERVAL_SQL: Record<TimeWindow, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

export interface PgTelemetryMetricsRow {
  checks_total: string | number;
  checks_ok: string | number;
  avg_latency_ms: string | number | null;
  p50_ms: string | number | null;
  p95_ms: string | number | null;
  p99_ms: string | number | null;
}

/**
 * Builds a parameterized PostgreSQL query using PERCENTILE_CONT(0.50/0.95/0.99)
 * for exact parity with local SQLite telemetry math.
 */
export function buildPgWindowMetricsQuery(
  monitorId: string,
  window: TimeWindow,
) {
  const interval = WINDOW_INTERVAL_SQL[window];
  return sql`
    SELECT
      COUNT(*)::int AS checks_total,
      COUNT(*) FILTER (WHERE status <> 'down')::int AS checks_ok,
      ROUND(COALESCE(AVG(latency_ms), 0)::numeric, 1) AS avg_latency_ms,
      ROUND(COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::numeric, 2) AS p50_ms,
      ROUND(COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::numeric, 2) AS p95_ms,
      ROUND(COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::numeric, 2) AS p99_ms
    FROM heartbeats
    WHERE monitor_id = ${monitorId}
      AND checked_at >= NOW() - (${interval})::interval
  `;
}

export async function getPgWindowMetrics(
  pgDb: PgSqlExecutor,
  monitorId: string,
  window: TimeWindow,
): Promise<WindowMetrics> {
  const query = buildPgWindowMetricsQuery(monitorId, window);
  const result = await pgDb.execute<PgTelemetryMetricsRow>(query);
  const row = result.rows[0];
  const checksTotal = Number(row?.checks_total ?? 0);
  const checksOk = Number(row?.checks_ok ?? 0);
  const uptimePercent =
    checksTotal <= 0
      ? 100
      : Number(((checksOk / checksTotal) * 100).toFixed(2));

  return {
    window,
    uptimePercent,
    checksTotal,
    checksOk,
    avgLatencyMs: Number(row?.avg_latency_ms ?? 0),
    p50Ms: Number(row?.p50_ms ?? 0),
    p95Ms: Number(row?.p95_ms ?? 0),
    p99Ms: Number(row?.p99_ms ?? 0),
  };
}
