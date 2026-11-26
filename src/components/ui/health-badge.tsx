"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";

export function HealthBadge({
  endpoint = "/api/health",
}: { endpoint?: string }) {
  const { data, isError } = useQuery<{ status: string; dbLatencyMs?: number }>({
    queryKey: ["health", endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("unhealthy");
      return (await res.json()) as { status: string; dbLatencyMs?: number };
    },
    refetchInterval: 30_000,
  });

  const healthy = !isError && data?.status === "ok";

  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11px] font-medium ${
        healthy
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
          : "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${healthy ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}
      />
      {healthy
        ? `API OK${data?.dbLatencyMs ? ` · ${data.dbLatencyMs}ms` : ""}`
        : "Checking..."}
    </span>
  );
}
