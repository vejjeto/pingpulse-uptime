"use client";

import { UiButton } from "@/components/ui/button";
import { HealthBadge } from "@/components/ui/health-badge";
import { useUiToast } from "@/components/ui/toast";
import type {
  HeartbeatRecord,
  MonitorSummary,
  TelemetryResponse,
  TimeWindow,
  WebhookDispatchPreview,
} from "@/contracts/pingpulse";
import type { TlsCertInfo } from "@/core/tls-inspector";
import { useDashboardStore } from "@/store/dashboard-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { CreateMonitorModal } from "./create-monitor-modal";
import { LatencyChart } from "./latency-chart";
import { ProbeUrlPanel } from "./probe-url-panel";
import { ThemeToggle } from "./theme-toggle";
import { UptimeBars } from "./uptime-bars";

interface DashboardClientProps {
  initialMonitors: MonitorSummary[];
  initialTelemetry: TelemetryResponse | null;
}

const STATUS_BADGE: Record<MonitorSummary["currentStatus"], string> = {
  up: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  degraded: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  down: "border-rose-500/30 bg-rose-500/10 text-rose-400",
};

const WINDOWS: readonly TimeWindow[] = ["24h", "7d", "30d"];

export function DashboardClient({
  initialMonitors,
  initialTelemetry,
}: DashboardClientProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useUiToast();
  const {
    selectedMonitorId,
    timeWindow,
    createModalOpen,
    lastWebhookPreview,
    setSelectedMonitorId,
    setTimeWindow,
    setCreateModalOpen,
    setLastWebhookPreview,
  } = useDashboardStore();

  const { data: monitors = initialMonitors } = useQuery<MonitorSummary[]>({
    queryKey: ["monitors"],
    queryFn: async () => {
      const res = await fetch("/api/monitors");
      const json = (await res.json()) as { monitors: MonitorSummary[] };
      return json.monitors;
    },
    initialData: initialMonitors,
  });

  const activeId = selectedMonitorId ?? monitors[0]?.id ?? null;

  const { data: telemetry, isFetching: telemetryLoading } =
    useQuery<TelemetryResponse | null>({
      queryKey: ["telemetry", activeId, timeWindow],
      enabled: Boolean(activeId),
      queryFn: async () => {
        if (!activeId) return null;
        const res = await fetch(
          `/api/monitors/${activeId}/telemetry?window=${timeWindow}`,
        );
        if (!res.ok) return null;
        return (await res.json()) as TelemetryResponse;
      },
      ...(activeId &&
      initialTelemetry?.monitor.id === activeId &&
      timeWindow === "24h"
        ? { initialData: initialTelemetry }
        : {}),
    });

  const { data: tlsData } = useQuery<{ tls: TlsCertInfo } | null>({
    queryKey: ["tls", activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      if (!activeId) return null;
      const res = await fetch(`/api/monitors/${activeId}/tls`);
      if (!res.ok) return null;
      return (await res.json()) as { tls: TlsCertInfo };
    },
  });

  const probeMutation = useMutation({
    mutationFn: async (vars: { id: string; simulateFailure: boolean }) => {
      const res = await fetch(`/api/monitors/${vars.id}/probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulateFailure: vars.simulateFailure }),
      });
      return (await res.json()) as {
        heartbeat: HeartbeatRecord;
        transition: {
          action: "none" | "opened" | "resolved";
          consecutiveFailures: number;
          webhook: WebhookDispatchPreview | null;
        };
      };
    },
    onSuccess: (data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["monitors"] });
      void queryClient.invalidateQueries({ queryKey: ["telemetry", vars.id] });

      if (data.transition.webhook) {
        setLastWebhookPreview(data.transition.webhook);
      }

      if (data.transition.action === "opened") {
        pushToast({
          title: "Incidente abierto (2 fallos consecutivos)",
          description:
            "Transición UP → DOWN y firma HMAC X-PingPulse-Signature generada.",
          variant: "error",
        });
      } else if (data.transition.action === "resolved") {
        pushToast({
          title: "Incidente resuelto automáticamente",
          description:
            "Transición DOWN → UP y webhook de recuperación emitido.",
          variant: "success",
        });
      } else if (vars.simulateFailure) {
        pushToast({
          title: "Fallo #1 registrado (pendiente 2º fallo)",
          description:
            "Simula otra caída para disparar la máquina de estados UP → DOWN.",
          variant: "info",
        });
      } else {
        pushToast({
          title: `Sondeo ${data.heartbeat.status.toUpperCase()}`,
          description: `Latencia: ${data.heartbeat.latencyMs}ms · HTTP ${data.heartbeat.httpStatus ?? "ERR"}`,
          variant: data.heartbeat.status === "down" ? "error" : "success",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/monitors/${id}`, { method: "DELETE" });
    },
    onSuccess: (_data, id) => {
      if (selectedMonitorId === id) {
        setSelectedMonitorId(monitors.find((m) => m.id !== id)?.id ?? "");
      }
      void queryClient.invalidateQueries({ queryKey: ["monitors"] });
      pushToast({ title: "Monitor eliminado", variant: "info" });
    },
  });

  const openIncidentsCount = monitors.filter(
    (m) => m.openIncident !== null,
  ).length;
  const avgUptime =
    monitors.length === 0
      ? 100
      : Number(
          (
            monitors.reduce((sum, m) => sum + m.uptime24h, 0) / monitors.length
          ).toFixed(2),
        );
  const avgP95 =
    monitors.length === 0
      ? 0
      : Math.round(
          monitors.reduce((sum, m) => sum + m.p95_24h, 0) / monitors.length,
        );

  const selectedMonitor = monitors.find((m) => m.id === activeId) ?? null;
  const activeMetrics = telemetry?.windows[timeWindow];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-[#09090b]/85">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">
                  PingPulse
                </h1>
                <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-400">
                  PORT 3007
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Uptime, Percentiles P50/P95/P99 & Guard anti-SSRF
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HealthBadge endpoint="/api/health" />
            <Link
              href="/status/public"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
              Status Page Pública
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Demo
            </Link>
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              API Docs
            </a>
            <ThemeToggle />
            <UiButton size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nuevo Monitor
            </UiButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Monitores Activos
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {monitors.length}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Uptime Promedio (24h)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-500">
              {avgUptime}%
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Latencia P95 Global
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-400">
              {avgP95} ms
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Incidentes Abiertos
            </p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                openIncidentsCount > 0 ? "text-rose-500" : "text-emerald-500"
              }`}
            >
              {openIncidentsCount}
            </p>
          </div>
        </div>

        <ProbeUrlPanel />

        {lastWebhookPreview && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                <Shield className="h-4 w-4" />
                Webhook HMAC-SHA256 Emitido ({lastWebhookPreview.event})
              </div>
              <button
                type="button"
                onClick={() => setLastWebhookPreview(null)}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Ocultar
              </button>
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
              Destino: {lastWebhookPreview.targetUrl} ·{" "}
              {lastWebhookPreview.sent
                ? `Entregado (HTTP ${lastWebhookPreview.statusCode})`
                : `Firmado offline (${lastWebhookPreview.error ?? "receptor no activo"})`}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-emerald-500">
              {lastWebhookPreview.headerName}: {lastWebhookPreview.signature}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="space-y-3 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Servicios Monitoreados</h2>
              <span className="text-[11px] text-zinc-500">
                Worker máx. 5 concurrentes
              </span>
            </div>

            {monitors.map((m) => {
              const isSelected = m.id === activeId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMonitorId(m.id)}
                  className={`w-full text-left cursor-pointer rounded-xl border p-3.5 transition ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#111114] dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{m.name}</p>
                      <p className="truncate font-mono text-[11px] text-zinc-500">
                        {m.url}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[m.currentStatus]}`}
                    >
                      {m.currentStatus}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Uptime 24h: {m.uptime24h}%</span>
                    <span className="font-mono">P95: {m.p95_24h}ms</span>
                  </div>

                  {m.openIncident && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        Incidente activo: {m.openIncident.cause}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </aside>

          <section className="space-y-4 lg:col-span-8">
            {selectedMonitor && telemetry && activeMetrics ? (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111114]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold">
                          {selectedMonitor.name}
                        </h2>
                        <Link
                          href={`/status/${selectedMonitor.slug}`}
                          className="text-xs text-indigo-400 hover:underline"
                        >
                          /status/{selectedMonitor.slug}
                        </Link>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">
                        {selectedMonitor.url}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <UiButton
                        size="sm"
                        variant="secondary"
                        loading={probeMutation.isPending}
                        onClick={() =>
                          probeMutation.mutate({
                            id: selectedMonitor.id,
                            simulateFailure: false,
                          })
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Sondear ahora
                      </UiButton>
                      <UiButton
                        size="sm"
                        variant="danger"
                        loading={probeMutation.isPending}
                        onClick={() =>
                          probeMutation.mutate({
                            id: selectedMonitor.id,
                            simulateFailure: true,
                          })
                        }
                      >
                        <Flame className="h-3.5 w-3.5" />
                        Simular caída e incidente
                      </UiButton>
                      <UiButton
                        size="icon"
                        variant="ghost"
                        aria-label="Eliminar monitor"
                        onClick={() =>
                          deleteMutation.mutate(selectedMonitor.id)
                        }
                      >
                        <Trash2 className="h-4 w-4 text-zinc-400 hover:text-rose-500" />
                      </UiButton>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs dark:bg-zinc-900">
                        Uptime: <strong>{activeMetrics.uptimePercent}%</strong>
                      </span>
                      <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs dark:bg-zinc-900">
                        P50: <strong>{activeMetrics.p50Ms}ms</strong>
                      </span>
                      <span className="rounded-md bg-indigo-500/10 px-2.5 py-1 font-mono text-xs text-indigo-400">
                        P95: <strong>{activeMetrics.p95Ms}ms</strong>
                      </span>
                      <span className="rounded-md bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-400">
                        P99: <strong>{activeMetrics.p99Ms}ms</strong>
                      </span>
                      {tlsData?.tls && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs dark:bg-zinc-900">
                          <Lock className="h-3 w-3 text-emerald-400" />
                          TLS: <strong>{tlsData.tls.status}</strong>
                          {tlsData.tls.daysRemaining !== null
                            ? ` (${tlsData.tls.daysRemaining}d)`
                            : ""}
                        </span>
                      )}
                    </div>

                    <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
                      {WINDOWS.map((win) => (
                        <button
                          key={win}
                          type="button"
                          onClick={() => setTimeWindow(win)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                            timeWindow === win
                              ? "bg-indigo-600 text-white"
                              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                          }`}
                        >
                          {win}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-indigo-400" />
                        Serie temporal de latencia ({timeWindow})
                      </span>
                      {telemetryLoading && <span>Actualizando...</span>}
                    </div>
                    <LatencyChart series={telemetry.series} />
                  </div>

                  <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Disponibilidad Diaria (Últimos 30 días)
                    </h3>
                    <UptimeBars buckets={telemetry.dailyBuckets} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <img
                        src={`/api/badge/${selectedMonitor.id}.svg`}
                        alt={`Uptime badge for ${selectedMonitor.name}`}
                        height={20}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const snippet = `![Uptime](${window.location.origin}/api/badge/${selectedMonitor.id}.svg)`;
                        void navigator.clipboard?.writeText(snippet);
                        pushToast({
                          title: "Snippet Markdown copiado",
                          description: snippet,
                          variant: "info",
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1 font-mono text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar Badge Markdown
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111114]">
                  <h3 className="text-sm font-semibold">
                    Historial de Incidentes
                  </h3>
                  {telemetry.incidents.length === 0 ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                      Sin incidentes registrados en este servicio.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {telemetry.incidents.map((inc) => (
                        <div
                          key={inc.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
                        >
                          <div>
                            <span
                              className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                inc.status === "open"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                              }`}
                            >
                              {inc.status === "open" ? "Abierto" : "Resuelto"}
                            </span>
                            <span className="font-medium">{inc.cause}</span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-500">
                            Inicio:{" "}
                            {new Date(inc.startedAt).toLocaleString("es-ES")}
                            {inc.resolvedAt
                              ? ` · Fin: ${new Date(inc.resolvedAt).toLocaleString("es-ES")}`
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
                Selecciona o crea un monitor para inspeccionar telemetría.
              </div>
            )}
          </section>
        </div>
      </main>

      <CreateMonitorModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreated={(id) => {
          setSelectedMonitorId(id);
          void queryClient.invalidateQueries({ queryKey: ["monitors"] });
        }}
      />
    </div>
  );
}
