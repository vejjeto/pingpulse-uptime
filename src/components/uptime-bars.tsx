"use client";

import type { DailyBucket } from "@/contracts/pingpulse";
import * as React from "react";

interface UptimeBarsProps {
  buckets: readonly DailyBucket[];
}

const BAR_COLORS: Record<DailyBucket["status"], string> = {
  up: "bg-emerald-500 hover:bg-emerald-400",
  degraded: "bg-amber-500 hover:bg-amber-400",
  down: "bg-rose-500 hover:bg-rose-400",
  empty:
    "bg-zinc-300 dark:bg-zinc-800 hover:bg-zinc-400 dark:hover:bg-zinc-700",
};

const STATUS_LABEL: Record<DailyBucket["status"], string> = {
  up: "Operativo",
  degraded: "Degradado",
  down: "Caído",
  empty: "Sin datos",
};

export function UptimeBars({ buckets }: UptimeBarsProps) {
  const [hovered, setHovered] = React.useState<DailyBucket | null>(null);

  return (
    <div className="space-y-2">
      <ul
        className="relative flex h-9 items-end gap-1"
        aria-label="Historial de 30 días"
      >
        {buckets.map((bucket) => (
          <li key={bucket.date} className="flex h-full flex-1 items-end">
            <button
              type="button"
              aria-label={`${bucket.date}: ${bucket.uptimePercent}% uptime`}
              onMouseEnter={() => setHovered(bucket)}
              onFocus={() => setHovered(bucket)}
              onMouseLeave={() => setHovered(null)}
              className={`h-8 w-full rounded-sm transition-transform hover:scale-y-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${BAR_COLORS[bucket.status]}`}
            />
          </li>
        ))}
      </ul>

      <div className="flex min-h-[20px] items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>Hace 30 días</span>
        {hovered ? (
          <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {hovered.date} · {STATUS_LABEL[hovered.status]} ·{" "}
            {hovered.uptimePercent}% · {hovered.avgLatencyMs}ms (
            {hovered.checksOk}/{hovered.checksTotal})
          </span>
        ) : (
          <span>Pasa el cursor sobre cualquier día para inspeccionar</span>
        )}
        <span>Hoy</span>
      </div>
    </div>
  );
}
