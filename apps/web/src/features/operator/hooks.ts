"use client";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import type { Station, StationIssue } from "./sync";

export const operatorKeys = {
  station: ["operator", "station"] as const,
  issues: ["operator", "issues"] as const,
};

export function useStation() {
  return useQuery({
    queryKey: operatorKeys.station,
    queryFn: () => api.get<Station>("/operator/station"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      !(error instanceof ApiError && (error.status === 404 || error.status === 401)) && count < 3,
  });
}

export function useStationIssues(enabled: boolean) {
  return useQuery({
    queryKey: operatorKeys.issues,
    queryFn: () => api.get<StationIssue[]>("/operator/issues"),
    refetchInterval: 15_000,
    enabled,
  });
}