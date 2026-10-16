"use client";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";

export const inputClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[var(--muted)]">{hint}</span>}
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
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
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
    <p role="alert" className="text-sm text-red-500">
      {message}
    </p>
  );
}

export function ActivePill({ active }: { active: boolean }) {
  const color = active ? "var(--status-running)" : "var(--status-offline)";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={`app-surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full ${width} -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-[var(--radius-lg)] p-6`}
        >
          <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="text-sm text-[var(--muted)]">{description}</Dialog.Description>
          )}
          {children}
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
    <div className="flex justify-end gap-2">
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