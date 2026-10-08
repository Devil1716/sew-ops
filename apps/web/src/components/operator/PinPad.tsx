"use client";
import { Delete } from "lucide-react";
import { useState } from "react";
import { cn, vibrate } from "@/lib/utils";

export function PinPad({
  length = 4,
  onComplete,
}: {
  length?: number;
  onComplete: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");

  const press = (d: string) => {
    vibrate(10);
    const next = (pin + d).slice(0, length);
    setPin(next);
    if (next.length === length) onComplete(next);
  };
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="mx-auto flex max-w-xs flex-col gap-4">
      <div className="flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border border-[var(--border)]",
              pin.length > i && "bg-[var(--accent)]",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <PinKey key={n} onClick={() => press(n)}>
            {n}
          </PinKey>
        ))}
        <PinKey onClick={back} aria-label="Delete">
          <Delete className="h-5 w-5" />
        </PinKey>
        <PinKey onClick={() => press("0")}>0</PinKey>
        <PinKey onClick={() => setPin("")}>C</PinKey>
      </div>
    </div>
  );
}

function PinKey(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "tactile inline-flex h-16 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] text-2xl font-semibold",
        props.className,
      )}
    />
  );
}
