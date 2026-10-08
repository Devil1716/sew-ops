"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "primary" | "neutral";
}

/**
 * The operator-floor button: minimum 160px tall for the primary action,
 * minimum 96px for secondary actions, tactile depth, visible press.
 */
export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps>(function BigButton(
  { className, tone = "neutral", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "tactile relative inline-flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] font-semibold text-[var(--text)]",
        tone === "primary"
          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "bg-[var(--surface)]",
        className,
      )}
    />
  );
});
