"use client";
import { MACHINE_STATUS_META, type MachineStatus } from "@sew-ops/shared";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Pulsing dot + label. Color/label come from the single status map. */
export function StatusDot({
  status,
  showLabel = true,
  className,
}: {
  status: MachineStatus;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = MACHINE_STATUS_META[status];
  const t = useTranslations();
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn("h-2 w-2 rounded-full", meta.pulse && "pulse-dot")}
        style={{ background: meta.colorVar, color: meta.colorVar }}
      />
      {showLabel && <span className="text-xs text-[var(--muted)]">{t(meta.labelKey)}</span>}
    </span>
  );
}
