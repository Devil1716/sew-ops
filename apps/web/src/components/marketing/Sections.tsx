"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowRight, Cpu, Gauge, Shield, Boxes, LineChart, FileText, Factory, Users, ClipboardCheck, Scissors, CircleCheck, Clock3, Activity } from "lucide-react";
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [travel, setTravel] = useState(0);

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

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const measure = () => setTravel(Math.max(0, track.scrollWidth - viewport.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const stages = [
    { title: t("sections.how.stage1Title"), body: t("sections.how.stage1Body"), width: 320, height: 255, top: 4 },
    { title: t("sections.how.stage2Title"), body: t("sections.how.stage2Body"), width: 280, height: 230, top: 80 },
    { title: t("sections.how.stage3Title"), body: t("sections.how.stage3Body"), width: 370, height: 270, top: 28 },
    { title: t("sections.how.stage4Title"), body: t("sections.how.stage4Body"), width: 300, height: 245, top: 104 },
  ];

  return (
    <section id="how" ref={ref} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-screen w-full items-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mb-7 flex items-end justify-between md:mb-10">
            <h2 className="text-4xl font-semibold tracking-tight md:text-6xl">
              {t("sections.how.title")}
            </h2>
            <div className="font-data text-sm text-[var(--muted)]">
              {String(Math.ceil(progress * stages.length)).padStart(2, "0")} / 0{stages.length}
            </div>
          </div>
          <div ref={viewportRef} className="relative h-[390px] overflow-hidden rounded-[var(--radius-xl)] bg-[radial-gradient(var(--border)_0.8px,transparent_0.8px)] [background-size:18px_18px] [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
            <div ref={trackRef} className="relative flex h-full w-max items-start" style={{ transform: `translateX(-${progress * travel}px)` }}>
              {stages.map((s, i) => (
                <div key={s.title} className="relative flex shrink-0 items-start" style={{ marginTop: s.top }}>
                  <article className="app-surface relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] p-4 shadow-[var(--shadow-1)] md:p-5" style={{ width: `min(${s.width}px, 72vw)`, height: s.height }}>
                    <div className="flex items-center justify-between"><span className="font-data text-[10px] uppercase tracking-widest text-[var(--muted)]">Stage 0{i + 1}</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] text-xs font-semibold text-[var(--accent)]">0{i + 1}</span></div>
                    <h3 className="text-lg font-semibold leading-tight tracking-tight md:text-xl">{s.title}</h3>
                    <p className="max-w-sm text-xs leading-relaxed text-[var(--muted)] md:text-sm">{s.body}</p>
                    <div className="mt-auto"><StageVisual stage={i} /></div>
                  </article>
                  {i < stages.length - 1 && <FlowConnector center={s.height / 2} delta={(stages[i + 1].top + stages[i + 1].height / 2) - (s.top + s.height / 2)} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageVisual({ stage }: { stage: number }) {
  const Icon = [Scissors, Users, Activity, ClipboardCheck][stage];
  return (
    <div aria-hidden="true" className={`relative flex h-12 w-full items-center justify-between overflow-hidden rounded-lg border border-[var(--border)] px-3 ${stage === 0 ? "bg-[radial-gradient(ellipse_at_25%_50%,color-mix(in_srgb,var(--accent)_24%,transparent),var(--surface))]" : stage === 1 ? "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_12%,var(--surface)),var(--surface))]" : stage === 2 ? "bg-[radial-gradient(ellipse_at_75%_25%,color-mix(in_srgb,var(--status-running)_20%,var(--surface)),var(--surface))]" : "bg-[linear-gradient(145deg,var(--surface),color-mix(in_srgb,var(--accent)_12%,var(--surface)))]"}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]"><Icon className="h-4 w-4 text-[var(--accent)]" /></span>
      <StageGraphic stage={stage} />
    </div>
  );
}

function FlowConnector({ center, delta }: { center: number; delta: number }) {
  const startY = 90;
  const endY = Math.max(14, Math.min(166, startY + delta));
  const bendY = endY > startY ? startY + 10 : startY - 10;
  const endBendY = endY > startY ? endY - 10 : endY + 10;
  return <svg aria-hidden="true" className="w-[88px] shrink-0 overflow-visible" height="180" viewBox="0 0 88 180" fill="none" style={{ marginTop: center - startY }}>
    <path d={`M0 ${startY}H30Q40 ${startY} 40 ${bendY}V${endBendY}Q40 ${endY} 50 ${endY}H88`} stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="0" cy={startY} r="4" fill="var(--accent)" />
    <circle cx="88" cy={endY} r="4" fill="var(--accent)" />
  </svg>;
}

function StageGraphic({ stage }: { stage: number }) {
  if (stage === 0) return <div className="flex items-end gap-1.5"><span className="h-6 w-2 rounded-full bg-[var(--accent)]/40"/><span className="h-10 w-2 rounded-full bg-[var(--accent)]/60"/><span className="h-7 w-2 rounded-full bg-[var(--accent)]"/></div>;
  if (stage === 1) return <div className="flex -space-x-2">{[1, 2, 3].map((n) => <span key={n} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface))] text-[10px] font-semibold text-[var(--accent)]">{n}</span>)}</div>;
  if (stage === 2) return <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--status-running)]"/><span className="text-xs font-medium">Running</span></div>;
  return <div className="space-y-1.5">{[1, 2, 3].map((n) => <span key={n} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface))]"/><span className="h-1 w-9 rounded bg-[var(--border)]"/></span>)}</div>;
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
              <RolePanel icon={Factory} eyebrow="Workspace overview" title="Every factory, one clear view" body="Set up sites, manage teams and keep access aligned with each facility." stats={[["Factories", "04"], ["Active teams", "18"], ["People", "246"]]} rows={[["North plant", "8 lines · Running"], ["Central unit", "6 lines · Running"], ["Sample room", "4 lines · Setup"]]} />
            </MockFrame>
          </Tabs.Content>

          <Tabs.Content value="manager" className="mt-8">
            <MockFrame title="Manager · Live dashboard">
              <RolePanel icon={Gauge} eyebrow="Today's production" title="Keep the floor moving" body="Spot output gaps early, rebalance work and follow up on issues while the shift is live." stats={[["Target", "1,240 pcs"], ["Completed", "986 pcs"], ["Efficiency", "82%"]]} rows={[["Line 01", "On target · 92%"], ["Line 02", "Needs attention · 68%"], ["Line 03", "On target · 88%"]]} />
            </MockFrame>
          </Tabs.Content>

          <Tabs.Content value="operator" className="mt-8">
            <MockFrame title="Operator terminal">
              <RolePanel icon={Scissors} eyebrow="Operator workspace" title="Simple actions, right at the machine" body="See your assigned operation, record completed pieces and flag a blocker in a tap." stats={[["Your operation", "Side seam"], ["Order", "WO-2048"], ["Progress", "124 / 180"]]} rows={[["Record output", "Add completed pieces"], ["Report an issue", "Machine · material · quality"]]} />
            </MockFrame>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </section>
  );
}

function RolePanel({ icon: Icon, eyebrow, title, body, stats, rows }: { icon: typeof Factory; eyebrow: string; title: string; body: string; stats: string[][]; rows: string[][] }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]"><div className="flex flex-col justify-center rounded-[var(--radius-lg)] bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_65%)] p-6 md:p-8"><span className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--muted)]"><Icon className="h-4 w-4 text-[var(--accent)]" />{eyebrow}</span><h3 className="mt-5 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{title}</h3><p className="mt-3 max-w-md leading-relaxed text-[var(--muted)]">{body}</p></div><div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] p-4 md:p-6"><div className="grid grid-cols-3 gap-2">{stats.map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--border)] p-3"><p className="text-[10px] text-[var(--muted)] md:text-xs">{label}</p><p className="mt-1 text-sm font-semibold md:text-lg">{value}</p></div>)}</div><div className="mt-5 space-y-2">{rows.map(([label, detail], i) => <div key={label} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)]"><CircleCheck className="h-4 w-4 text-[var(--accent)]" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="text-xs text-[var(--muted)]">{detail}</p></div>{i === 0 && <Clock3 className="h-4 w-4 text-[var(--muted)]" />}</div>)}</div></div></div>;
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
    { icon: Cpu, title: "Machine board", body: "See every line at a glance, from running machines to stops that need attention.", span: "md:col-span-2 md:row-span-2", visual: "machine" },
    { icon: Gauge, title: "Live KPIs", body: "Track target, actual output and efficiency through the shift.", visual: "kpi" },
    { icon: LineChart, title: "Output trends", body: "Compare hourly production and spot slowdowns early.", visual: "chart" },
    { icon: Shield, title: "Audit trail", body: "Know who recorded changes and when they happened.", visual: "audit" },
    { icon: Boxes, title: "Work orders", body: "Keep styles, quantities and line assignments in sync.", visual: "orders" },
    { icon: FileText, title: "Shift reports", body: "Hand over a clear summary of output, downtime and open issues.", span: "md:col-span-2", visual: "report" },
  ];
  return (
    <section id="features" className="py-28">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="mb-10 text-4xl font-semibold tracking-tight md:text-6xl">
          {t("sections.features.title")}
        </h2>
        <div className="grid auto-rows-[180px] grid-cols-1 gap-4 md:grid-cols-4">
          {tiles.map(({ icon: Icon, title, body, span, visual }) => (
            <SpotlightTile key={title} className={`${span ?? ""} feature-${visual}`}>
              <Icon className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">{body}</p>
              <FeatureVisual kind={visual} />
            </SpotlightTile>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureVisual({ kind }: { kind: string }) {
  const frame = "pointer-events-none absolute right-4 top-4 flex h-20 w-32 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-2 opacity-55 md:right-6 md:top-6";
  if (kind === "machine") return <div aria-hidden="true" className={`${frame} h-24 w-36`}><div className="grid w-full grid-cols-4 gap-1">{Array.from({ length: 12 }, (_, i) => <span key={i} className="h-4 rounded-sm border border-[var(--border)]" style={{ background: i % 5 === 0 ? "var(--accent)" : i % 4 === 0 ? "var(--status-running)" : "color-mix(in srgb, var(--accent) 12%, var(--surface))" }} />)}</div></div>;
  if (kind === "kpi") return <div aria-hidden="true" className={frame}><div className="flex items-center gap-2"><span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "conic-gradient(var(--accent) 0 82%, var(--border) 82% 100%)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[9px] font-semibold">82%</span></span><span className="space-y-1"><i className="block h-1 w-10 rounded bg-[var(--accent)]"/><i className="block h-1 w-7 rounded bg-[var(--border)]"/></span></div></div>;
  if (kind === "chart") return <div aria-hidden="true" className={frame}><svg viewBox="0 0 120 60" className="h-full w-full" fill="none"><path d="M4 48 23 40 39 44 57 22 75 29 94 12 116 17" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 55H116" stroke="var(--border)" strokeWidth="1"/></svg></div>;
  if (kind === "audit") return <div aria-hidden="true" className={`${frame} justify-start`}><div className="space-y-2 border-l border-[var(--accent)] pl-2"><p className="flex items-center gap-1 text-[8px]"><i className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"/>Output recorded</p><p className="flex items-center gap-1 text-[8px] text-[var(--muted)]"><i className="h-1.5 w-1.5 rounded-full bg-[var(--border)]"/>Order updated</p><p className="flex items-center gap-1 text-[8px] text-[var(--muted)]"><i className="h-1.5 w-1.5 rounded-full bg-[var(--border)]"/>Shift started</p></div></div>;
  if (kind === "orders") return <div aria-hidden="true" className={frame}><div className="w-full space-y-1.5"><p className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-[var(--muted)]">Active orders</p>{[["WO-2048", "72%"], ["WO-2051", "46%"]].map(([order, progress]) => <div key={order} className="flex items-center justify-between rounded border border-[var(--border)] px-1.5 py-1 text-[8px]"><span>{order}</span><span className="text-[var(--accent)]">{progress}</span></div>)}</div></div>;
  return <div aria-hidden="true" className={`${frame} h-24 w-36`}><div className="w-full rounded border border-[var(--border)] p-2"><p className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-[var(--muted)]">Shift summary</p><div className="grid grid-cols-3 gap-1">{["Output", "Downtime", "Issues"].map((label, i) => <span key={label} className="rounded bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-1 text-center"><b className="block text-[9px]">{["986", "24m", "02"][i]}</b><i className="text-[6px] not-italic text-[var(--muted)]">{label}</i></span>)}</div></div></div>;
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
