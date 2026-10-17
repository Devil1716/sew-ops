"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Settings, Shield, ChevronDown } from "lucide-react";
import { performLogout, useSession } from "@/lib/auth/session";
import { ChangePasswordModal } from "@/components/app-shell/ChangePasswordModal";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: user } = useSession();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const roleLabel = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "";
  const initials = user
    ? user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("")
    : "··";

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 pr-2 text-sm text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--text)_6%,var(--surface))] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-xs font-medium sm:inline-block">{user?.name ?? ""}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl backdrop-blur-lg">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="truncate text-xs font-semibold text-[var(--text)]">{user?.name ?? "Loading…"}</p>
            <p className="truncate text-[11px] text-[var(--muted)]">{user?.email ?? ""}</p>
            {user && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                <Shield className="h-3 w-3" />
                <span>{roleLabel}</span>
              </div>
            )}
          </div>

          <div className="space-y-0.5 py-1">
            {user?.role === "admin" && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/admin/settings");
                }}
                className={itemClass}
              >
                <Settings className="h-3.5 w-3.5 text-[var(--muted)]" />
                Settings
              </button>
            )}
            {user && user.role !== "operator" && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPasswordOpen(true);
                }}
                className={itemClass}
              >
                <KeyRound className="h-3.5 w-3.5 text-[var(--muted)]" />
                Change password
              </button>
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-1">
            <button
              type="button"
              onClick={() => void performLogout()}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
            >
              <LogOut className="h-3.5 w-3.5 text-red-500" />
              Log out
            </button>
          </div>
        </div>
      )}

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}