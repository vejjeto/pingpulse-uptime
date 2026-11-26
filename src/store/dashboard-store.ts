"use client";

import type { TimeWindow, WebhookDispatchPreview } from "@/contracts/pingpulse";
import { create } from "zustand";

interface DashboardState {
  selectedMonitorId: string | null;
  timeWindow: TimeWindow;
  createModalOpen: boolean;
  lastWebhookPreview: WebhookDispatchPreview | null;
  setSelectedMonitorId: (id: string) => void;
  setTimeWindow: (window: TimeWindow) => void;
  setCreateModalOpen: (open: boolean) => void;
  setLastWebhookPreview: (preview: WebhookDispatchPreview | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedMonitorId: null,
  timeWindow: "24h",
  createModalOpen: false,
  lastWebhookPreview: null,
  setSelectedMonitorId: (selectedMonitorId) => set({ selectedMonitorId }),
  setTimeWindow: (timeWindow) => set({ timeWindow }),
  setCreateModalOpen: (createModalOpen) => set({ createModalOpen }),
  setLastWebhookPreview: (lastWebhookPreview) => set({ lastWebhookPreview }),
}));
