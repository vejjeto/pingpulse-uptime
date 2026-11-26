"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";

interface UiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function UiModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: UiModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-100">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <Dialog.Title className="text-base font-bold">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
