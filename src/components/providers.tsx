"use client";

import {
  type CommandAction,
  CommandPalette,
} from "@/components/ui/command-palette";
import { UiToastProvider } from "@/components/ui/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const COMMAND_ACTIONS: readonly CommandAction[] = [
  { id: "home", label: "Dashboard Principal", hint: "/", href: "/" },
  { id: "demo", label: "Demo Interactiva", hint: "/demo", href: "/demo" },
  {
    id: "status-public",
    label: "Status Page Pública",
    hint: "/status/public",
    href: "/status/public",
  },
  {
    id: "api-docs",
    label: "OpenAPI 3.1 Docs",
    hint: "/api/docs",
    href: "/api/docs",
  },
  {
    id: "api-health",
    label: "Health Check JSON",
    hint: "/api/health",
    href: "/api/health",
  },
];

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <UiToastProvider>
        {children}
        <CommandPalette actions={COMMAND_ACTIONS} />
      </UiToastProvider>
    </QueryClientProvider>
  );
}
