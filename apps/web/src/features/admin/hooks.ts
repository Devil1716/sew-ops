"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { LiveFactory } from "@/features/factories/hooks";
import type { LiveLine } from "@/features/lines/hooks";
import type { LiveMachine } from "@/features/machines/live";
import type { LiveShift } from "@/features/shifts/hooks";

// Admin lists include inactive records; the screens filter them.
export function useAdminLines() {
  return useQuery({
    queryKey: ["lines", "admin"],
    queryFn: () => api.get<LiveLine[]>("/lines?includeInactive=true"),
  });
}

export function useAdminMachines() {
  return useQuery({
    queryKey: ["machines", "admin"],
    queryFn: () => api.get<LiveMachine[]>("/machines?includeInactive=true"),
  });
}

export function useAdminShifts() {
  return useQuery({
    queryKey: ["shifts", "admin"],
    queryFn: () => api.get<LiveShift[]>("/shifts?includeInactive=true"),
  });
}

/** Configuration changes ripple through many screens: refresh them all. */
function useRefreshConfig() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["factories", "lines", "machines", "shifts", "dashboard", "work-orders"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useCreateFactory() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (body: { name: string; code: string; timezone: string }) =>
      api.post<LiveFactory>("/factories", body),
    onSuccess: refresh,
  });
}

export function useUpdateFactory() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (input: { id: string; patch: { name?: string; timezone?: string; isActive?: boolean } }) =>
      api.patch<LiveFactory>(`/factories/${input.id}`, input.patch),
    onSuccess: refresh,
  });
}

export function useCreateLine() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (body: { factoryId: string; name: string; code: string; targetPerShift: number }) =>
      api.post<LiveLine>("/lines", body),
    onSuccess: refresh,
  });
}

export function useUpdateLine() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: { name?: string; code?: string; targetPerShift?: number; isActive?: boolean };
    }) => api.patch<LiveLine>(`/lines/${input.id}`, input.patch),
    onSuccess: refresh,
  });
}

export function useCreateMachine() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (body: { lineId: string; name: string; code: string; model?: string }) =>
      api.post<LiveMachine>("/machines", body),
    onSuccess: refresh,
  });
}

export function useUpdateMachine() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: { lineId?: string; name?: string; code?: string; model?: string | null; isActive?: boolean };
    }) => api.patch<LiveMachine>(`/machines/${input.id}`, input.patch),
    onSuccess: refresh,
  });
}

export function useCreateShift() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (body: { factoryId: string; name: string; startsAt: string; endsAt: string }) =>
      api.post<LiveShift>("/shifts", body),
    onSuccess: refresh,
  });
}

export function useUpdateShift() {
  const refresh = useRefreshConfig();
  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: { name?: string; startsAt?: string; endsAt?: string; isActive?: boolean };
    }) => api.patch<LiveShift>(`/shifts/${input.id}`, input.patch),
    onSuccess: refresh,
  });
}