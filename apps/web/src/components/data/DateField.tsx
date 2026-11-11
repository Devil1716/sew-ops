"use client";

import { inputClass } from "@/components/admin/kit";

/** App dates read "Nov 10, 2026". The native control still stores YYYY-MM-DD. */
export function formatAppDate(isoDay: string): string {
  if (!isoDay) return "Choose a date";
  const date = new Date(`${isoDay}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Choose a date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-medium text-[color-mix(in_srgb,var(--text)_72%,transparent)]">{label}</span>
      <span className="relative inline-flex h-10 min-w-40 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm">
        <span className="pointer-events-none">{formatAppDate(value)}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className={`${inputClass} absolute inset-0 cursor-pointer opacity-0`}
        />
      </span>
    </label>
  );
}
