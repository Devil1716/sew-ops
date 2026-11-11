"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useLinesList } from "@/features/lines/hooks";
import { useMachineBoard } from "@/features/machines/live";
import { useUsersList } from "@/features/people/hooks";
import { useShiftsList } from "@/features/shifts/hooks";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    key: "line",
    title: "Create a line",
    detail: "A line has to exist before machines or work can be placed on the floor.",
    href: "/admin/floor",
  },
  {
    key: "machines",
    title: "Add machines",
    detail: "Operators sign in with a machine code, so each station needs one.",
    href: "/admin/floor",
  },
  {
    key: "shifts",
    title: "Add shifts",
    detail: "A shift that covers the current time is required before anyone can sign in.",
    href: "/admin/shifts",
  },
  {
    key: "operators",
    title: "Invite operators",
    detail: "Create an operator, set a PIN, then assign them to a machine and shift.",
    href: "/admin/users",
  },
] as const;

/** First-run steps. Hidden once every step is done, and while the counts are still loading. */
export function SetupChecklist() {
  const { data: me } = useSession();
  const lines = useLinesList();
  const machines = useMachineBoard();
  const shifts = useShiftsList();
  const users = useUsersList();
  const isAdmin = me?.role === "admin";

  if (!lines.isSuccess || !machines.isSuccess || !shifts.isSuccess || !users.isSuccess) return null;

  const done: Record<(typeof STEPS)[number]["key"], boolean> = {
    line: lines.data.length > 0,
    machines: machines.data.length > 0,
    shifts: shifts.data.some((s) => s.isActive),
    operators: users.data.some((u) => u.role === "operator" && u.isActive),
  };
  if (STEPS.every((step) => done[step.key])) return null;

  return (
    <section className="app-surface space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Set up the floor</h2>
        <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--text)_72%,transparent)]">
          {isAdmin
            ? "Finish these once. The live dashboard fills in after operators start recording."
            : "An admin finishes these once. You can plan work orders as soon as a line exists."}
        </p>
      </div>
      <ol className="grid gap-3 md:grid-cols-2">
        {STEPS.map((step, index) => {
          const complete = done[step.key];
          return (
            <li
              key={step.key}
              className={cn(
                "flex gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3",
                complete && "opacity-70",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  complete
                    ? "bg-[color-mix(in_srgb,var(--status-running)_16%,transparent)] text-[var(--status-running)]"
                    : "border border-[var(--border)] text-[var(--accent)]",
                )}
              >
                {complete ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{step.title}</p>
                  {complete ? (
                    <span className="text-xs text-[var(--status-running)]">Done</span>
                  ) : isAdmin ? (
                    <Link href={step.href} className="text-xs font-medium text-[var(--accent)] hover:underline">
                      Open
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">Admin</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[color-mix(in_srgb,var(--text)_70%,transparent)]">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
