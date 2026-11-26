import { DashboardClient } from "@/components/dashboard-client";
import { getMonitorTelemetry, listMonitorSummaries } from "@/core/service";
import { db } from "@/db";
import { ensureSeeded } from "@/db/seed-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  await ensureSeeded(db);
  const monitors = await listMonitorSummaries(db);
  const initialTelemetry = monitors[0]
    ? await getMonitorTelemetry(db, monitors[0].id, "24h")
    : null;

  return (
    <div>
      <div className="border-b border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-center text-xs text-indigo-300">
        Modo Demo Interactiva — Prueba{" "}
        <strong>Simular caída e incidente</strong>,{" "}
        <strong>Probar URL ahora</strong> o visita{" "}
        <Link href="/status/public" className="underline hover:text-indigo-200">
          /status/public
        </Link>
        .
      </div>
      <DashboardClient
        initialMonitors={monitors}
        initialTelemetry={initialTelemetry}
      />
    </div>
  );
}
