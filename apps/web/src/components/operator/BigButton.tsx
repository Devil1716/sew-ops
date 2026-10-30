"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "primary" | "neutral" | "danger";
}

/**
 * The operator-floor button: minimum 160px tall for the primary action,
 * minimum 96px for secondary actions, tactile depth, visible press.
 * Meets the 64px minimum touch target requirement for bright-light shop-floor use.
 */
export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps>(function BigButton(
  { className, tone = "neutral", disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      {...props}
      className={cn(
        "tactile relative inline-flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] font-bold tracking-tight select-none transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]",
        "disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none",
        tone === "primary"
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_8px_24px_rgba(255,90,31,0.35)] active:translate-y-1.5"
          : tone === "danger"
            ? "bg-[var(--status-breakdown)] text-white shadow-[0_8px_24px_rgba(220,38,38,0.3)] active:translate-y-1.5"
            : "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] shadow-[var(--shadow-2)] hover:border-[color-mix(in_srgb,var(--text)_25%,var(--border))] active:translate-y-1",
        className,
      )}
    />
  );
});

