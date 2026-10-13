"use client";
import { useQuery } from "@tanstack/react-query";
import type { DashboardKpis, LineProgress, TrendPoint } from "@sew-ops/shared";
import { api } from "@/lib/api/client";

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

// refetchInterval is only a safety net; live updates arrive over the socket.
const SAFETY_NET_MS = 60_000;

export function useDashboardKpis() {
  return useQuery({
    queryKey: dashboardKeys.kpis,
    queryFn: () => api.get<DashboardKpisLive>("/dashboard/kpis"),
    refetchInterval: SAFETY_NET_MS,
  });
}

export function useLineProgress() {
  return useQuery({
    queryKey: dashboardKeys.lines,
    queryFn: () => api.get<LineProgressLive[]>("/dashboard/lines"),
    refetchInterval: SAFETY_NET_MS,
  });
}

export function useOutputTrend(window = "24h") {
  return useQuery({
    queryKey: dashboardKeys.trend(window),
    queryFn: () => api.get<TrendPoint[]>(`/dashboard/trend?window=${window}`),
    refetchInterval: SAFETY_NET_MS,
  });
}

export function useDowntimeToday() {
  return useQuery({
    queryKey: dashboardKeys.downtime,
    queryFn: () => api.get<DowntimeSlice[]>("/dashboard/downtime"),
    refetchInterval: SAFETY_NET_MS,
  });
}