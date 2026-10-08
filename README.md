# SewOps

Three experiences in one codebase: public site, Manager/Admin app, Operator terminal. Zero hardcoded business data — every screen renders from typed API data so the backend plugs in without rewriting components.

## Quick start

```bash
cp .env.example apps/web/.env.local   # set NEXT_PUBLIC_API_BASE_URL etc.
npm install
npm run dev                           # web app on http://localhost:3000
```

Routes:
- `/` — marketing site (glass nav, procedural 3D hero, scroll sections)
- `/login`, `/operator-login` — auth (UI-level role guard lives in `middleware.ts`)
- `/manager/dashboard`, `/manager/…`, `/admin/…` — authenticated app
- `/operator` — fullscreen operator terminal (PWA, offline queue, wake-lock)

Structure and rules are in `docs/FRONTEND_PRD.md`; the wire contract the backend must satisfy is in `docs/API_CONTRACT.md`.

## The one rule that keeps this from vibe-coding
No data inside components. Components take props; pages call hooks from `src/features/*/hooks.ts`; hooks call `lib/api/client.ts`; realtime events update the TanStack cache from `lib/realtime/provider.tsx`. Dev-only placeholder shapes live behind `NEXT_PUBLIC_USE_FIXTURES=true` and never ship to production.
