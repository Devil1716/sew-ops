"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { MagneticButton } from "@/components/marketing/MagneticButton";

const HeroScene3D = dynamic(
  () => import("@/components/marketing/HeroScene3D").then((m) => m.HeroScene3D),
  { ssr: false, loading: () => null },
);

export function Hero() {
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height + window.innerHeight;
      const seen = Math.min(total, Math.max(0, window.innerHeight - r.top));
      setProgress(seen / total);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      id="product"
      ref={ref}
      className="relative min-h-[92vh] overflow-hidden pt-32 grain"
    >
      {/* Scene occupies the right half of the hero on desktop, full-bleed below. */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-90 md:left-1/3">
        <HeroScene3D scrollProgress={progress} />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-3 py-1 text-xs text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Precision floor-to-office operations
          </p>
          <h1 className="max-w-3xl text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-tight">
            {t("hero.headlineA")}{" "}
            <span className="font-serif italic text-[var(--accent)]">
              {t("hero.headlineAccent")}
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-[var(--muted)] md:text-lg">
            {t("hero.subline")}
          </p>
          <div className="mt-10 flex items-center gap-5">
            <MagneticButton href="#contact">
              {t("hero.primaryCta")}
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
            <a
              href="#how"
              className="group inline-flex items-center gap-2 text-sm font-medium text-[var(--text)]"
            >
              {t("hero.secondaryCta")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          <dl className="mt-16 grid max-w-xl grid-cols-3 gap-6 border-t border-[var(--border)] pt-6">
            {[
              ["< 2.5s", "LCP target"],
              ["Offline-first", "Operator PWA"],
              ["Role-based", "Access control"],
            ].map(([v, k]) => (
              <div key={k} className="space-y-1">
                <dt className="font-data text-sm text-[var(--text)]">{v}</dt>
                <dd className="text-xs uppercase tracking-widest text-[var(--muted)]">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
