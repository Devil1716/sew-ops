import { Card, CardTitle } from "@/components/ui/card";
import { formatCount } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: number | null | undefined;
  unit?: string;
  trend?: { delta: number; label?: string } | null;
  colorVar?: string;
  className?: string;
}

/**
 * No hardcoded value here — if value is null/undefined the card shows a dash
 * so empty systems still look intentional.
 */
export function KpiCard({ label, value, unit, trend, colorVar, className }: KpiCardProps) {
  const hasValue = typeof value === "number";
  return (
    <Card
      className={cn(
        "flex flex-col justify-between gap-2.5 p-3.5 sm:p-4 transition-all duration-200 hover:border-[color-mix(in_srgb,var(--accent)_30%,var(--border))]",
        className,
      )}
    >
      <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--muted)] truncate">
        {colorVar && (
          <span aria-hidden className="h-1.5 w-3.5 sm:w-5 shrink-0 rounded-full" style={{ background: colorVar }} />
        )}
        <span className="truncate">{label}</span>
      </CardTitle>
      <div className="flex items-baseline gap-1.5 sm:gap-2">
        <span className="font-data text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[var(--text)]">
          {hasValue ? formatCount(value!) : "—"}
        </span>
        {unit && <span className="text-xs sm:text-sm text-[var(--muted)]">{unit}</span>}
      </div>
      {trend && (
        <div className="font-data text-[11px] sm:text-xs text-[var(--muted)]">
          <span className={trend.delta >= 0 ? "text-[var(--status-running)]" : "text-[var(--status-breakdown)]"}>
            {trend.delta >= 0 ? "+" : ""}
            {trend.delta}
          </span>
          {trend.label && <span className="ml-1 text-[var(--muted)]">{trend.label}</span>}
        </div>
      )}
    </Card>
  );
}

