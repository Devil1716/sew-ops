"use client";
import type { IssueType } from "@sew-ops/shared";
import { api, ApiError } from "@/lib/api/client";
import { useConnectionStore } from "@/stores/connection";
import { useOperatorQueue } from "@/stores/operator-queue";

export interface Station {
  operator: { id: string; name: string };
  machine: { id: string; code: string; name: string; status: string };
  line: { id: string; code: string; name: string };
  shift: { id: string; name: string };
  workOrder: {
    id: string;
    orderNumber: string;
    styleCode: string;
    garment: string;
    quantityTarget: number;
    quantityCompleted: number;
  } | null;
}

export interface StationIssue {
  id: string;
  type: IssueType;
  status: string;
  openedAt: string;
  note: string | null;
}

export interface PieceResult {
  duplicate: boolean;
  workOrder: { id: string; quantityCompleted: number; quantityTarget: number } | null;
}

export interface PiecePayload {
  idempotencyKey: string;
  quantity: number;
  occurredAt: string;
}

export interface IssuePayload {
  idempotencyKey: string;
  type: IssueType;
  note?: string;
}

/** Network trouble, server trouble, rate limit or an expired session: keep the event, retry later. */
export function isTransient(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  return e.status >= 500 || e.status === 429 || e.status === 408 || e.status === 401;
}

export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "No connection";
}

/** Sends currently on the wire, so Undo can wait for them to finish. */
export const inflight = new Map<string, Promise<unknown>>();

function setLive(ok: boolean) {
  useConnectionStore.getState().setStatus(ok ? "live" : "reconnecting");
}

export async function postPiece(p: PiecePayload): Promise<PieceResult> {
  try {
    const r = await api.post<PieceResult>("/production/events", p, { retries: 0 });
    setLive(true);
    return r;
  } catch (e) {
    if (isTransient(e)) setLive(false);
    throw e;
  }
}

export async function postIssue(p: IssuePayload): Promise<unknown> {
  try {
    const r = await api.post<unknown>("/issues", p, { retries: 0 });
    setLive(true);
    return r;
  } catch (e) {
    if (isTransient(e)) setLive(false);
    throw e;
  }
}

export const undoPiece = (idempotencyKey: string) =>
  api.post<PieceResult>("/production/events/undo", { idempotencyKey }, { retries: 1 });

export const resolveIssue = (id: string) => api.post<unknown>(`/issues/${id}/resolve`, {}, { retries: 1 });

let draining = false;

/** Replays this operator's saved events in order. Stops at the first connection problem. */
export async function drainQueue(userId: string): Promise<{ sent: number; rejected: number }> {
  const result = { sent: 0, rejected: 0 };
  if (draining) return result;
  draining = true;
  try {
    for (const item of [...useOperatorQueue.getState().queue]) {
      if (item.userId !== userId) continue;
      const key = item.payload.idempotencyKey;
      if (!useOperatorQueue.getState().has(key)) continue; // undone while waiting
      const send = item.kind === "piece" ? postPiece(item.payload) : postIssue(item.payload);
      inflight.set(
        key,
        send.catch(() => undefined),
      );
      try {
        await send;
        useOperatorQueue.getState().remove(key);
        result.sent += 1;
      } catch (e) {
        if (isTransient(e)) break; // still offline: keep order, try again later
        useOperatorQueue.getState().remove(key); // refused for good: do not block the queue
        result.rejected += 1;
      } finally {
        inflight.delete(key);
      }
    }
  } finally {
    draining = false;
  }
  return result;
}