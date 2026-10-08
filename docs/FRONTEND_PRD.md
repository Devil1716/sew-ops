# SewOps — Frontend PRD (v0.1.0)

Three experiences in one codebase: **public site**, **Manager/Admin app**, **Operator terminal**.

## Non-negotiables
- Zero hardcoded business data in UI. Every screen renders from typed API data.
- All API calls go through `apps/web/src/lib/api/client.ts`.
- Every entity has a TypeScript type + Zod schema in `packages/shared`.
- One hook per resource; query keys centralized in `lib/api/query-keys.ts`.
- All realtime events handled in `lib/realtime/provider.tsx` (socket.io-client → TanStack cache).
- Status/enums defined once in `packages/shared/enums.ts`, mapped to color/icon/label in `packages/shared/status-map.ts`.
- No hardcoded strings — `next-intl` keys only (`src/i18n/en.json`).
- Role guards in `middleware.ts` + route groups. Backend still enforces real auth.
- Dev-only fixtures live behind `NEXT_PUBLIC_USE_FIXTURES=true` and are excluded from production builds.

## Design language — "Precision thread"
Industrial, calm, exact. Fine lines, even rhythm, tension. One accent (`#FF5A1F` / dark `#FF6B35`), neutrals do 90% of the work. Radius scale 6/10/16/24. Shadows 1/2/3.

| Area | Style | Why |
|---|---|---|
| Public nav + floating cards | Subtle glass (blur 16px, 1px hairline) | Sits over imagery/3D |
| Manager/Admin app | Flat surfaces, hairline borders, inner highlight | Dense data readability |
| Operator terminal | Tactile/skeuomorphic buttons (visible depth, press-down) | Big, obvious, satisfying |
| Hero accents | Grain overlay at 3% | Fabric feel, avoids flat digital look |

## Tech
Next.js (App Router) + TS strict, Tailwind 4 + CSS variables, shadcn/Radix primitives, Motion (Framer), GSAP + ScrollTrigger, Lenis (marketing only), R3F + drei, TanStack Query + Table, Zustand (small stores), RHF + Zod, ECharts (echarts-for-react), socket.io-client, lucide-react, next/font (Geist / Geist Mono / Instrument Serif italic), next-intl (en only), Serwist PWA.

## Build order
1. Scaffold + tokens + fonts + theme toggle
2. Base components (Button, Card, KpiCard, StatusDot, EmptyState, Skeletons)
3. App shell (sidebar, topbar, command palette)
4. **Operator terminal** (most important — design first)
5. Manager dashboard
6. Remaining app pages
7. Public site (hero 3D last — polish pass)

## Performance / quality
Lighthouse 90+ on the public site, LCP < 2.5s, DPR capped at 1.75, reduced-motion respected, WCAG AA, full keyboard nav, virtualized lists for 200+ machines.
