import { Providers } from "@/components/providers-root";
import messages from "@/i18n/en.json";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers messages={messages} defaultTheme="light">
      <div className="flex min-h-screen">
        {/* Left decorative panel — hidden on mobile, appears at md+ */}
        <div
          className="hidden md:flex md:w-[420px] lg:w-[480px] xl:w-[520px] flex-col justify-between p-10 relative overflow-hidden"
          style={{ background: "var(--text)" }}
        >
          {/* Animated thread-line grid */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="auth-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#auth-grid)" />
          </svg>

          {/* Accent thread accent lines — diagonal */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line
                key={i}
                x1={-200 + i * 120}
                y1="0"
                x2={200 + i * 120}
                y2="100%"
                stroke="var(--accent)"
                strokeWidth="1"
              />
            ))}
          </svg>

          {/* Big accent circle */}
          <div
            aria-hidden
            className="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
          />
          <div
            aria-hidden
            className="absolute -left-20 -bottom-20 h-[320px] w-[320px] rounded-full opacity-8"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
          />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              S
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">SewOps</span>
          </div>

          {/* Brand copy */}
          <div className="relative z-10 space-y-5">
            <blockquote className="space-y-3">
              <p
                className="font-serif italic leading-snug text-white/90"
                style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)" }}
              >
                "Every piece counted.{"\u00A0"}Every second visible."
              </p>
              <footer className="text-sm text-white/45 font-medium tracking-wide uppercase">
                Real-time factory operations
              </footer>
            </blockquote>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                "Machine-side counting",
                "Offline-first PWA",
                "Live floor status",
                "Role-based access",
              ].map((f) => (
                <span
                  key={f}
                  className="rounded-full border px-3 py-1 text-xs font-medium text-white/60"
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: form panel */}
        <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg)] px-6 py-12">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 md:hidden">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              S
            </span>
            <span className="text-base font-semibold tracking-tight text-[var(--text)]">SewOps</span>
          </div>
          {children}
        </div>
      </div>
    </Providers>
  );
}
