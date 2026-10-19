"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useSetMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; on: boolean; note?: string }) =>
      api.post<{ duplicate: boolean }>(`/machines/${input.id}/maintenance`, {
        on: input.on,
        note: input.note || undefined,
      }),
    onSuccess: () => {
      for (const key of ["machines", "dashboard", "downtime"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}