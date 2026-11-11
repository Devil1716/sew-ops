import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Designed empty state — illustration (abstract stitch) + next action. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  actionHref,
  className,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "app-surface flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] p-10 text-center",
        className,
      )}
    >
      <svg width="140" height="56" viewBox="0 0 140 56" fill="none" aria-hidden>
        <path
          d="M4 28 H 136"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="6 6"
        />
        <path
          d="M4 28 H 76"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="10 6"
        />
        <circle cx="76" cy="28" r="3" fill="var(--accent)" />
      </svg>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {body && <p className="max-w-sm text-sm text-[var(--muted)]">{body}</p>}
      </div>
      {actionLabel && actionHref && (
        <Button variant="primary" size="md" asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
