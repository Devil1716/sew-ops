import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--text)_8%,transparent)]",
        className,
      )}
    />
  );
}

export function KpiSkeleton() {
  return (
    <div className="app-surface space-y-3 rounded-[var(--radius-lg)] p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
