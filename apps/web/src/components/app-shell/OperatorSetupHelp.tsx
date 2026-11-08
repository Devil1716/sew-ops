"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Bot, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/session";

const setupSteps = [
  {
    title: "Create a line and machine",
    detail: "In Floor setup, create a line first, then add a machine to it. The machine code (for example M1) is what the operator enters.",
    href: "/admin/floor",
    action: "Open Floor setup",
  },
  {
    title: "Create a running shift",
    detail: "Add a shift that includes the current time. For testing, use 00:00 to 23:59.",
    href: "/admin/shifts",
    action: "Open Shifts",
  },
  {
    title: "Create the operator and PIN",
    detail: "In Users, create an Operator account and set a six-digit PIN. They sign in with the machine code and PIN, not their employee code.",
    href: "/admin/users",
    action: "Open Users",
  },
  {
    title: "Assign operator, machine, and shift",
    detail: "Create an assignment starting today and leave the end date blank. The assignment must be current while the shift is running.",
    href: "/admin/assignments",
    action: "Open Assignments",
  },
  {
    title: "Start a work order",
    detail: "Create a work order, use Manage to assign it to the line, then click Start. Without an active work order, the operator cannot count pieces.",
    href: "/manager/work-orders",
    action: "Open Work Orders",
  },
];

export function OperatorSetupHelp() {
  const pathname = usePathname();
  const { data: user } = useSession();
  const isAdmin = user?.role === "admin";

  if (!pathname.startsWith("/manager")) return null;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open operator setup guide"
          title="Operator setup guide"
          className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_12px_32px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <Bot className="h-6 w-6" aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed bottom-24 right-5 z-50 flex max-h-[min(78vh,680px)] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl focus:outline-none">
          <header className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] text-[var(--accent)]">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold">Set up an operator terminal</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                Follow these steps in order so the operator can sign in and count pieces.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close setup guide"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[color-mix(in_srgb,var(--text)_7%,transparent)] hover:text-[var(--text)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div className="overflow-y-auto px-5 py-4">
            {!isAdmin && (
              <p className="mb-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--surface))] px-3 py-2.5 text-xs leading-relaxed text-[var(--muted)]">
                An admin needs to complete steps 1–4. You can start the work order in step 5.
              </p>
            )}

            <ol className="space-y-4">
              {setupSteps.map((step, index) => {
                const adminOnly = index < 4;
                const canOpen = !adminOnly || isAdmin;
                return (
                  <li key={step.title} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold text-[var(--accent)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <h3 className="text-sm font-semibold">{step.title}</h3>
                        {canOpen ? (
                          <Link href={step.href} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
                            {step.action}
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Admin</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{step.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))] p-3">
              <p className="text-xs font-semibold">Operator sign-in</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                Open <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-[var(--text)]">/operator-login</code> in the operator’s browser, then enter the machine code and the PIN set by the admin.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
