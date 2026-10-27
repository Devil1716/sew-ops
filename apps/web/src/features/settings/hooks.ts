"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/constants";

export const ALERT_RULES = [
  { key: "machine_issue", label: "Machine issue", hint: "Breakdowns and faults reported at a machine" },
  { key: "thread_empty", label: "Thread empty", hint: "A machine is waiting for thread" },
  { key: "material_missing", label: "Material missing", hint: "Fabric or trims are not at the station" },
  { key: "quality_issue", label: "Quality issue", hint: "An operator flags a quality problem" },
  { key: "other", label: "Other issue", hint: "Anything else an operator reports" },
] as const;

export type AlertRuleKey = (typeof ALERT_RULES)[number]["key"];

export interface SettingsData {
  factoryId: string;
  factoryName: string;
  timezone: string;
  alertRules: Record<AlertRuleKey, boolean>;
}

export function useSettings(factoryId?: string) {
  return useQuery({
    queryKey: ["settings", factoryId ?? ""],
    queryFn: () => api.get<SettingsData>(`/settings${factoryId ? `?factoryId=${factoryId}` : ""}`),
  });
}

export function useUpdateAlertRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { factoryId?: string; rules: Partial<Record<AlertRuleKey, boolean>> }) =>
      api.patch<unknown>("/settings/alert-rules", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export interface SystemHealth {
  status: string;
  database: string;
  time: string;
}

/** The health endpoint sits at the server root (outside /v1) and needs no login. */
export function useSystemHealth() {
  return useQuery({
    queryKey: ["system", "health"],
    queryFn: async (): Promise<SystemHealth> => {
      const origin = new URL(API_BASE_URL, window.location.origin).origin;
      const res = await fetch(`${origin}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error("unhealthy");
      return (await res.json()) as SystemHealth;
    },
    refetchInterval: 30_000,
    retry: false,
  });
}