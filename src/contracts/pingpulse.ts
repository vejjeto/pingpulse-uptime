import { z } from "zod";

export const HttpMethodSchema = z.enum(["GET", "HEAD", "POST"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const TimeWindowSchema = z.enum(["24h", "7d", "30d"]);
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export const HeartbeatStatusSchema = z.enum(["up", "degraded", "down"]);
export type HeartbeatStatus = z.infer<typeof HeartbeatStatusSchema>;

export const IncidentStatusSchema = z.enum(["open", "resolved"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const CreateMonitorSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones")
    .optional(),
  url: z.string().trim().url().max(500),
  method: HttpMethodSchema.default("GET"),
  expectedStatus: z.coerce.number().int().min(100).max(599).default(200),
  intervalSeconds: z.coerce.number().int().min(10).max(3600).default(60),
  timeoutMs: z.coerce.number().int().min(500).max(15000).default(5000),
  webhookUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  isPublic: z.boolean().default(true),
});

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>;

export const ProbeUrlSchema = z.object({
  url: z.string().trim().min(1).max(500),
  method: HttpMethodSchema.default("GET"),
  expectedStatus: z.coerce.number().int().min(100).max(599).default(200),
  timeoutMs: z.coerce.number().int().min(500).max(15000).default(4000),
});

export type ProbeUrlInput = z.infer<typeof ProbeUrlSchema>;

export const ProbeMonitorSchema = z.object({
  simulateFailure: z.boolean().optional().default(false),
});

export type ProbeMonitorInput = z.infer<typeof ProbeMonitorSchema>;

export interface MonitorRecord {
  id: string;
  slug: string;
  name: string;
  url: string;
  method: string;
  expectedStatus: number;
  intervalSeconds: number;
  timeoutMs: number;
  webhookUrl: string | null;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
}

export interface HeartbeatRecord {
  id: string;
  monitorId: string;
  status: HeartbeatStatus;
  httpStatus: number | null;
  latencyMs: number;
  errorMessage: string | null;
  checkedAt: string;
}

export interface IncidentRecord {
  id: string;
  monitorId: string;
  status: IncidentStatus;
  cause: string;
  startedAt: string;
  resolvedAt: string | null;
}

export interface WindowMetrics {
  window: TimeWindow;
  uptimePercent: number;
  checksTotal: number;
  checksOk: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface DailyBucket {
  date: string;
  status: HeartbeatStatus | "empty";
  uptimePercent: number;
  avgLatencyMs: number;
  checksTotal: number;
  checksOk: number;
}

export interface TelemetryResponse {
  monitor: MonitorRecord;
  activeWindow: TimeWindow;
  windows: Record<TimeWindow, WindowMetrics>;
  dailyBuckets: DailyBucket[];
  series: HeartbeatRecord[];
  incidents: IncidentRecord[];
}

export interface MonitorSummary extends MonitorRecord {
  currentStatus: HeartbeatStatus;
  lastLatencyMs: number | null;
  lastCheckedAt: string | null;
  uptime24h: number;
  p95_24h: number;
  openIncident: IncidentRecord | null;
  consecutiveFailures: number;
}

export interface WebhookDispatchPreview {
  event: "monitor.incident_opened" | "monitor.incident_resolved";
  targetUrl: string;
  headerName: "X-PingPulse-Signature";
  signature: string;
  sent: boolean;
  statusCode?: number;
  error?: string;
}

export interface StatusServiceItem {
  id: string;
  slug: string;
  name: string;
  url: string;
  currentStatus: HeartbeatStatus;
  uptime30d: number;
  p95_24h: number;
  dailyBuckets: DailyBucket[];
}

export interface PublicStatusResponse {
  slug: string;
  title: string;
  overallStatus: "operational" | "degraded" | "outage";
  services: StatusServiceItem[];
  incidents: Array<IncidentRecord & { monitorName: string }>;
  generatedAt: string;
}
