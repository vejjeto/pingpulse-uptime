import { ThemeToggle } from "@/components/theme-toggle";
import { UptimeBars } from "@/components/uptime-bars";
import { getPublicStatusBySlug } from "@/core/service";
import { db } from "@/db";
import { ensureSeeded } from "@/db/seed-data";
import { AlertTriangle, ArrowLeft, CheckCircle2, Radio } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const OVERALL_BANNER = {
  operational: {
    label: "Todos los sistemas operativos",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Degradación parcial detectada",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    Icon: AlertTriangle,
  },
  outage: {
    label: "Interrupción activa en servicios",
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    Icon: AlertTriangle,
  },
} as const;

export default async function PublicStatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await ensureSeeded(db);
  const status = await getPublicStatusBySlug(db, slug);

  if (!status) {
    notFound();
  }

  const banner = OVERALL_BANNER[status.overallStatus];
  const BannerIcon = banner.Icon;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#111114]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-indigo-500" />
            <span className="text-sm font-bold">{status.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${banner.cls}`}
        >
          <BannerIcon className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-base font-bold">{banner.label}</p>
            <p className="text-xs opacity-80">
              Actualizado:{" "}
              {new Date(status.generatedAt).toLocaleString("es-ES")}
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Servicios ({status.services.length})
          </h2>
          {status.services.map((service) => (
            <div
              key={service.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111114]"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">{service.name}</h3>
                  <p className="font-mono text-[11px] text-zinc-500">
                    {service.url}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-zinc-500">
                    P95 24h: {service.p95_24h}ms
                  </span>
                  <span className="font-semibold text-emerald-500">
                    {service.uptime30d}% (30d)
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      service.currentStatus === "up"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : service.currentStatus === "degraded"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {service.currentStatus}
                  </span>
                </div>
              </div>
              <UptimeBars buckets={service.dailyBuckets} />
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111114]">
          <h2 className="text-sm font-semibold">
            Línea de Tiempo de Incidentes
          </h2>
          {status.incidents.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Sin incidentes recientes reportados.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {status.incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="border-l-2 border-zinc-300 pl-3 text-xs dark:border-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{inc.monitorName}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        inc.status === "open"
                          ? "bg-rose-500/20 text-rose-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {inc.status === "open" ? "Activo" : "Resuelto"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                    {inc.cause}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    {new Date(inc.startedAt).toLocaleString("es-ES")}
                    {inc.resolvedAt
                      ? ` → ${new Date(inc.resolvedAt).toLocaleString("es-ES")}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
