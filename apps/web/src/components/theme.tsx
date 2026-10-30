"use client";
/**
 * Minimal theme provider (we don't pull in next-themes to keep deps slim).
 * - defaultTheme is per-area ("dark" for app/operator, "light" for marketing).
 * - User choice is persisted and overrides the default.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

const STORAGE_KEY = "sew_ops_theme";

export function ThemeRoot({
  children,
  defaultTheme = "light",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    const saved = (typeof window !== "undefined"
      ? (window.localStorage.getItem(STORAGE_KEY) as Theme | null)
      : null);
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}

/**
 * Lightweight theme toggle for the product (Topbar, manager, operator, admin).
 * - Animates only during the 200ms transition between light and dark.
 * - Zero ambient animation loops.
 * - Accessible: role="switch", aria-checked, keyboard focus ring.
 */
export function ProductThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle theme"
      onClick={toggle}
      className={
        "group relative inline-flex h-9 w-14 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] " +
        (className ?? "")
      }
    >
      <span className="sr-only">Toggle theme</span>
      <span
        className={
          "pointer-events-none flex h-7 w-7 transform items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] shadow-sm transition-transform duration-200 " +
          (isDark ? "translate-x-5 text-amber-300" : "translate-x-0 text-amber-600")
        }
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

/**
 * Celestial Skybox Theme Switch
 * Adapted from Uiverse.io by mamyapro123 - MIT License.
 * Used exclusively on the marketing navbar.
 */
export function SkyboxThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <label
      className={"theme-switch cursor-pointer " + (className ?? "")}
      aria-label="Toggle theme"
    >
      <input
        type="checkbox"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle theme"
        className="theme-switch__checkbox"
        checked={isDark}
        onChange={toggle}
      />
      <span className="theme-switch__container">
        <span className="theme-switch__clouds" />
        <span className="theme-switch__stars-cluster">
          <span className="star" />
          <span className="star" />
          <span className="star" />
          <span className="star" />
          <span className="star" />
        </span>
        <span className="theme-switch__aurora" />
        <span className="theme-switch__shooting-star" />
        <span className="theme-switch__shooting-star-2" />
        <span className="theme-switch__meteor" />
        <span className="theme-switch__comets">
          <span className="comet" />
          <span className="comet" />
        </span>
        <span className="theme-switch__circle-container">
          <span className="theme-switch__sun-moon-container">
            <span className="theme-switch__moon">
              <span className="theme-switch__spot" />
              <span className="theme-switch__spot" />
              <span className="theme-switch__spot" />
            </span>
          </span>
        </span>
      </span>
    </label>
  );
}

/**
 * Main ThemeToggle component.
 * By default renders the lightweight ProductThemeToggle for app shell.
 * When variant="skybox", renders the celestial animated skybox for marketing.
 */
export function ThemeToggle({
  className,
  variant = "product",
}: {
  className?: string;
  variant?: "product" | "skybox";
}) {
  if (variant === "skybox") {
    return <SkyboxThemeToggle className={className} />;
  }
  return <ProductThemeToggle className={className} />;
}

