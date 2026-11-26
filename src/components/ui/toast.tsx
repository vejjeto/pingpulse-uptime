"use client";

import { X } from "lucide-react";
import * as React from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (input: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const VARIANT_CLS: Record<ToastVariant, string> = {
  success: "border-emerald-500/40 bg-emerald-950/90 text-emerald-100",
  error: "border-rose-500/40 bg-rose-950/90 text-rose-100",
  info: "border-indigo-500/40 bg-zinc-900/95 text-zinc-100",
};

export function UiToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const pushToast = React.useCallback((input: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { ...input, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs shadow-lg backdrop-blur ${VARIANT_CLS[toast.variant]}`}
          >
            <div>
              <p className="font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 opacity-85">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              aria-label="Cerrar notificación"
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useUiToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return { pushToast: () => undefined };
  }
  return ctx;
}
