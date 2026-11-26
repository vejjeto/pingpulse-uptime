"use client";

import * as React from "react";

export type Locale = "es" | "en";

export const LOCALE_STORAGE_KEY = "pingpulse-lang";
export const LOCALE_CHANGE_EVENT = "pingpulse-lang-change";

export interface TranslationDict {
  headerSubtitle: string;
  publicStatusPage: string;
  demo: string;
  apiDocs: string;
  newMonitor: string;
  activeMonitors: string;
  avgUptime24h: string;
  globalP95Latency: string;
  openIncidents: string;
  monitoredServices: string;
  workerConcurrency: string;
  activeIncidentPrefix: string;
  probeNow: string;
  simulateOutage: string;
  deleteMonitorAria: string;
  windowLabel24h: string;
  windowLabel7d: string;
  windowLabel30d: string;
  latencySeriesTitle: string;
  updating: string;
  dailyAvailabilityTitle: string;
  copyBadgeMarkdown: string;
  badgeCopiedTitle: string;
  incidentHistory: string;
  noIncidents: string;
  incidentOpen: string;
  incidentResolved: string;
  incidentStart: string;
  incidentEnd: string;
  selectOrCreateMonitor: string;
  probeUrlTitle: string;
  probeUrlSubtitle: string;
  probeUrlPlaceholder: string;
  probeUrlAria: string;
  probeUrlButton: string;
  probeUrlCompleted: string;
  probeUrlBlocked: string;
  probeUrlNetworkError: string;
  probeUrlResolvedIp: string;
  probeUrlRemainingDays: string;
  statusOperational: string;
  statusDegraded: string;
  statusOutage: string;
  backToDashboard: string;
  statusUpdated: string;
  statusServices: string;
  statusIncidentTimeline: string;
  statusNoRecentIncidents: string;
}

