"use client";
/**
 * 3D Flip Card Primitive
 * Adapted from Uiverse.io by joe-watson-sbf - MIT License.
 *
 * Accessibility & Features:
 * - Tap/Click toggles flip state.
 * - Keyboard: Tab focusable (tabIndex={0}), Enter / Space toggles flip.
 * - Screen readers: role="button", aria-expanded={isFlipped}.
 * - Prefers-reduced-motion: automatically displays both faces stacked in normal flow (handled in globals.css).
 */
import { forwardRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FlipCardProps extends HTMLAttributes<HTMLDivElement> {
  front: ReactNode;
  back: ReactNode;
  frontClassName?: string;
  backClassName?: string;
}

export const FlipCard = forwardRef<HTMLDivElement, FlipCardProps>(function FlipCard(
  { front, back, className, frontClassName, backClassName, ...props },
  ref,
) {
  const [flipped, setFlipped] = useState(false);

  const toggle = () => setFlipped((prev) => !prev);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="button"
      aria-expanded={flipped}
      data-flipped={flipped ? "true" : "false"}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "flip-card rounded-[var(--radius-xl)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] select-none",
        className,
      )}
      {...props}
    >
      <div className="flip-card-inner">
        <div className={cn("flip-card-front", frontClassName)}>{front}</div>
        <div className={cn("flip-card-back", backClassName)}>{back}</div>
      </div>
    </div>
  );
});
