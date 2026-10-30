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
  // ----- screens before the terminal is ready -----
  const noStation = stationQ.error instanceof ApiError && stationQ.error.status === 404 && !station;
  if (noStation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
          <TriangleAlert className="h-8 w-8 text-[var(--status-idle)]" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">No station assigned right now</h1>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            You are not assigned to a machine in a running shift. Ask a manager, then sign in again.
          </p>
        </div>
        <BigButton onClick={() => void performLogout()} style={{ minHeight: 80 }} className="max-w-xs">
          Sign out
        </BigButton>
      </div>
    );
  }
  if (!station) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center text-[var(--muted)]">
        <span className="pulse-dot h-3 w-3 rounded-full bg-[var(--accent)]" />
        <span className="text-sm font-medium">
          {stationQ.isError ? "Cannot reach the server. Retrying…" : "Loading your station…"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col select-none">
      <OfflineBanner />

      {/* Header strip: High-contrast station indicators */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-4 sm:py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <HeaderField label={t("operator.machine")} value={station.machine.code} highlight />
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
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ConnectionBadge />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void performLogout()}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] hover:border-[var(--accent)]"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Open issues at this machine: prominent floor alert */}
      {openIssues.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 sm:px-4">
          {openIssues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-amber-500/30 bg-[var(--surface)] px-3.5 py-2 text-sm shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span className="pulse-dot h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-bold text-[var(--text)]">{issueLabel(issue.type)}</span>
              </div>
              <span className="font-data text-xs text-[var(--muted)]">
                since {new Date(issue.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {OPERATOR_RESOLVABLE.includes(issue.type) ? (
                <button
                  type="button"
                  onClick={() => void onResolve(issue)}
                  className="rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-[var(--accent-foreground)] shadow-xs transition-transform active:scale-95"
                >
                  {issue.type === "break_pause" ? "Resume work" : "Mark fixed"}
                </button>
              ) : (
                <span className="rounded-full bg-[var(--bg)] border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
                  Waiting for manager
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Terminal View: Responsive across Tablet & Mobile */}
      <main className="grid flex-1 grid-cols-1 gap-4 p-3 sm:p-5 lg:grid-cols-5">
        {/* Left: Progress ring + primary count button */}
        <section className="flex flex-col items-center justify-center gap-5 sm:gap-6 rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-8 lg:col-span-3 shadow-xs">
          <ProgressRing completed={completed} target={target} size={230} />

          <div className="w-full max-w-xl">
            <BigButton
              tone="primary"
              onClick={onPiece}
              disabled={locked || !workOrder}
              className={cn(
                "w-full text-2xl sm:text-3xl tracking-tight font-extrabold shadow-lg transition-transform",
                pulse && "success-pulse",
              )}
              style={{ minHeight: 165 }}
            >
              <Check className="h-10 w-10 sm:h-12 sm:w-12 stroke-[3]" />
              <span>{t("operator.pieceCompleted")}</span>
            </BigButton>
          </div>

          {!workOrder && (
            <p className="max-w-md text-center text-xs sm:text-sm text-[var(--muted)]">
              No active work order for this machine. Ask a manager to start one.
            </p>
          )}

          {/* Feedback & Undo Banner: Prominent for quick touch correction */}
          <div className="flex min-h-12 items-center justify-center gap-3 flex-wrap">
            {undoKey && (
              <button
                type="button"
                onClick={() => void onUndo()}
                className="tactile inline-flex items-center gap-2 rounded-[var(--radius-lg)] border-2 border-amber-500/60 bg-amber-500/15 px-5 py-2.5 text-sm sm:text-base font-bold text-amber-300 shadow-sm transition-transform active:scale-95"
              >
                <span>{t("common.undo")}</span>
                <span className="text-xs font-normal opacity-85">({t("operator.undoWindow")})</span>
              </button>
            )}
            {toast && (
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-lg)] border px-4 py-2 text-xs sm:text-sm font-semibold shadow-xs animate-in fade-in zoom-in-95",
                  toast.ok
                    ? "border-[var(--status-running)]/30 bg-[color-mix(in_srgb,var(--status-running)_15%,var(--surface))] text-[var(--status-running)]"
                    : "border-[var(--status-breakdown)]/30 bg-[color-mix(in_srgb,var(--status-breakdown)_15%,var(--surface))] text-[var(--status-breakdown)]",
                )}
              >
                {toast.ok ? <Check className="h-4 w-4 stroke-[3]" /> : <TriangleAlert className="h-4 w-4" />}{" "}
                {toast.msg}
              </span>
            )}
          </div>
        </section>

        {/* Right: Secondary Actions (6 Issue Buttons >=96px) */}
        <section className="grid grid-cols-2 content-start gap-2.5 sm:gap-3.5 lg:col-span-2">
          {ISSUE_TYPES.map((type) => (
            <BigButton
              key={type}
              onClick={() => setSheet(type)}
              className="text-sm sm:text-base font-bold border border-[var(--border)] bg-[var(--surface)] hover:bg-[color-mix(in_srgb,var(--text)_4%,var(--surface))]"
              style={{ minHeight: 96 }}
            >
              <div className="text-[var(--accent)]">{ISSUE_ICONS[type]}</div>
              <span className="text-center leading-tight">{issueLabel(type)}</span>
            </BigButton>
          ))}
        </section>
      </main>

      {/* Confirmation Bottom Sheet */}
      <Dialog.Root open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[var(--radius-2xl)] border-t border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl max-w-xl mx-auto">
            <div className="flex items-center gap-3">
              {sheet && <div className="text-[var(--accent)]">{ISSUE_ICONS[sheet]}</div>}
              <Dialog.Title className="text-xl font-bold tracking-tight">
                {sheet && issueLabel(sheet)}
              </Dialog.Title>
            </div>
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
                className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              />
              <div className="flex gap-3">
                <BigButton type="submit" tone="primary" className="flex-1 text-base sm:text-lg" style={{ minHeight: 88 }}>
                  {t("operator.confirmIssue")}
                </BigButton>
                <BigButton type="button" onClick={() => setSheet(null)} className="flex-1 text-base sm:text-lg" style={{ minHeight: 88 }}>
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

function HeaderField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--radius-md)] border px-2.5 py-1 min-w-[76px]",
        highlight
          ? "border-[var(--accent)]/40 bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg))]"
          : "border-[var(--border)] bg-[var(--bg)]",
      )}
    >
      <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] font-medium">{label}</span>
      <span className="font-data text-xs sm:text-sm font-bold truncate text-[var(--text)]">{value}</span>
    </div>
  );
}