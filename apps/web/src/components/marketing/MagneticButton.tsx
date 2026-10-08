"use client";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MagneticButton({
  children,
  href,
  className,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${x * 0.15}px, ${y * 0.2}px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <a
      ref={ref}
      href={href ?? "#"}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[var(--accent-foreground)] shadow-[var(--shadow-2)] transition-transform will-change-transform",
        className,
      )}
    >
      {children}
    </a>
  );
}
