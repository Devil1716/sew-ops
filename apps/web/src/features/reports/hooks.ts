"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type ReportKind = "production" | "downtime" | "quality";

export interface ProductionReport {
  factoryId: string;
  timezone: string;
  from: string;
  to: string;
  rows: { day: string; lineCode: string; machineCode: string; orderNumber: string; pieces: number }[];
  totals: { pieces: number };
  byLine: { lineCode: string; pieces: number }[];
}

export interface DowntimeReport {
  factoryId: string;
  timezone: string;
  from: string;
  to: string;
  rows: { lineCode: string; machineCode: string; reason: string; planned: boolean; events: number; minutes: number }[];
  totals: { events: number; plannedMinutes: number; unplannedMinutes: number };
}

export interface QualityReport {
  factoryId: string;
  timezone: string;
  from: string;
  to: string;
  rows: { day: string; orderNumber: string; defectType: string | null; inspected: number; rejected: number }[];
  totals: { inspected: number; rejected: number; rejectRatePct: number };
  byDefect: { defectType: string; rejected: number }[];
  byWorkOrder: { orderNumber: string; inspected: number; rejected: number; rejectRatePct: number }[];
}

/** YYYY-MM-DD for today minus N days, on this computer's calendar. */
export function dayString(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("en-CA");
}

export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
}

export function reportPath(kind: ReportKind, from: string, to: string, factoryId?: string, csv = false): string {
  const q = new URLSearchParams({ from, to });
  if (factoryId) q.set("factoryId", factoryId);
  if (csv) q.set("format", "csv");
  return `/reports/${kind}?${q.toString()}`;
}

function useReport<T>(kind: ReportKind, from: string, to: string, factoryId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", kind, from, to, factoryId ?? ""],
    queryFn: () => api.get<T>(reportPath(kind, from, to, factoryId)),
    enabled,
  });
}

export const useProductionReport = (from: string, to: string, factoryId: string | undefined, enabled = true) =>
  useReport<ProductionReport>("production", from, to, factoryId, enabled);
export const useDowntimeReport = (from: string, to: string, factoryId: string | undefined, enabled = true) =>
  useReport<DowntimeReport>("downtime", from, to, factoryId, enabled);
export const useQualityReport = (from: string, to: string, factoryId: string | undefined, enabled = true) =>
  useReport<QualityReport>("quality", from, to, factoryId, enabled);