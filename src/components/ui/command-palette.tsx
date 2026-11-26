"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface CommandAction {
  id: string;
  label: string;
  hint: string;
  href: string;
}

export function CommandPalette({
  actions,
}: { actions: readonly CommandAction[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = actions.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.hint.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
        <Dialog.Content className="fixed left-1/2 top-24 z-50 w-[92vw] max-w-lg -translate-x-1/2 rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#111114]">
          <Dialog.Title className="sr-only">Paleta de comandos</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ir a vista o endpoint... (Esc para cerrar)"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <span className="inline-flex items-center gap-0.5 rounded border border-zinc-300 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 dark:border-zinc-700">
              <Command className="h-2.5 w-2.5" />K
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">
                Sin coincidencias.
              </p>
            ) : (
              filtered.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(action.href);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{action.label}</span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {action.hint}
                  </span>
                </button>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
