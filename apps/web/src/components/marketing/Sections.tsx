"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  Gauge,
  LineChart,
  Shield,
  ShieldCheck,
  Boxes,
  Wifi,
  WifiOff,
} from "lucide-react";
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

/* ---- Role showcase (tabs with rich structural previews) ---- */
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

          {/* Admin tab */}
          <Tabs.Content value="admin" className="mt-8">
            <MockFrame title="Admin · Factories & floor setup">
              {/* Factories grid */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { name: "Factory A", lines: 8, machines: 64, active: true },
                  { name: "Factory B", lines: 5, machines: 40, active: true },
                  { name: "Factory C", lines: 3, machines: 24, active: false },
                ].map((f) => (
                  <div
                    key={f.name}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-[var(--text)] text-sm">{f.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          color: f.active ? "var(--status-running)" : "var(--status-offline)",
                          background: f.active
                            ? "color-mix(in srgb, var(--status-running) 12%, transparent)"
                            : "color-mix(in srgb, var(--status-offline) 12%, transparent)",
                        }}
                      >
                        {f.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-[var(--muted)]">
                      <span>{f.lines} lines</span>
                      <span>·</span>
                      <span>{f.machines} machines</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* User roles preview */}
              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Recent users
                </p>
                <div className="space-y-2">
                  {[
                    { name: "Ahmad Raza", role: "Manager", factory: "Factory A" },
                    { name: "Sana Bibi", role: "Operator", factory: "Factory B" },
                    { name: "Tariq Hussain", role: "Admin", factory: "All" },
                  ].map((u) => (
                    <div key={u.name} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text)]">{u.name}</span>
                      <span className="text-[var(--muted)]">
                        {u.role} · {u.factory}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </MockFrame>
          </Tabs.Content>

          {/* Manager tab */}
          <Tabs.Content value="manager" className="mt-8">
            <MockFrame title="Manager · Live dashboard">
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Pieces today", value: "1 240", trend: "+12%" },
                  { label: "Target", value: "1 500", trend: "83%" },
                  { label: "Open issues", value: "3", warn: true },
                  { label: "Downtime", value: "18 min", neutral: true },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {kpi.label}
                    </p>
                    <p className="mt-1 font-data text-xl font-bold text-[var(--text)]">
                      {kpi.value}
                    </p>
                    {kpi.trend && (
                      <p
                        className="text-[10px] font-semibold"
                        style={{ color: "var(--status-running)" }}
                      >
                        {kpi.trend}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Hourly bar chart mock */}
              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Hourly output
                </p>
                <div className="flex h-20 items-end gap-1">
                  {[65, 80, 55, 90, 100, 88, 72, 95, 60, 85, 78, 92].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${h}%`,
                        background:
                          i === 11
                            ? "var(--accent)"
                            : "color-mix(in srgb, var(--accent) 40%, var(--border))",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Line status mini-board */}
              <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                {["running", "running", "idle", "running", "breakdown", "running", "maintenance", "running"].map(
                  (s, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--radius-sm)] py-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-white"
                      style={{
                        background:
                          s === "running"
                            ? "var(--status-running)"
                            : s === "idle"
                              ? "var(--status-idle)"
                              : s === "breakdown"
                                ? "var(--status-breakdown)"
                                : "var(--status-maintenance)",
                      }}
                    >
                      L{i + 1}
                    </div>
                  ),
                )}
              </div>
            </MockFrame>
          </Tabs.Content>

          {/* Operator tab */}
          <Tabs.Content value="operator" className="mt-8">
            <MockFrame title="Operator terminal — machine-side tablet">
              <div className="grid grid-cols-5 gap-3">
                {/* Left: progress + big button */}
                <div className="col-span-5 flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 sm:col-span-3">
                  {/* Simple ring mock */}
                  <div className="relative flex h-28 w-28 items-center justify-center">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 42 * 0.72} ${2 * Math.PI * 42 * 0.28}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="text-center">
                      <p className="font-data text-2xl font-bold text-[var(--text)]">72%</p>
                      <p className="text-[10px] text-[var(--muted)]">864/1 200</p>
                    </div>
                  </div>
                  {/* Big button mock */}
                  <div
                    className="flex w-full items-center justify-center gap-3 rounded-[var(--radius-lg)] py-5 text-lg font-bold text-white"
                    style={{
                      background: "var(--accent)",
                      boxShadow: "0 8px 0 rgba(0,0,0,0.25), 0 8px 24px rgba(255,90,31,0.3)",
                    }}
                  >
                    <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
                    Piece completed
                  </div>
                </div>

                {/* Right: 6 issue buttons */}
                <div className="col-span-5 grid grid-cols-3 gap-2 sm:col-span-2">
                  {[
                    { label: "Thread empty", icon: "✂️" },
                    { label: "Material", icon: "📦" },
                    { label: "Quality", icon: "🔍" },
                    { label: "Machine issue", icon: "⚠️" },
                    { label: "Break", icon: "☕" },
                    { label: "Other", icon: "•••" },
                  ].map((btn) => (
                    <div
                      key={btn.label}
                      className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] py-3 text-center text-xs font-semibold text-[var(--text)]"
                    >
                      <span className="text-lg">{btn.icon}</span>
                      <span className="text-[10px] leading-tight text-[var(--muted)]">{btn.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Offline indicator */}
              <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                <Wifi className="h-3.5 w-3.5 text-[var(--status-running)]" />
                <span className="text-xs text-[var(--muted)]">
                  Online · 0 events queued
                </span>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-[var(--status-running)]">
                  Live
                </span>
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
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--status-breakdown)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--status-idle)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--status-running)" }} />
        </div>
      </div>
      {children}
    </div>
  );
}

/* ---- Bento features grid (with descriptions) ---- */
export function FeaturesBento() {
  const t = useTranslations();
  const tiles = [
    {
      icon: Cpu,
      title: "Machine board",
      body: "Every machine on the floor visible at a glance — status, current work order, and accumulated pieces.",
      span: "md:col-span-2 md:row-span-2",
    },
    {
      icon: Gauge,
      title: "Live KPIs",
      body: "Pieces completed vs. target, updated in real time via WebSocket.",
    },
    {
      icon: LineChart,
      title: "Output trends",
      body: "Hourly and shift-level charts — no refresh needed.",
    },
    {
      icon: Shield,
      title: "Audit trail",
      body: "Every write is logged with actor, timestamp and delta.",
    },
    {
      icon: Boxes,
      title: "Work orders",
      body: "Create, assign and track work orders through their full lifecycle.",
    },
    {
      icon: FileText,
      title: "Shift reports",
      body: "Auto-generated summaries with CSV export for payroll and ERP.",
      span: "md:col-span-2",
    },
  ];
  return (
    <section id="features" className="py-28">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="mb-10 text-4xl font-semibold tracking-tight md:text-6xl">
          {t("sections.features.title")}
        </h2>
        <div className="grid auto-rows-[200px] grid-cols-1 gap-4 md:grid-cols-4">
          {tiles.map(({ icon: Icon, title, body, span }) => (
            <SpotlightTile key={title} className={span}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))]">
                <Icon className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
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
        "app-surface group relative flex flex-col justify-start overflow-hidden rounded-[var(--radius-lg)] p-6 " +
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
  const pillars = [
    {
      icon: WifiOff,
      label: t("sections.security.offline"),
      detail: "Events saved locally when offline, auto-synced when the connection returns. No piece is lost.",
    },
    {
      icon: Shield,
      label: t("sections.security.audit"),
      detail: "Every action recorded with actor, timestamp and before/after delta. Immutable by design.",
    },
    {
      icon: ShieldCheck,
      label: t("sections.security.access"),
      detail: "Admin, manager, operator — each role sees exactly what they need, nothing more.",
    },
  ];

  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <h2 className="text-3xl font-semibold tracking-tight">
              {t("sections.security.title")}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:col-span-3 md:grid-cols-3">
            {pillars.map(({ icon: Icon, label, detail }, i) => (
              <div key={label} className="border-l border-[var(--border)] pl-5">
                <span className="font-data text-xs text-[var(--muted)]">0{i + 1}</span>
                <div className="mt-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-lg font-semibold">{label}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{detail}</p>
              </div>
            ))}
          </div>
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
