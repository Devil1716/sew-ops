"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type DowntimeRange = "24h" | "7d";

export interface DowntimeRow {
  id: string;
  machineId: string;
  machineName: string;
  machineCode: string;
  lineId: string;
  issueId: string | null;
  reason: string;
  planned: boolean;
  startedAt: string;
  endedAt: string | null;
  ongoing: boolean;
  minutes: number;
}

export function useDowntimeList(range: DowntimeRange) {
  return useQuery({
    queryKey: ["downtime", "list", range],
    queryFn: () => {
      const ms = range === "24h" ? 86_400_000 : 7 * 86_400_000;
      const since = encodeURIComponent(new Date(Date.now() - ms).toISOString());
      return api.get<DowntimeRow[]>(`/downtime?since=${since}&limit=500`);
    },
    refetchInterval: 60_000,
  });
}