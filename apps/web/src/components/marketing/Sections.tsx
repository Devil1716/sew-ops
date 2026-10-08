"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowRight, Cpu, Gauge, Shield, Boxes, LineChart, FileText } from "lucide-react";
import { MagneticButton } from "@/components/marketing/MagneticButton";

/* ---- Problem strip (pinned reveal) ---- */
export function ProblemStrip() {
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      setVisible(Math.floor(p * 4));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const lines = [1, 2, 3, 4].map((i) => t(`sections.problem.line${i}`));

  return (
    <section ref={ref} className="border-y border-[var(--border)] bg-[var(--surface)] py-28">
      <div className="mx-auto max-w-5xl px-6">
        <ol className="space-y-6">
          {lines.map((line, i) => (
            <li
              key={line}
              className="font-serif text-3xl italic leading-tight text-[var(--text)] md:text-5xl"
              style={{
                opacity: visible >= i ? 1 : 0.15,
                transform: visible >= i ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 600ms ease, transform 600ms ease",
              }}
            >
              <span className="mr-4 font-data text-sm not-italic text-[var(--muted)]">
                0{i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---- "How it works" horizontal scroll ---- */
export function HowItWorks() {
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height - vh;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / total));
      setProgress(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stages = [
    { title: t("sections.how.stage1Title"), body: t("sections.how.stage1Body") },
    { title: t("sections.how.stage2Title"), body: t("sections.how.stage2Body") },
    { title: t("sections.how.stage3Title"), body: t("sections.how.stage3Body") },
    { title: t("sections.how.stage4Title"), body: t("sections.how.stage4Body") },
  ];

  return (
    <section id="how" ref={ref} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-screen w-full items-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="text-4xl font-semibold tracking-tight md:text-6xl">
              {t("sections.how.title")}
            </h2>
            <div className="font-data text-sm text-[var(--muted)]">
              {String(Math.ceil(progress * stages.length)).padStart(2, "0")} / 0{stages.length}
            </div>
          </div>
          <div
            className="relative flex items-stretch gap-6 will-change-transform"
            style={{ transform: `translateX(-${progress * 60}%)` }}
          >
            {stages.map((s, i) => (
              <article
                key={s.title}
                className="app-surface relative flex min-h-[55vh] w-[70vw] max-w-xl shrink-0 flex-col justify-between rounded-[var(--radius-xl)] p-8 md:w-[42vw]"
              >
                <span className="font-data text-xs text-[var(--muted)]">
                  Stage 0{i + 1}
                </span>
                <h3 className="mt-6 text-3xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 text-[var(--muted)]">{s.body}</p>
                <div className="mt-auto flex items-center gap-3 pt-10">
                  <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--accent)_60%,var(--border))]" />
                  <ArrowRight className="h-4 w-4 text-[var(--accent)]" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Role showcase (tabs with structural previews) ---- */
export function RoleShowcase() {
  const t = useTranslations();
  return (
    <section id="roles" className="py-28">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="mb-10 text-4xl font-semibold tracking-tight md:text-6xl">
          {t("sections.roles.title")}
        </h2>
        <Tabs.Root defaultValue="manager" className="w-full">
          <Tabs.List className="inline-flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
            {[
              { v: "admin", k: "sections.roles.admin" },
              { v: "manager", k: "sections.roles.manager" },
              { v: "operator", k: "sections.roles.operator" },
            ].map((r) => (
              <Tabs.Trigger
                key={r.v}
                value={r.v}
                className="rounded-full px-4 py-1.5 text-sm text-[var(--muted)] data-[state=active]:bg-[var(--accent)] data-[state=active]:text-[var(--accent-foreground)]"
              >
                {t(r.k)}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="admin" className="mt-8">
            <MockFrame title="Admin · Factories">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-[var(--radius-md)] border border-[var(--border)]" />
                ))}
              </div>
            </MockFrame>
          </Tabs.Content>

          <Tabs.Content value="manager" className="mt-8">
            <MockFrame title="Manager · Live dashboard">
              <div className="grid grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-[var(--radius-md)] border border-[var(--border)]" />
                ))}
              </div>
              <div className="mt-3 h-40 rounded-[var(--radius-md)] border border-[var(--border)]" />
              <div className="mt-3 grid grid-cols-12 gap-1">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-6 rounded-[var(--radius-sm)]"
                    style={{
                      background:
                        "color-mix(in srgb, var(--status-running) " +
                        ((i * 7) % 100) +
                        "%, var(--border))",
                    }}
                  />
                ))}
              </div>
            </MockFrame>
          </Tabs.Content>

          <Tabs.Content value="operator" className="mt-8">
            <MockFrame title="Operator terminal">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 flex h-44 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] text-[var(--accent-foreground)] text-3xl font-semibold">
                  Piece completed
                </div>
                {["Thread", "Material", "Quality", "Machine", "Break", "Other"].map((l) => (
                  <div
                    key={l}
                    className="h-24 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]"
                  />
                ))}
              </div>
            </MockFrame>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </section>
  );
}

function MockFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-surface rounded-[var(--radius-xl)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-data text-xs uppercase tracking-widest text-[var(--muted)]">
          {title}
        </span>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--border)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--border)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--border)]" />
        </div>
      </div>
      {children}
    </div>
  );
}

/* ---- Bento features grid ---- */
export function FeaturesBento() {
  const t = useTranslations();
  const tiles = [
    { icon: Cpu, title: "Machine board", span: "md:col-span-2 md:row-span-2" },
    { icon: Gauge, title: "Live KPIs" },
    { icon: LineChart, title: "Output trends" },
    { icon: Shield, title: "Audit trail" },
    { icon: Boxes, title: "Work orders" },
    { icon: FileText, title: "Shift reports", span: "md:col-span-2" },
  ];
  return (
    <section id="features" className="py-28">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="mb-10 text-4xl font-semibold tracking-tight md:text-6xl">
          {t("sections.features.title")}
        </h2>
        <div className="grid auto-rows-[180px] grid-cols-1 gap-4 md:grid-cols-4">
          {tiles.map(({ icon: Icon, title, span }) => (
            <SpotlightTile key={title} className={span}>
              <Icon className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
            </SpotlightTile>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpotlightTile({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={
        "app-surface group relative flex flex-col justify-end overflow-hidden rounded-[var(--radius-lg)] p-6 " +
        (className ?? "")
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(240px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb, var(--accent) 20%, transparent), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}

/* ---- Reliability band ---- */
export function ReliabilityBand() {
  const t = useTranslations();
  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)] py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-4">
        <h2 className="text-3xl font-semibold tracking-tight md:col-span-1">
          {t("sections.security.title")}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3">
          {[
            t("sections.security.offline"),
            t("sections.security.audit"),
            t("sections.security.access"),
          ].map((l, i) => (
            <div key={l} className="border-l border-[var(--border)] pl-5">
              <span className="font-data text-xs text-[var(--muted)]">0{i + 1}</span>
              <p className="mt-2 text-lg">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- CTA + footer ---- */
export function CtaFooter() {
  const t = useTranslations();
  return (
    <section id="contact" className="py-28">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <h2 className="font-semibold leading-[0.95] tracking-tight text-[clamp(2.25rem,6vw,4.5rem)]">
          {t("sections.cta.title")}
        </h2>
        <div className="mt-10 flex items-center justify-center">
          <MagneticButton href="mailto:hello@sew-ops.app">
            {t("sections.cta.button")} <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        </div>
      </div>
      <footer className="mx-auto mt-24 flex max-w-7xl flex-col items-start justify-between gap-4 border-t border-[var(--border)] px-6 py-10 text-sm text-[var(--muted)] md:flex-row md:items-center">
        <span>© {new Date().getFullYear()} SewOps</span>
        <span className="font-data">v0.1.0 · built for the shop floor</span>
      </footer>
    </section>
  );
}
