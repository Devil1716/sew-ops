"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export const DEFECT_TYPES = [
  "broken_stitch",
  "skipped_stitch",
  "open_seam",
  "puckering",
  "stain",
  "wrong_measurement",
  "uneven_hem",
  "loose_thread",
  "other",
] as const;

export function defectLabel(value: string | null): string {
  if (!value) return "None";
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface QualityCheck {
  id: string;
  workOrderId: string;
  orderNumber: string;
  machineId: string | null;
  machineCode: string | null;
  inspectedQty: number;
  rejectedQty: number;
  defectType: string | null;
  note: string | null;
  inspector: string | null;
  checkedAt: string;
  voided: boolean;
}

export interface NewQualityCheck {
  workOrderId: string;
  machineId?: string;
  inspectedQty: number;
  rejectedQty: number;
  defectType?: string;
  note?: string;
  idempotencyKey: string;
}

export function useQualityChecks(includeVoided: boolean) {
  return useQuery({
    queryKey: ["quality", "checks", includeVoided],
    queryFn: () => api.get<QualityCheck[]>(`/quality/checks?limit=100${includeVoided ? "&includeVoided=true" : ""}`),
  });
}

function useRefreshQuality() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["quality"] });
    void qc.invalidateQueries({ queryKey: ["reports"] });
  };
}

export function useCreateQualityCheck() {
  const refresh = useRefreshQuality();
  return useMutation({
    mutationFn: (body: NewQualityCheck) => api.post<{ duplicate: boolean; check: QualityCheck }>("/quality/checks", body),
    onSuccess: refresh,
  });
}

export function useVoidQualityCheck() {
  const refresh = useRefreshQuality();
  return useMutation({
    mutationFn: (id: string) => api.post<unknown>(`/quality/checks/${id}/void`),
    onSuccess: refresh,
  });
}