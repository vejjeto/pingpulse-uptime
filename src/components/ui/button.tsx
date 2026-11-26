"use client";

import { Loader2 } from "lucide-react";
import type * as React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

export interface UiButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  danger: "bg-rose-600/90 text-white hover:bg-rose-500 shadow-sm",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
};

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-xs",
  icon: "h-8 w-8 p-0",
};

export function UiButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: UiButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLS[variant]} ${SIZE_CLS[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
