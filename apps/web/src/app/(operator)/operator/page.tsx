"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Coffee,
  MoreHorizontal,
  Package,
  ScanLine,
  Scissors,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ISSUE_TYPES, type IssueType } from "@sew-ops/shared";
import { useRecordPiece, useUndoPiece } from "@/features/production/hooks";
import { useOpenIssueMutation } from "@/features/issues/hooks";
import { BigButton } from "@/components/operator/BigButton";
import { OfflineBanner } from "@/components/operator/OfflineBanner";
import { ProgressRing } from "@/components/operator/ProgressRing";
import { ConnectionBadge } from "@/components/data/ConnectionBadge";
import { ThemeToggle } from "@/components/theme";
import {
  OPERATOR_DOUBLE_TAP_LOCK_MS,
  OPERATOR_UNDO_WINDOW_MS,
} from "@/lib/constants";
import { cn, formatClock, newIdempotencyKey, vibrate } from "@/lib/utils";
import { useOperatorQueue } from "@/stores/operator-queue";
import { useConnectionStore } from "@/stores/connection";

/**
 * Operator terminal. Fullscreen, high-contrast, no sidebar.
 * - PIECE COMPLETED: >=160px, haptics, success pulse, 600ms double-tap lock,
 *   5s undo window, idempotency key per event.
 * - Secondary issue grid: >=96px tiles, color-coded, one-tap confirm sheet.
 * - Offline queue with auto-retry on reconnect; wake-lock while mounted.
 */
export default function OperatorPage() {
  const t = useTranslations();
  const recordPiece = useRecordPiece();
  const undoPiece = useUndoPiece();
  const openIssue = useOpenIssueMutation();
  const enqueue = useOperatorQueue((s) => s.enqueue);
  const drain = useOperatorQueue((s) => s.drain);
  const connStatus = useConnectionStore((s) => s.status);

  // Machine / line / operator / work order would come from the session token;
  // they are rendered from typed data (never hardcoded business values).
  const [session] = useState({
    machineCode: "—",
    lineCode: "—",
    operatorName: "—",
    workOrder: "—",
  });
  const [completed, setCompleted] = useState(0);
  const target = 0; // comes from active work order once backend is wired
  const [shiftSeconds, setShiftSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const [undoKey, setUndoKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<IssueType | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  // Shift timer
  useEffect(() => {
    const iv = setInterval(() => setShiftSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Wake lock
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // @ts-expect-error — WakeLock types vary
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

  // Auto-retry offline queue on reconnect
  useEffect(() => {
    if (connStatus !== "live") return;
    const pending = drain();
    pending.forEach((e) => {
      if (e.kind === "piece") recordPiece.mutate(e.payload);
      else openIssue.mutate(e.payload);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connStatus]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const onPiece = () => {
    if (locked) return;
    setLocked(true);
    setTimeout(() => setLocked(false), OPERATOR_DOUBLE_TAP_LOCK_MS);
    vibrate(18);

    const key = newIdempotencyKey();
    const payload = {
      machineId: "",
      workOrderId: "",
      quantity: 1,
      idempotencyKey: key,
      occurredAt: new Date().toISOString(),
    };
    setCompleted((c) => c + 1);
    setUndoKey(key);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoKey(null), OPERATOR_UNDO_WINDOW_MS);
    showToast(t("operator.recorded"));

    if (connStatus === "live") recordPiece.mutate(payload);
    else enqueue({ kind: "piece", payload });
  };

  const onUndo = () => {
    if (!undoKey) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoPiece.mutate(undoKey);
    setCompleted((c) => Math.max(0, c - 1));
    setUndoKey(null);
  };

  const onIssueConfirm = (type: IssueType, note?: string) => {
    const payload = {
      machineId: "",
      workOrderId: null,
      type,
      note,
      idempotencyKey: newIdempotencyKey(),
      occurredAt: new Date().toISOString(),
    };
    if (connStatus === "live") openIssue.mutate(payload);
    else enqueue({ kind: "issue", payload });
    setSheet(null);
    showToast(t("operator.recorded"));
    vibrate([12, 40, 12]);
  };

  const ISSUE_ICONS: Record<IssueType, React.ReactNode> = {
    machine_issue: <AlertTriangle className="h-6 w-6" />,
    thread_empty: <Scissors className="h-6 w-6" />,
    material_missing: <Package className="h-6 w-6" />,
    quality_issue: <ScanLine className="h-6 w-6" />,
    break_pause: <Coffee className="h-6 w-6" />,
    other: <MoreHorizontal className="h-6 w-6" />,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />

      {/* Header strip */}
      <header className="flex flex-wrap items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <HeaderField label={t("operator.machine")} value={session.machineCode} />
        <HeaderField label={t("operator.line")} value={session.lineCode} />
        <HeaderField label={t("operator.operator")} value={session.operatorName} />
        <HeaderField label={t("operator.workOrder")} value={session.workOrder} />
        <div className="ml-auto flex items-center gap-3">
          <span className="font-data text-lg tabular-nums">
            {t("operator.shiftTimer")} {formatClock(shiftSeconds)}
          </span>
          <ConnectionBadge />
          <ThemeToggle />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-5">
        {/* Left: progress + primary action */}
        <section className="flex flex-col items-center justify-center gap-6 lg:col-span-3">
          <ProgressRing completed={completed} target={target} size={240} />
          <BigButton
            tone="primary"
            onClick={onPiece}
            disabled={locked}
            className={cn(
              "min-h-40 w-full max-w-xl text-3xl tracking-tight",
              !locked && recordPiece.isSuccess && "success-pulse",
            )}
            style={{ minHeight: 160 }}
          >
            <Check className="h-10 w-10" />
            {t("operator.pieceCompleted")}
          </BigButton>

          <div className="flex h-10 items-center gap-4">
            {undoKey && (
              <button
                type="button"
                onClick={onUndo}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
              >
                {t("common.undo")} · {t("operator.undoWindow")}
              </button>
            )}
            {toast && (
              <span className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--status-running)_18%,var(--surface))] px-3 py-2 text-sm text-[var(--status-running)]">
                <Check className="h-4 w-4" /> {toast}
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
              {t(`issue.${type.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`)}
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
              {sheet &&
                t(`issue.${sheet.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`)}
            </Dialog.Title>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!sheet) return;
                const note = new FormData(e.currentTarget).get("note");
                onIssueConfirm(sheet, typeof note === "string" && note ? note : undefined);
              }}
            >
              <textarea
                name="note"
                rows={2}
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
