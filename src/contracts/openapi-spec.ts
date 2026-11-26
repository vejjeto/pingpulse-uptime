import { buildOpenApiSpec } from "@/lib/openapi";
import {
  CreateMonitorSchema,
  ProbeMonitorSchema,
  ProbeUrlSchema,
} from "./pingpulse";

export function getPingPulseOpenApiSpec() {
  return buildOpenApiSpec({
    title: "PingPulse API",
    version: "2.0.0",
    description:
      "Monitor de Uptime HTTP, latencia P50/P95/P99, guard anti-SSRF con inspección de redirecciones, inspector TLS, SVG badges y webhooks HMAC-SHA256.",
    serverUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3007",
    routes: [
      {
        path: "/api/health",
        method: "get",
        tag: "Observability",
        summary: "Verifica salud del servicio y latencia de base de datos",
      },
      {
        path: "/api/monitors",
        method: "get",
        tag: "Monitors",
        summary:
          "Lista todos los monitores con métricas 24h e incidentes activos",
      },
      {
        path: "/api/monitors",
        method: "post",
        tag: "Monitors",
        summary: "Crea un nuevo monitor HTTP validando URL contra SSRF",
        requestSchema: CreateMonitorSchema,
      },
      {
        path: "/api/monitors/{id}",
        method: "get",
        tag: "Monitors",
        summary: "Obtiene detalle y telemetría de un monitor",
      },
      {
        path: "/api/monitors/{id}",
        method: "delete",
        tag: "Monitors",
        summary: "Elimina un monitor y sus heartbeats en cascada",
      },
      {
        path: "/api/monitors/{id}/probe",
        method: "post",
        tag: "Probes",
        summary:
          "Ejecuta un sondeo inmediato (o simula caída con simulateFailure=true)",
        requestSchema: ProbeMonitorSchema,
      },
      {
        path: "/api/monitors/probe-url",
        method: "post",
        tag: "Probes",
        summary:
          "Diagnóstico instantáneo de URL con validación anti-SSRF e inspección TLS",
        requestSchema: ProbeUrlSchema,
      },
      {
        path: "/api/monitors/{id}/telemetry",
        method: "get",
        tag: "Telemetry",
        summary:
          "Retorna uptime, percentiles P50/P95/P99 y buckets de 30 días (24h|7d|30d)",
      },
      {
        path: "/api/badge/{monitorId}",
        method: "get",
        tag: "Badges",
        summary: "Genera badge SVG dinámico de uptime (soporta sufijo .svg)",
      },
      {
        path: "/api/status/{slug}",
        method: "get",
        tag: "Status Pages",
        summary:
          "Agregación pública de estado e incidentes para un slug o 'public'",
      },
    ],
  });
}
