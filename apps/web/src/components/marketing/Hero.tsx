"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowRight } from "lucide-react";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import VectorWordmark from "@/components/marketing/VectorWordmark";

export function Hero() {
  const t = useTranslations();

  return (
    <section id="product" className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-8 sm:pt-32 md:pb-24 grain">
      <div className="pointer-events-none absolute inset-x-0 top-24 -z-10 mx-auto h-[32rem] max-w-6xl bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_68%)]" />
      <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)] shadow-[var(--shadow-1)]">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          Production, from floor to office
        </p>

        <h1 className="sr-only">{t("hero.headlineA")} {t("hero.headlineAccent")}</h1>
        <div className="mt-6 w-full" aria-hidden="true">
          <VectorWordmark
            text="SEWOPS"
            font={{
              fontFamily: "Arial, Helvetica, sans-serif",
              fontWeight: 800,
              fontSize: "300px",
              lineHeight: "1em",
              letterSpacing: "-0.075em",
            }}
            background="#f6f4f0"
            textColor="#1b2526"
            shade="#b94f34"
            accent="rgba(200, 90, 58, 0.82)"
            reach={320}
            damping={60}
            speed={42}
            handles={{ size: 82, spread: 23, labels: true }}
            style={{ height: "clamp(270px, 38vw, 460px)", minHeight: 270, background: "transparent" }}
          />
        </div>

        <div className="-mt-2 max-w-3xl px-2 sm:mt-0">
          <p className="font-serif text-[clamp(1.8rem,4vw,3.5rem)] italic leading-[1.02] tracking-[-0.035em]">
            {t("hero.headlineA")} <span className="text-[var(--accent)]">{t("hero.headlineAccent")}</span>
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base md:text-lg">
            {t("hero.subline")}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <MagneticButton href="#contact">
            {t("hero.primaryCta")}
            <ArrowRight className="h-4 w-4" />
          </MagneticButton>
          <a href="#how" className="group inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]">
            {t("hero.secondaryCta")}
            <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
          </a>
        </div>

        <dl className="mt-14 grid w-full max-w-3xl grid-cols-3 divide-x divide-[var(--border)] border-y border-[var(--border)] py-5 text-left sm:mt-16 sm:py-6">
          {[
            ["Live", "Line visibility"],
            ["Offline-first", "Operator terminal"],
            ["Every shift", "Audit-ready records"],
          ].map(([value, label]) => (
            <div key={label} className="px-3 sm:px-7">
              <dt className="font-data text-xs font-medium text-[var(--text)] sm:text-sm">{value}</dt>
              <dd className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] sm:text-[11px] sm:tracking-[0.16em]">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
