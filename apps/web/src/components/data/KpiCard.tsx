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
    <Card className={cn("flex flex-col gap-3", className)}>
      <CardTitle className="flex items-center gap-2">
        {colorVar && (
          <span aria-hidden className="h-1.5 w-6 rounded-full" style={{ background: colorVar }} />
        )}
        {label}
      </CardTitle>
      <div className="flex items-baseline gap-2">
        <span className="font-data text-4xl font-semibold tracking-tight text-[var(--text)]">
          {hasValue ? formatCount(value!) : "—"}
        </span>
        {unit && <span className="text-sm text-[var(--muted)]">{unit}</span>}
      </div>
      {trend && (
        <div className="font-data text-xs text-[var(--muted)]">
          {trend.delta >= 0 ? "+" : ""}
          {trend.delta}
          {trend.label && <span className="ml-1">{trend.label}</span>}
        </div>
      )}
    </Card>
  );
}
