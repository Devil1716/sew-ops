"use client";
import { useConnectionStore } from "@/stores/connection";
import { cn } from "@/lib/utils";

export function ConnectionBadge({ className }: { className?: string }) {
  const status = useConnectionStore((s) => s.status);
  const label = status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Offline";
  const dotVar =
    status === "live"
      ? "var(--status-running)"
      : status === "reconnecting"
        ? "var(--status-idle)"
        : "var(--status-offline)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("h-2 w-2 rounded-full", status === "live" && "pulse-dot")}
        style={{ background: dotVar, color: dotVar }}
      />
      {label}
    </span>
  );
}
