"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, Shield, User, ChevronDown } from "lucide-react";
import { disconnectSocket } from "@/lib/realtime/socket";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [role, setRole] = useState<string>("manager");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)sew_ops_role=([^;]+)/);
    if (match?.[1]) {
      setRole(match[1]);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleLogout = () => {
    // Clear auth cookie
    document.cookie = "sew_ops_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sew_ops_token");
    }
    disconnectSocket();
    setOpen(false);
    router.push("/login");
  };

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const initials = role === "admin" ? "AD" : role === "operator" ? "OP" : "MG";

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
        <span className="hidden text-xs font-medium sm:inline-block">{roleLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl backdrop-blur-lg z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-semibold text-[var(--text)]">SewOps {roleLabel}</p>
            <p className="text-[11px] text-[var(--muted)] truncate">
              {role}@sewops.internal
            </p>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
              <Shield className="h-3 w-3" />
              <span>{roleLabel} Access</span>
            </div>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(role === "admin" ? "/admin/settings" : "/manager/dashboard");
              }}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
            >
              <Settings className="h-3.5 w-3.5 text-[var(--muted)]" />
              Settings & Preferences
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/admin/factories");
              }}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
            >
              <User className="h-3.5 w-3.5 text-[var(--muted)]" />
              Switch to Admin
            </button>
          </div>

          <div className="border-t border-[var(--border)] pt-1">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
            >
              <LogOut className="h-3.5 w-3.5 text-red-500" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
