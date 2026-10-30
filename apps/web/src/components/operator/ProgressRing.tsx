"use client";
import { formatCount, formatPercent } from "@/lib/utils";

export function ProgressRing({
  completed,
  target,
  size = 240,
  stroke = 14,
}: {
  completed: number;
  target: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, completed / target) : 0;
  const dash = c * pct;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
          className="opacity-40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          fill="none"
          style={{ transition: "stroke-dasharray 450ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <span className="font-data text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--text)]">
          {formatCount(completed)}
        </span>
        <div className="mt-1 flex items-center gap-1 font-data text-xs sm:text-sm text-[var(--muted)] font-medium">
          <span>/ {formatCount(target)}</span>
          <span className="text-[var(--accent)] font-semibold">({formatPercent(completed, target)})</span>
        </div>
      </div>
    </div>
  );
}

