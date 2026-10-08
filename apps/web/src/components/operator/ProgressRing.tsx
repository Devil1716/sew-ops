"use client";
import { formatCount, formatPercent } from "@/lib/utils";

export function ProgressRing({
  completed,
  target,
  size = 220,
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
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={c * 0.25}
          fill="none"
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data text-4xl font-semibold tracking-tight">
          {formatCount(completed)}
        </span>
        <span className="font-data text-xs text-[var(--muted)]">
          / {formatCount(target)} · {formatPercent(completed, target)}
        </span>
      </div>
    </div>
  );
}
