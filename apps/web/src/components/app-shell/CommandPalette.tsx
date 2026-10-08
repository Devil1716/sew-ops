"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import { useUiStore } from "@/stores/ui";

interface Entry {
  label: string;
  href: string;
  group: "Navigate" | "Admin";
}

const ENTRIES: Entry[] = [
  { label: "Dashboard", href: "/manager/dashboard", group: "Navigate" },
  { label: "Machines", href: "/manager/machines", group: "Navigate" },
  { label: "Lines", href: "/manager/lines", group: "Navigate" },
  { label: "Work Orders", href: "/manager/work-orders", group: "Navigate" },
  { label: "Issues", href: "/manager/issues", group: "Navigate" },
  { label: "Downtime", href: "/manager/downtime", group: "Navigate" },
  { label: "Reports", href: "/manager/reports", group: "Navigate" },
  { label: "Factories", href: "/admin/factories", group: "Admin" },
  { label: "Users", href: "/admin/users", group: "Admin" },
  { label: "Shifts", href: "/admin/shifts", group: "Admin" },
  { label: "Audit log", href: "/admin/audit-log", group: "Admin" },
];

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [q, setQ] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const results = useMemo(
    () => ENTRIES.filter((e) => e.label.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-24 z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-3)]">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <Search className="h-4 w-4 text-[var(--muted)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Jump to…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            />
            <kbd className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
              <Command className="h-3 w-3" /> K
            </kbd>
          </div>
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r) => (
              <li key={r.href}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(r.href);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                >
                  <span>{r.label}</span>
                  <span className="text-xs text-[var(--muted)]">{r.group}</span>
                </button>
              </li>
            ))}
            {!results.length && (
              <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">No matches</li>
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
