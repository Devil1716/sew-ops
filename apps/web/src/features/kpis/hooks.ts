"use client";
import { useQuery } from "@tanstack/react-query";
import type {
  DashboardKpis,
  DowntimeEntry,
  LineProgress,
  TrendPoint,
} from "@sew-ops/shared";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export function useDashboardKpis() {
  return useQuery({
    queryKey: qk.kpisToday,
    queryFn: () => api.get<DashboardKpis>("/kpis/today"),
  });
}

export function useLineProgress() {
  return useQuery({
    queryKey: qk.lineProgress,
    queryFn: () => api.get<LineProgress[]>("/lines/progress"),
  });
}

export function useOutputTrend(window = "24h") {
  return useQuery({
    queryKey: qk.trendsOutput(window),
    queryFn: () => api.get<TrendPoint[]>(`/trends/output?window=${window}`),
  });
}

export function useDowntimeToday() {
  return useQuery({
    queryKey: qk.downtimeToday,
    queryFn: () => api.get<DowntimeEntry[]>("/downtime/today"),
  });
}
