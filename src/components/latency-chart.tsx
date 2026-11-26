"use client";

import type { HeartbeatRecord } from "@/contracts/pingpulse";
import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LatencyChartProps {
  series: readonly HeartbeatRecord[];
}

export function LatencyChart({ series }: LatencyChartProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const data = React.useMemo(
    () =>
      series.slice(-60).map((point) => ({
        time: new Date(point.checkedAt).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        latencyMs: point.latencyMs,
        status: point.status,
      })),
    [series],
  );

  return (
    <div className="h-[240px] w-full">
      {!mounted ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
          Inicializando gráfico de latencia...
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
          Sin sondeos en esta ventana temporal.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="pingpulseLatencyFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272a"
              opacity={0.35}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              unit="ms"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111114",
                borderColor: "#27272a",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#f4f4f5",
              }}
              formatter={(value: number) => [`${value} ms`, "Latencia"]}
            />
            <Area
              type="monotone"
              dataKey="latencyMs"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#pingpulseLatencyFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
