import { randomUUID } from "node:crypto";
import type {
  HeartbeatStatus,
  IncidentRecord,
  MonitorRecord,
  WebhookDispatchPreview,
} from "@/contracts/pingpulse";
import { getEnv } from "@/lib/env";
import { emitSignedWebhook, signHmacSha256 } from "@/lib/webhooks";

export interface IncidentTransitionInput {
  monitor: MonitorRecord;
  previousStatusesDesc: HeartbeatStatus[];
  openIncident: IncidentRecord | null;
  newStatus: HeartbeatStatus;
  cause: string | null;
  checkedAt: string;
  sendWebhook?: boolean;
}

export interface IncidentTransitionResult {
  action: "none" | "opened" | "resolved";
  incident: IncidentRecord | null;
  consecutiveFailures: number;
  webhook: WebhookDispatchPreview | null;
}

function countLeadingFailures(statuses: readonly HeartbeatStatus[]): number {
  let count = 0;
  for (const status of statuses) {
    if (status !== "down") break;
    count += 1;
  }
  return count;
}

async function dispatchIncidentWebhook(options: {
  monitor: MonitorRecord;
  incident: IncidentRecord;
  event: "monitor.incident_opened" | "monitor.incident_resolved";
  sendWebhook: boolean;
}): Promise<WebhookDispatchPreview> {
  const targetUrl =
    options.monitor.webhookUrl?.trim() || "unconfigured://webhook-preview";
  const secret = getEnv().WEBHOOK_SECRET;
  const data = {
    monitorId: options.monitor.id,
    monitorSlug: options.monitor.slug,
    monitorName: options.monitor.name,
    url: options.monitor.url,
    incidentId: options.incident.id,
    incidentStatus: options.incident.status,
    cause: options.incident.cause,
    startedAt: options.incident.startedAt,
    resolvedAt: options.incident.resolvedAt,
  };

  if (!options.sendWebhook || !options.monitor.webhookUrl?.trim()) {
    const previewBody = JSON.stringify({
      event: options.event,
      source: "pingpulse",
      data,
    });
    return {
      event: options.event,
      targetUrl,
      headerName: "X-PingPulse-Signature",
      signature: signHmacSha256(previewBody, secret),
      sent: false,
    };
  }

  const delivered = await emitSignedWebhook({
    targetUrl,
    secret,
    event: options.event,
    source: "pingpulse",
    signatureHeaderName: "X-PingPulse-Signature",
    data,
  });

  return {
    event: options.event,
    targetUrl,
    headerName: "X-PingPulse-Signature",
    signature: delivered.signature,
    sent: delivered.sent,
    ...(delivered.statusCode !== undefined
      ? { statusCode: delivered.statusCode }
      : {}),
    ...(delivered.error !== undefined ? { error: delivered.error } : {}),
  };
}

/**
 * Transitions monitor incident state:
 * - UP -> DOWN only after 2 consecutive failures
 * - DOWN -> UP automatically when an open incident recovers
 */
export async function evaluateIncidentTransition(
  input: IncidentTransitionInput,
): Promise<IncidentTransitionResult> {
  const sendWebhook = input.sendWebhook ?? true;

  if (input.newStatus === "down") {
    const consecutiveFailures =
      1 + countLeadingFailures(input.previousStatusesDesc);
    if (!input.openIncident && consecutiveFailures >= 2) {
      const incident: IncidentRecord = {
        id: `inc-${randomUUID().slice(0, 8)}`,
        monitorId: input.monitor.id,
        status: "open",
        cause: input.cause ?? "2 fallos consecutivos detectados",
        startedAt: input.checkedAt,
        resolvedAt: null,
      };
      const webhook = await dispatchIncidentWebhook({
        monitor: input.monitor,
        incident,
        event: "monitor.incident_opened",
        sendWebhook,
      });
      return { action: "opened", incident, consecutiveFailures, webhook };
    }
    return {
      action: "none",
      incident: input.openIncident,
      consecutiveFailures,
      webhook: null,
    };
  }

  if (input.openIncident) {
    const resolved: IncidentRecord = {
      ...input.openIncident,
      status: "resolved",
      resolvedAt: input.checkedAt,
    };
    const webhook = await dispatchIncidentWebhook({
      monitor: input.monitor,
      incident: resolved,
      event: "monitor.incident_resolved",
      sendWebhook,
    });
    return {
      action: "resolved",
      incident: resolved,
      consecutiveFailures: 0,
      webhook,
    };
  }

  return {
    action: "none",
    incident: null,
    consecutiveFailures: 0,
    webhook: null,
  };
}
