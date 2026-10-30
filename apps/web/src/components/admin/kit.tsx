"use client";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--muted)]";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[var(--muted)] leading-relaxed">{hint}</span>}
    </label>
  );
}

export function CheckboxField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm font-medium text-[var(--text)] cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-[var(--radius-sm)] border border-[var(--border)] accent-[var(--accent)] cursor-pointer"
      />
      <span>{label}</span>
    </label>
  );
}

export function describeError(e: unknown): string {
  if (!(e instanceof ApiError)) return "No connection. Try again.";
  const payload = e.payload as { errors?: { path: string; message: string }[] } | undefined;
  if (payload?.errors?.length) {
    return payload.errors.map((x) => `${x.path || "field"}: ${x.message}`).join("; ");
  }
  return e.message;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-2.5 text-xs font-semibold text-red-400"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function ActivePill({ active }: { active: boolean }) {
  const color = active ? "var(--status-running)" : "var(--status-offline)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full", active && "pulse-dot")}
        style={{ background: color }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-xl" : "max-w-md";
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={`app-surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] ${width} -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-[var(--radius-xl)] p-5 sm:p-6 shadow-2xl border border-[var(--border)]`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Dialog.Title className="text-lg font-bold tracking-tight text-[var(--text)]">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalActions({
  onCancel,
  onSubmit,
  busy,
  submitLabel,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" disabled={busy} onClick={onSubmit}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

export function timezones(): string[] {
  try {
    const list = Intl.supportedValuesOf("timeZone");
    return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {
    return ["Asia/Kolkata", "UTC"];
  }
}

/** Codes are stored upper-case: letters, numbers and dashes. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}
export const CODE_PATTERN = /^[A-Z0-9-]{1,20}$/;