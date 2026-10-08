"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--accent-foreground)] hover:brightness-110 shadow-[var(--shadow-1)]",
        secondary:
          "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[color-mix(in_srgb,var(--text)_5%,var(--surface))]",
        ghost: "text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]",
        destructive:
          "bg-[var(--status-breakdown)] text-white hover:brightness-110",
        tactile:
          "tactile bg-[var(--surface)] text-[var(--text)] font-semibold tracking-tight",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-[var(--radius-sm)]",
        md: "h-10 px-4 text-sm rounded-[var(--radius-md)]",
        lg: "h-12 px-6 text-base rounded-[var(--radius-md)]",
        xl: "h-14 px-8 text-lg rounded-[var(--radius-lg)]",
        operator: "min-h-24 px-6 text-xl rounded-[var(--radius-lg)]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