export const TRANSLATIONS: Record<Locale, TranslationDict> = {
  es: {
    headerSubtitle: "Uptime, Percentiles P50/P95/P99 & Guard anti-SSRF",
    publicStatusPage: "Status Page Pública",
    demo: "Demo",
    apiDocs: "API Docs",
    newMonitor: "Nuevo Monitor",
    activeMonitors: "Monitores Activos",
    avgUptime24h: "Uptime Promedio (24h)",
    globalP95Latency: "Latencia P95 Global",
    openIncidents: "Incidentes Abiertos",
    monitoredServices: "Servicios Monitoreados",
    workerConcurrency: "Worker máx. 5 concurrentes",
    activeIncidentPrefix: "Incidente activo:",
    probeNow: "Sondear ahora",
    simulateOutage: "Simular caída e incidente",
    deleteMonitorAria: "Eliminar monitor",
    windowLabel24h: "24h",
    windowLabel7d: "7d",
    windowLabel30d: "30d",
    latencySeriesTitle: "Serie temporal de latencia",
    updating: "Actualizando...",
    dailyAvailabilityTitle: "Disponibilidad Diaria (Últimos 30 días)",
    copyBadgeMarkdown: "Copiar Badge Markdown",
    badgeCopiedTitle: "Snippet Markdown copiado",
    incidentHistory: "Historial de Incidentes",
    noIncidents: "Sin incidentes registrados en este servicio.",
    incidentOpen: "Abierto",
    incidentResolved: "Resuelto",
    incidentStart: "Inicio:",
    incidentEnd: "Fin:",
    selectOrCreateMonitor:
      "Selecciona o crea un monitor para inspeccionar telemetría.",
    probeUrlTitle: "Probar URL ahora (Diagnóstico instantáneo)",
    probeUrlSubtitle:
      "Ejecuta validación DNS anti-SSRF, inspección de redirecciones y certificado TLS.",
    probeUrlPlaceholder: "https://api.ejemplo.com/health",
    probeUrlAria: "URL a diagnosticar",
    probeUrlButton: "Probar URL ahora",
    probeUrlCompleted: "Sondeo completado",
    probeUrlBlocked: "Bloqueado por guard anti-SSRF",
    probeUrlNetworkError: "Error de red al sondear",
    probeUrlResolvedIp: "IP resuelta:",
    probeUrlRemainingDays: "d restantes",
    statusOperational: "Todos los sistemas operativos",
    statusDegraded: "Degradación parcial detectada",
    statusOutage: "Interrupción activa en servicios",
    backToDashboard: "Volver al Dashboard",
    statusUpdated: "Actualizado:",
    statusServices: "Servicios",
    statusIncidentTimeline: "Línea de Tiempo de Incidentes",
    statusNoRecentIncidents: "Sin incidentes recientes reportados.",
  },
  en: {
    headerSubtitle: "Uptime, P50/P95/P99 Percentiles & Anti-SSRF Guard",
    publicStatusPage: "Public Status Page",
    demo: "Demo",
    apiDocs: "API Docs",
    newMonitor: "New Monitor",
    activeMonitors: "Active Monitors",
    avgUptime24h: "Avg Uptime (24h)",
    globalP95Latency: "Global P95 Latency",
    openIncidents: "Open Incidents",
    monitoredServices: "Monitored Services",
    workerConcurrency: "Worker max 5 concurrent",
    activeIncidentPrefix: "Active incident:",
    probeNow: "Probe now",
    simulateOutage: "Simulate outage & incident",
    deleteMonitorAria: "Delete monitor",
    windowLabel24h: "24h",
    windowLabel7d: "7d",
    windowLabel30d: "30d",
    latencySeriesTitle: "Latency time series",
    updating: "Updating...",
    dailyAvailabilityTitle: "Daily Availability (Last 30 days)",
    copyBadgeMarkdown: "Copy Markdown Badge",
    badgeCopiedTitle: "Markdown snippet copied",
    incidentHistory: "Incident History",
    noIncidents: "No incidents recorded for this service.",
    incidentOpen: "Open",
    incidentResolved: "Resolved",
    incidentStart: "Start:",
    incidentEnd: "End:",
    selectOrCreateMonitor: "Select or create a monitor to inspect telemetry.",
    probeUrlTitle: "Probe URL now (Instant diagnostics)",
    probeUrlSubtitle:
      "Runs DNS anti-SSRF validation, redirect inspection, and TLS certificate check.",
    probeUrlPlaceholder: "https://api.example.com/health",
    probeUrlAria: "URL to diagnose",
    probeUrlButton: "Probe URL now",
    probeUrlCompleted: "Probe completed",
    probeUrlBlocked: "Blocked by anti-SSRF guard",
    probeUrlNetworkError: "Network error while probing",
    probeUrlResolvedIp: "Resolved IP:",
    probeUrlRemainingDays: "d remaining",
    statusOperational: "All systems operational",
    statusDegraded: "Partial degradation detected",
    statusOutage: "Active service outage",
    backToDashboard: "Back to Dashboard",
    statusUpdated: "Updated:",
    statusServices: "Services",
    statusIncidentTimeline: "Incident Timeline",
    statusNoRecentIncidents: "No recent incidents reported.",
  },
};

function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function useLocale() {
  const [locale, setLocaleState] = React.useState<Locale>("es");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(saved)) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      // Ignore storage access restriction
    }

    const onLocaleChange = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isLocale(detail)) {
        setLocaleState(detail);
        document.documentElement.lang = detail;
      }
    };

    window.addEventListener(LOCALE_CHANGE_EVENT, onLocaleChange);
    return () => {
      window.removeEventListener(LOCALE_CHANGE_EVENT, onLocaleChange);
    };
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage access restriction
    }
    window.dispatchEvent(
      new CustomEvent<Locale>(LOCALE_CHANGE_EVENT, { detail: next }),
    );
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "es" ? "en" : "es");
  }, [locale, setLocale]);

  return {
    locale,
    setLocale,
    toggleLocale,
    t: TRANSLATIONS[locale],
  };
}
