"use client";

import { UiButton } from "@/components/ui/button";
import type { TlsCertInfo } from "@/core/tls-inspector";
import type { ProbeExecutionResult } from "@/core/worker";
import { useLocale } from "@/lib/i18n";
import { Lock, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import * as React from "react";

interface ProbeUrlResponse {
  probe?: ProbeExecutionResult;
  detail?: string;
  error?: string;
}

export function ProbeUrlPanel() {
  const { t } = useLocale();
  const [url, setUrl] = React.useState("https://example.com");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
    detail?: string;
    tls?: TlsCertInfo;
  } | null>(null);

  const runProbe = async (targetUrl: string) => {
    setUrl(targetUrl);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/monitors/probe-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = (await res.json()) as ProbeUrlResponse;
      if (!res.ok) {
        const ssrfReason = data.probe?.ssrfReason;
        setResult({
          ok: false,
          message: data.detail ?? data.error ?? t.probeUrlBlocked,
          ...(ssrfReason ? { detail: ssrfReason } : {}),
        });
        return;
      }
      const p = data.probe;
      const detail = p?.resolvedIp
        ? `${t.probeUrlResolvedIp} ${p.resolvedIp}`
        : (p?.errorMessage ?? undefined);
      setResult({
        ok: p?.status === "up",
        message: p
          ? `${p.status.toUpperCase()} · HTTP ${p.httpStatus ?? "ERR"} · ${p.latencyMs} ms`
          : t.probeUrlCompleted,
        ...(detail ? { detail } : {}),
        ...(p?.tls ? { tls: p.tls } : {}),
      });
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : t.probeUrlNetworkError,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-indigo-400" />
            {t.probeUrlTitle}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t.probeUrlSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() =>
              void runProbe("http://169.254.169.254/latest/meta-data/")
            }
            className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-500/20 dark:text-rose-400"
          >
            Test SSRF Metadata
          </button>
          <button
            type="button"
            onClick={() => void runProbe("http://127.0.0.1:22")}
            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
          >
            Test Loopback
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runProbe(url);
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t.probeUrlPlaceholder}
          aria-label={t.probeUrlAria}
          className="h-9 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <UiButton type="submit" loading={loading} size="md">
          {t.probeUrlButton}
        </UiButton>
      </form>

      {result && (
        <div
          className={`mt-3 flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {result.ok ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p className="font-medium">{result.message}</p>
            {result.detail && (
              <p className="mt-0.5 font-mono text-[11px] opacity-85">
                {result.detail}
              </p>
            )}
            {result.tls && (
              <p className="mt-1 flex items-center gap-1 font-mono text-[11px] opacity-90">
                <Lock className="h-3 w-3" />
                TLS: {result.tls.status}
                {result.tls.daysRemaining !== null
                  ? ` · ${result.tls.daysRemaining}d restantes`
                  : ""}
                {result.tls.issuer ? ` · ${result.tls.issuer}` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
