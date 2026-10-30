"use client";
import { CloudOff } from "lucide-react";
import { useOperatorQueue } from "@/stores/operator-queue";

export function OfflineBanner() {
  const size = useOperatorQueue((s) => s.queue.length);
  if (!size) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2.5 border-b-2 border-amber-500/50 bg-amber-500/20 px-4 py-2.5 text-xs sm:text-sm font-semibold text-amber-200"
    >
      <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-amber-400" />
      <CloudOff className="h-4 w-4 shrink-0 text-amber-300" />
      <span>{size} events saved offline · waiting to sync</span>
    </div>
  );
}

