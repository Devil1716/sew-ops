"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProductionEvent, RecordPieceRequest } from "@sew-ops/shared";
import { apiPostIdempotent, api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export function useRecordPiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordPieceRequest) =>
      apiPostIdempotent<ProductionEvent>("/production/events", payload, payload.idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.kpisToday });
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: qk.lineProgress });
    },
  });
}

export function useUndoPiece() {
  return useMutation({
    mutationFn: (idempotencyKey: string) =>
      api.post<{ ok: true }>("/production/events/undo", { idempotencyKey }),
  });
}
