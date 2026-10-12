"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Coffee,
  MoreHorizontal,
  Package,
  ScanLine,
  Scissors,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ISSUE_TYPES, type IssueType } from "@sew-ops/shared";
import { ApiError } from "@/lib/api/client";
import { performLogout, useSession } from "@/lib/auth/session";
import { BigButton } from "@/components/operator/BigButton";
import { OfflineBanner } from "@/components/operator/OfflineBanner";
import { ProgressRing } from "@/components/operator/ProgressRing";
import { ConnectionBadge } from "@/components/data/ConnectionBadge";
import { ThemeToggle } from "@/components/theme";
import { OPERATOR_DOUBLE_TAP_LOCK_MS, OPERATOR_UNDO_WINDOW_MS } from "@/lib/constants";
import { cn, newIdempotencyKey, vibrate } from "@/lib/utils";
import { useOperatorQueue } from "@/stores/operator-queue";
import { operatorKeys, useStation, useStationIssues } from "@/features/operator/hooks";
import {
  drainQueue,
  errorMessage,
  inflight,
  isTransient,
  postIssue,
  postPiece,
  resolveIssue,
  undoPiece,
  type PiecePayload,
  type PieceResult,
  type Station,
  type StationIssue,
} from "@/features/operator/sync";

/**
 * Operator terminal. Fullscreen, high-contrast, no sidebar.
 * - PIECE COMPLETED: >=160px, haptics, success pulse, 600ms double-tap lock,
 *   5s undo window, idempotency key per event, server-confirmed counter.
 * - Events that cannot reach the server are saved (survives reload) and
 *   replayed automatically; keys make double counting impossible.
 */
