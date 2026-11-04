"use client";
import { useQuery } from "@tanstack/react-query";
import type { DashboardKpis, LineProgress, TrendPoint } from "@sew-ops/shared";
import { api } from "@/lib/api/client";
import { useConnectionStore } from "@/stores/connection";

export type DashboardKpisLive = DashboardKpis & {
  completedToday: number;
  machinesOffline: number;
  machinesTotal: number;
};

export type LineProgressLive = LineProgress & {
  lineCode: string;
  garment: string | null;
  orderNumbers: string[];
};

export interface DowntimeSlice {
  reason: string;
  planned: boolean;
  events: number;
  minutes: number;
}

/** All dashboard queries share the "dashboard" root so one invalidation refreshes them all. */
export const dashboardKeys = {
  kpis: ["dashboard", "kpis"] as const,
  lines: ["dashboard", "lines"] as const,
  trend: (window: string) => ["dashboard", "trend", window] as const,
  downtime: ["dashboard", "downtime"] as const,
};

// Keep the same dashboard current during socket reconnects or deployments where
// WebSocket upgrades are unavailable. Normal connected mode stays event-driven.
const DISCONNECTED_REFRESH_MS = 5_000;

export function useDashboardKpis() {
  const realtime = useConnectionStore((s) => s.status);
  return useQuery({
    queryKey: dashboardKeys.kpis,
    queryFn: () => api.get<DashboardKpisLive>("/dashboard/kpis"),
    refetchInterval: realtime === "live" ? false : DISCONNECTED_REFRESH_MS,
  });
}

export function useLineProgress() {
  const realtime = useConnectionStore((s) => s.status);
  return useQuery({
    queryKey: dashboardKeys.lines,
    queryFn: () => api.get<LineProgressLive[]>("/dashboard/lines"),
    refetchInterval: realtime === "live" ? false : DISCONNECTED_REFRESH_MS,
  });
}

export function useOutputTrend(window = "24h") {
  const realtime = useConnectionStore((s) => s.status);
  return useQuery({
    queryKey: dashboardKeys.trend(window),
    queryFn: () => api.get<TrendPoint[]>(`/dashboard/trend?window=${window}`),
    refetchInterval: realtime === "live" ? false : DISCONNECTED_REFRESH_MS,
  });
}

export function useDowntimeToday() {
  const realtime = useConnectionStore((s) => s.status);
  return useQuery({
    queryKey: dashboardKeys.downtime,
    queryFn: () => api.get<DowntimeSlice[]>("/dashboard/downtime"),
    refetchInterval: realtime === "live" ? false : DISCONNECTED_REFRESH_MS,
  });
}
