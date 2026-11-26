"use client";

import { UiButton } from "@/components/ui/button";
import { UiModal } from "@/components/ui/modal";
import { useUiToast } from "@/components/ui/toast";
import * as React from "react";

interface CreateMonitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (monitorId: string) => void;
}

export function CreateMonitorModal({
  open,
  onOpenChange,
  onCreated,
}: CreateMonitorModalProps) {
  const { pushToast } = useUiToast();
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("https://example.com");
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [timeoutMs, setTimeoutMs] = React.useState("5000");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          webhookUrl: webhookUrl.trim() || undefined,
          timeoutMs: Number(timeoutMs),
          isPublic: true,
        }),
      });
      const data = (await res.json()) as {
        monitor?: { id: string; name: string };
        detail?: string;
        error?: string;
      };
      if (!res.ok || !data.monitor) {
        setError(data.detail ?? data.error ?? "No se pudo crear el monitor");
        return;
      }
      pushToast({
        title: "Monitor creado",
        description: `${data.monitor.name} quedó registrado.`,
        variant: "success",
      });
      setName("");
      onOpenChange(false);
      onCreated(data.monitor.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UiModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo Monitor HTTP"
      description="La URL se valida contra rangos privados/SSRF antes de guardarse."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="monitor-name"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Nombre del servicio
          </label>
          <input
            id="monitor-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auth Gateway Production"
            className="h-9 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor="monitor-url"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Endpoint URL
          </label>
          <input
            id="monitor-url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/health"
            className="h-9 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor="monitor-webhook"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Webhook de incidentes (opcional, HMAC-SHA256)
          </label>
          <input
            id="monitor-webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.example.com/pingpulse"
            className="h-9 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor="monitor-timeout"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Timeout (ms)
          </label>
          <input
            id="monitor-timeout"
            type="number"
            min={500}
            max={15000}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <UiButton
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </UiButton>
          <UiButton type="submit" loading={submitting}>
            Crear Monitor
          </UiButton>
        </div>
      </form>
    </UiModal>
  );
}
