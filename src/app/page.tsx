import { DashboardClient } from "@/components/dashboard-client";
import { getMonitorTelemetry, listMonitorSummaries } from "@/core/service";
import { db } from "@/db";
import { ensureSeeded } from "@/db/seed-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeeded(db);
  const monitors = await listMonitorSummaries(db);
  const initialTelemetry = monitors[0]
    ? await getMonitorTelemetry(db, monitors[0].id, "24h")
    : null;

  return (
    <DashboardClient
      initialMonitors={monitors}
      initialTelemetry={initialTelemetry}
    />
  );
}
