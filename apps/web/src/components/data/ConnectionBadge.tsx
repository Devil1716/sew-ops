"use client";
import { connectionColor, connectionLabel, useConnectionStore } from "@/stores/connection";
import { cn } from "@/lib/utils";

export function ConnectionBadge({ className }: { className?: string }) {
  const status = useConnectionStore((s) => s.status);
  const label = connectionLabel(status);
  const dotVar = connectionColor(status);
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