const OPERATOR_RESOLVABLE: IssueType[] = ["break_pause", "thread_empty"];
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export default function OperatorPage() {
  const t = useTranslations();
  const qc = useQueryClient();
  const { data: me } = useSession();
  const userId = me?.id ?? null;

  const stationQ = useStation();
  const station = stationQ.data;
  const issuesQ = useStationIssues(!!station);
  const openIssues: StationIssue[] = issuesQ.data ?? [];

  const enqueue = useOperatorQueue((s) => s.enqueue);
  const queuedQty = useOperatorQueue((s) =>
    userId ? s.queue.reduce((n, e) => (e.kind === "piece" && e.userId === userId ? n + e.payload.quantity : n), 0) : 0,
  );

  const [inflightQty, setInflightQty] = useState(0);
  const [locked, setLocked] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [undoKey, setUndoKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sheet, setSheet] = useState<IssueType | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshStation = useCallback(() => {
    void qc.invalidateQueries({ queryKey: operatorKeys.station });
    void qc.invalidateQueries({ queryKey: operatorKeys.issues });
  }, [qc]);

  const applyResult = useCallback(
    (r: PieceResult) => {
      const wo = r.workOrder;
      if (!wo) return;
      qc.setQueryData<Station>(operatorKeys.station, (old) => {
        if (!old || !old.workOrder || old.workOrder.id !== wo.id) return old;
        return {
          ...old,
          workOrder: { ...old.workOrder, quantityCompleted: wo.quantityCompleted, quantityTarget: wo.quantityTarget },
        };
      });
    },
    [qc],
  );

  // Saved events come back after a reload (hydrated after mount on purpose)
  useEffect(() => {
    void useOperatorQueue.persist.rehydrate();
  }, []);

  // Wake lock
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const wl = await navigator.wakeLock?.request?.("screen");
        if (!cancelled) wakeLock.current = wl ?? null;
      } catch {
        /* unsupported */
      }
    })();
    return () => {
      cancelled = true;
      wakeLock.current?.release().catch(() => {});
    };
  }, []);

  // Replay saved events: on load, when the browser comes back online, and every 8 seconds
  useEffect(() => {
    if (!userId) return;
    const run = () => {
      void drainQueue(userId).then((res) => {
        if (res.sent > 0) refreshStation();
        if (res.rejected > 0) showToast(`${res.rejected} saved event(s) were refused by the server.`, false);
      });
    };
    const first = setTimeout(run, 300); // after rehydration
    const iv = setInterval(run, 8_000);
    window.addEventListener("online", run);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
      window.removeEventListener("online", run);
    };
  }, [userId, refreshStation, showToast]);

  const workOrder = station?.workOrder ?? null;
  const completed = (workOrder?.quantityCompleted ?? 0) + inflightQty + queuedQty;
  const target = workOrder?.quantityTarget ?? 0;

  const onPiece = () => {
    if (locked || !workOrder || !userId) return;
    setLocked(true);
    setTimeout(() => setLocked(false), OPERATOR_DOUBLE_TAP_LOCK_MS);
    vibrate(18);

    const payload: PiecePayload = {
      idempotencyKey: newIdempotencyKey(),
      quantity: 1,
      occurredAt: new Date().toISOString(),
    };
    const key = payload.idempotencyKey;

    setUndoKey(key);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoKey(null), OPERATOR_UNDO_WINDOW_MS);

    setInflightQty((n) => n + payload.quantity);
    const run = (async () => {
      try {
        const r = await postPiece(payload);
        applyResult(r);
        setInflightQty((n) => n - payload.quantity);
        setPulse(true);
        setTimeout(() => setPulse(false), 450);
        showToast(t("operator.recorded"));
      } catch (err) {
        if (isTransient(err)) {
          enqueue({ kind: "piece", userId, payload });
          setInflightQty((n) => n - payload.quantity);
          showToast("Saved offline. It will sync automatically.");
        } else {
          setInflightQty((n) => n - payload.quantity);
          setUndoKey((k) => (k === key ? null : k));
          showToast(errorMessage(err), false);
        }
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, run);
  };

  const onUndo = async () => {
    const key = undoKey;
    if (!key) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoKey(null);

    // Not sent yet: just drop it from the saved queue.
    if (useOperatorQueue.getState().has(key)) {
      useOperatorQueue.getState().remove(key);
      showToast("Undone.");
      return;
    }
    // Still on the wire: let it land first, then undo it.
    await inflight.get(key);
    if (useOperatorQueue.getState().has(key)) {
      useOperatorQueue.getState().remove(key);
      showToast("Undone.");
      return;
    }
    try {
      applyResult(await undoPiece(key));
      showToast("Undone.");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not undo. Ask a manager.", false);
    }
  };

  const onIssueConfirm = async (type: IssueType, note?: string) => {
    setSheet(null);
    if (!userId) return;
    vibrate([12, 40, 12]);
    const payload = { idempotencyKey: newIdempotencyKey(), type, note };
    try {
      await postIssue(payload);
      showToast(t("operator.recorded"));
    } catch (err) {
      if (isTransient(err)) {
        enqueue({ kind: "issue", userId, payload });
        showToast("Saved offline. It will sync automatically.");
      } else {
        showToast(errorMessage(err), false);
      }
    }
    refreshStation();
  };

  const onResolve = async (issue: StationIssue) => {
    try {
      await resolveIssue(issue.id);
      showToast(t("operator.recorded"));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "No connection. Try again.", false);
    }
    refreshStation();
  };

  const ISSUE_ICONS: Record<IssueType, React.ReactNode> = {
    machine_issue: <AlertTriangle className="h-6 w-6" />,
    thread_empty: <Scissors className="h-6 w-6" />,
    material_missing: <Package className="h-6 w-6" />,
    quality_issue: <ScanLine className="h-6 w-6" />,
    break_pause: <Coffee className="h-6 w-6" />,
    other: <MoreHorizontal className="h-6 w-6" />,
  };
  const issueLabel = (type: IssueType) => t(`issue.${camel(type)}`);

  // ----- screens before the terminal is ready -----
  const noStation = stationQ.error instanceof ApiError && stationQ.error.status === 404 && !station;
  if (noStation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <TriangleAlert className="h-10 w-10 text-[var(--muted)]" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">No station assigned right now</h1>
          <p className="text-sm text-[var(--muted)]">
            You are not assigned to a machine in a running shift. Ask a manager, then sign in again.
          </p>
        </div>
        <BigButton onClick={() => void performLogout()} style={{ minHeight: 96 }} className="max-w-xs">
          Sign out
        </BigButton>
      </div>
    );
  }
  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-[var(--muted)]">
        {stationQ.isError ? "Cannot reach the server. Retrying…" : "Loading your station…"}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />

      {/* Header strip */}
      <header className="flex flex-wrap items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <HeaderField label={t("operator.machine")} value={station.machine.code} />
        <HeaderField label={t("operator.line")} value={station.line.code} />
        <HeaderField label={t("operator.operator")} value={station.operator.name} />
        <HeaderField
          label={t("operator.workOrder")}
          value={workOrder ? `${workOrder.orderNumber} · ${workOrder.garment}` : "None active"}
        />
        <HeaderField label="Shift" value={station.shift.name} />
        <HeaderField
          label="Status"
          value={station.machine.status.charAt(0).toUpperCase() + station.machine.status.slice(1)}
        />
        <div className="ml-auto flex items-center gap-3">
          <ConnectionBadge />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void performLogout()}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Open issues at this machine */}
      {openIssues.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--status-idle)_12%,var(--surface))] px-4 py-2">
          {openIssues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <span className="font-medium">{issueLabel(issue.type)}</span>
              <span className="font-data text-xs text-[var(--muted)]">
                since {new Date(issue.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {OPERATOR_RESOLVABLE.includes(issue.type) ? (
                <button
                  type="button"
                  onClick={() => void onResolve(issue)}
                  className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)]"
                >
                  {issue.type === "break_pause" ? "Resume work" : "Mark fixed"}
                </button>
              ) : (
                <span className="text-xs text-[var(--muted)]">Waiting for a manager</span>
              )}
            </div>
          ))}
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-5">
        {/* Left: progress + primary action */}
        <section className="flex flex-col items-center justify-center gap-6 lg:col-span-3">
          <ProgressRing completed={completed} target={target} size={240} />
          <BigButton
            tone="primary"
            onClick={onPiece}
            disabled={locked || !workOrder}
            className={cn("min-h-40 w-full max-w-xl text-3xl tracking-tight", pulse && "success-pulse")}
            style={{ minHeight: 160 }}
          >
            <Check className="h-10 w-10" />
            {t("operator.pieceCompleted")}
          </BigButton>
          {!workOrder && (
            <p className="max-w-xl text-center text-sm text-[var(--muted)]">
              No active work order for this machine. Ask a manager to start one.
            </p>
          )}

          <div className="flex min-h-10 items-center gap-4">
            {undoKey && (
              <button
                type="button"
                onClick={() => void onUndo()}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
              >
                {t("common.undo")} · {t("operator.undoWindow")}
              </button>
            )}
            {toast && (
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm",
                  toast.ok
                    ? "bg-[color-mix(in_srgb,var(--status-running)_18%,var(--surface))] text-[var(--status-running)]"
                    : "bg-[color-mix(in_srgb,var(--status-breakdown)_18%,var(--surface))] text-[var(--status-breakdown)]",
                )}
              >
                {toast.ok ? <Check className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />} {toast.msg}
              </span>
            )}
          </div>
        </section>

        {/* Right: secondary actions */}
        <section className="grid grid-cols-2 content-start gap-3 lg:col-span-2">
          {ISSUE_TYPES.map((type) => (
            <BigButton
              key={type}
              onClick={() => setSheet(type)}
              className="min-h-24 text-base"
              style={{ minHeight: 96 }}
            >
              {ISSUE_ICONS[type]}
              {issueLabel(type)}
            </BigButton>
          ))}
        </section>
      </main>

      {/* One-tap confirmation sheet */}
      <Dialog.Root open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[var(--radius-xl)] border-t border-[var(--border)] bg-[var(--surface)] p-6">
            <Dialog.Title className="text-xl font-semibold tracking-tight">
              {sheet && issueLabel(sheet)}
            </Dialog.Title>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!sheet) return;
                const note = new FormData(e.currentTarget).get("note");
                void onIssueConfirm(sheet, typeof note === "string" && note ? note : undefined);
              }}
            >
              <textarea
                name="note"
                rows={2}
                maxLength={500}
                placeholder={t("common.optionalNote")}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <div className="flex gap-3">
                <BigButton type="submit" tone="primary" className="flex-1" style={{ minHeight: 96 }}>
                  {t("operator.confirmIssue")}
                </BigButton>
                <BigButton type="button" onClick={() => setSheet(null)} style={{ minHeight: 96 }}>
                  {t("common.cancel")}
                </BigButton>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</span>
      <span className="font-data text-sm font-medium">{value}</span>
    </div>
  );
}