"use client";
import { create } from "zustand";
import type { OpenIssueRequest, RecordPieceRequest } from "@sew-ops/shared";

export type QueuedEvent =
  | { kind: "piece"; payload: RecordPieceRequest }
  | { kind: "issue"; payload: OpenIssueRequest };

interface QueueState {
  queue: QueuedEvent[];
  enqueue: (e: QueuedEvent) => void;
  drain: () => QueuedEvent[];
  removeByIdempotencyKey: (key: string) => void;
  size: () => number;
}

export const useOperatorQueue = create<QueueState>((set, get) => ({
  queue: [],
  enqueue: (e) => set((s) => ({ queue: [...s.queue, e] })),
  drain: () => {
    const items = get().queue;
    set({ queue: [] });
    return items;
  },
  removeByIdempotencyKey: (key) =>
    set((s) => ({ queue: s.queue.filter((e) => e.payload.idempotencyKey !== key) })),
  size: () => get().queue.length,
}));
