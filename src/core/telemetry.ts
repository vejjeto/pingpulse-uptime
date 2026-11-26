import type {
  DailyBucket,
  HeartbeatRecord,
  IncidentRecord,
  MonitorRecord,
  TelemetryResponse,
  TimeWindow,
  WindowMetrics,
} from "@/contracts/pingpulse";

const WINDOW_HOURS: Record<TimeWindow, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

/**
 * Computes linear-interpolated percentile (e.g. 50, 95, 99) over numeric latency samples.
 */
export function computePercentile(
  values: readonly number[],
  percentile: number,
): number {
  if (values.length === 0) return 0;
  const clamped = Math.min(100, Math.max(0, percentile));
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return Number((sorted[0] ?? 0).toFixed(2));

  const index = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerVal = sorted[lower] ?? 0;
  const upperVal = sorted[upper] ?? 0;
  if (lower === upper) return Number(lowerVal.toFixed(2));

  const weight = index - lower;
  const interpolated = lowerVal * (1 - weight) + upperVal * weight;
  return Number(interpolated.toFixed(2));
}

export function computeUptimePercent(
  checksOk: number,
  checksTotal: number,
): number {
  if (checksTotal <= 0) return 100;
  return Number(((checksOk / checksTotal) * 100).toFixed(2));
}

export function buildWindowMetrics(
  heartbeats: readonly HeartbeatRecord[],
  window: TimeWindow,
  nowMs = Date.now(),
): WindowMetrics {
  const cutoffMs = nowMs - WINDOW_HOURS[window] * 3600 * 1000;
  const filtered = heartbeats.filter(
    (h) => Date.parse(h.checkedAt) >= cutoffMs,
  );
  const checksTotal = filtered.length;
  const checksOk = filtered.filter((h) => h.status !== "down").length;
  const latencies = filtered.map((h) => h.latencyMs);
  const avgLatencyMs =
    latencies.length === 0
      ? 0
      : Number(
          (latencies.reduce((sum, v) => sum + v, 0) / latencies.length).toFixed(
            1,
          ),
        );

  return {
    window,
    uptimePercent: computeUptimePercent(checksOk, checksTotal),
    checksTotal,
    checksOk,
    avgLatencyMs,
    p50Ms: computePercentile(latencies, 50),
    p95Ms: computePercentile(latencies, 95),
    p99Ms: computePercentile(latencies, 99),
  };
}

function classifyDayStatus(
  checksTotal: number,
  checksOk: number,
  hasDegraded: boolean,
): DailyBucket["status"] {
  if (checksTotal === 0) return "empty";
  if (checksOk === 0) return "down";
  if (checksOk < checksTotal || hasDegraded) return "degraded";
  return "up";
}

export function buildDailyBuckets(
  heartbeats: readonly HeartbeatRecord[],
  days = 30,
  nowMs = Date.now(),
): DailyBucket[] {
  const byDate = new Map<string, HeartbeatRecord[]>();
  for (const hb of heartbeats) {
    const key = hb.checkedAt.slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(hb);
    byDate.set(key, list);
  }

  const buckets: DailyBucket[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(nowMs - offset * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const items = byDate.get(date) ?? [];
    const checksTotal = items.length;
    const checksOk = items.filter((i) => i.status !== "down").length;
    const hasDegraded = items.some((i) => i.status === "degraded");
    const avgLatencyMs =
      checksTotal === 0
        ? 0
        : Math.round(
            items.reduce((sum, i) => sum + i.latencyMs, 0) / checksTotal,
          );

    buckets.push({
      date,
      status: classifyDayStatus(checksTotal, checksOk, hasDegraded),
      uptimePercent: computeUptimePercent(checksOk, checksTotal),
      avgLatencyMs,
      checksTotal,
      checksOk,
    });
  }

  return buckets;
}

export function buildTelemetrySummary(options: {
  monitor: MonitorRecord;
  heartbeats: readonly HeartbeatRecord[];
  incidents: readonly IncidentRecord[];
  activeWindow: TimeWindow;
  nowMs?: number;
}): TelemetryResponse {
  const nowMs = options.nowMs ?? Date.now();
  const sortedAsc = [...options.heartbeats].sort(
    (a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt),
  );
  const cutoffMs = nowMs - WINDOW_HOURS[options.activeWindow] * 3600 * 1000;
  const series = sortedAsc.filter((h) => Date.parse(h.checkedAt) >= cutoffMs);

  return {
    monitor: options.monitor,
    activeWindow: options.activeWindow,
    windows: {
      "24h": buildWindowMetrics(sortedAsc, "24h", nowMs),
      "7d": buildWindowMetrics(sortedAsc, "7d", nowMs),
      "30d": buildWindowMetrics(sortedAsc, "30d", nowMs),
    },
    dailyBuckets: buildDailyBuckets(sortedAsc, 30, nowMs),
    series,
    incidents: [...options.incidents].sort(
      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    ),
  };
}
