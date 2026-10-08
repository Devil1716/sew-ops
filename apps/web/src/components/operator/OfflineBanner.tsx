"use client";
import { CloudOff } from "lucide-react";
import { useOperatorQueue } from "@/stores/operator-queue";

export function OfflineBanner() {
  const size = useOperatorQueue((s) => s.queue.length);
  if (!size) return null;
  return (
    <div className="flex items-center justify-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--status-idle)_18%,var(--surface))] px-4 py-2 text-sm font-medium">
      <CloudOff className="h-4 w-4" />
      <span>{size} events waiting to sync</span>
    </div>
  );
}
