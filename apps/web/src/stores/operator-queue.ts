"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IssuePayload, PiecePayload } from "@/features/operator/sync";

/**
 * Events that could not reach the server. Saved in the browser so a reload or
 * power cut does not lose taps. Every event carries its idempotency key, so a
 * replay can never count twice. Items are tied to the operator who made them.
 */
export type QueuedEvent =
  | { kind: "piece"; userId: string; payload: PiecePayload }
  | { kind: "issue"; userId: string; payload: IssuePayload };

interface QueueState {
  queue: QueuedEvent[];
  enqueue: (e: QueuedEvent) => void;
  remove: (idempotencyKey: string) => void;
  has: (idempotencyKey: string) => boolean;
}

export const useOperatorQueue = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      enqueue: (e) =>
        set((s) =>
          s.queue.some((q) => q.payload.idempotencyKey === e.payload.idempotencyKey)
            ? s
            : { queue: [...s.queue, e] },
        ),
      remove: (key) => set((s) => ({ queue: s.queue.filter((e) => e.payload.idempotencyKey !== key) })),
      has: (key) => get().queue.some((e) => e.payload.idempotencyKey === key),
    }),
    {
      name: "sewops_operator_queue_v1",
      version: 1,
      partialize: (s) => ({ queue: s.queue }),
      skipHydration: true, // rehydrated after mount to avoid server/client mismatch
    },
  ),
);