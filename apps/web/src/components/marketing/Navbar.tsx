"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme";

const SECTIONS = [
  { id: "product", key: "nav.product" },
  { id: "features", key: "nav.features" },
  { id: "how", key: "nav.howItWorks" },
  { id: "roles", key: "nav.roles" },
  { id: "contact", key: "nav.contact" },
];

export function Navbar() {
  const t = useTranslations();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("product");

  useEffect(() => {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
      setHidden(y > lastY && y > 120);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { threshold: 0.4 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <div
        className={cn(
          "fixed left-1/2 top-3 z-40 -translate-x-1/2 transition-all duration-300",
          hidden && "-translate-y-24 opacity-0",
        )}
      >
        <div
          className={cn(
            "glass flex items-center gap-1 rounded-full px-2 py-1.5 shadow-[var(--shadow-2)]",
            scrolled ? "backdrop-blur-xl" : "backdrop-blur-md",
          )}
          style={{ borderRadius: 999 }}
        >
          <Link href="/" className="flex items-center gap-2 px-3 py-1">
            <ThreadMark />
            <span className="text-sm font-semibold tracking-tight">SewOps</span>
          </Link>
          <ul className="hidden items-center gap-0 md:flex">
            {SECTIONS.map((s) => (
              <li key={s.id} className="relative">
                <a
                  href={`#${s.id}`}
                  className={cn(
                    "relative inline-flex items-center rounded-full px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]",
                    active === s.id && "text-[var(--text)]",
                  )}
                >
                  {t(s.key)}
                  {active === s.id && (
                    <span
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]"
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden items-center gap-1 pl-2 md:flex">
            <Link
              href="/login"
              className="rounded-full px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="#contact"
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-foreground)] shadow-[var(--shadow-1)] hover:brightness-110"
            >
              {t("nav.requestAccess")}
            </Link>
            <ThemeToggle className="ml-1 h-8 w-8 rounded-full" />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("nav.openMenu")}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)] p-6">
          <div className="flex items-center justify-between">
            <ThreadMark />
            <button
              type="button"
              aria-label={t("nav.closeMenu")}
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ul className="mt-10 space-y-4">
            {SECTIONS.map((s, i) => (
              <li key={s.id} style={{ animation: `fadeUp 500ms ${i * 60}ms both` }}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-3xl font-semibold tracking-tight"
                >
                  {t(s.key)}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center gap-3">
            <Link href="/login" className="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3 text-center">
              {t("nav.login")}
            </Link>
            <Link href="#contact" className="flex-1 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-3 text-center text-[var(--accent-foreground)]">
              {t("nav.requestAccess")}
            </Link>
          </div>
          <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none;}}`}</style>
        </div>
      )}
    </>
  );
}

function ThreadMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path d="M2 11 Q 6 2, 11 11 T 20 11" stroke="var(--accent)" strokeWidth="2" fill="none" />
      <circle cx="20" cy="11" r="1.6" fill="var(--accent)" />
    </svg>
  );
}
