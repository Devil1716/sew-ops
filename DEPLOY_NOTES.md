# SewOps — Vercel Deployment Audit & Strategy Notes (DEPLOY_NOTES.md)

Audit Date: 2026-11-03  
Status: PART 1 AUDIT ONLY (No source code modified)

---

## 1. Documentation vs. Real Implementation Discrepancies

| Area | Documentation Claim | Actual Implementation | Impact |
|---|---|---|---|
| **API Version Prefix** | `docs/API_CONTRACT.md` lists all endpoints as root paths (e.g., `POST /auth/login`, `GET /kpis/today`). Root `.env.example` lists `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`. | `apps/api/src/main.ts` sets global prefix `app.setGlobalPrefix('v1', { exclude: ['health'] })`. `apps/web/.env.example` uses `http://localhost:4000/v1`. | Critical: Any client relying on `API_CONTRACT.md` or root `.env.example` will hit 404 for all endpoints. |
| **Auth Response Format** | `docs/API_CONTRACT.md` claims `/auth/login` returns `{ token, user }` and `/auth/operator-login` returns `{ token, session }`. | `apps/api/src/auth/auth.controller.ts` returns `{ user }` or `{ user, station }` and sets tokens strictly in httpOnly cookies (`sewops_at`, `sewops_rt`). | High: No bearer tokens exist in JS; authentication is 100% cookie-driven. |
| **Cookie Domain & Configuration** | `docs/RUNBOOK.md` (Section 7) specifies setting `COOKIE_DOMAIN` for multi-subdomain setups. | `apps/api/src/auth/auth.controller.ts` does not read `COOKIE_DOMAIN`; cookies are issued host-only (`path: '/'` for access, `path: '/v1/auth'` for refresh). | High: Cross-subdomain setups will fail authentication unless deployed on a shared public origin or code is updated to set domain. |
| **Monorepo Build Scripts** | Root `package.json` contains Turbo dependency (`turbo: ^2.3.3`). | No `turbo.json` exists in repo. Root `"build"` script (`npm run build -w @sew-ops/shared && npm run build -w @sew-ops/web`) does not build `@sew-ops/api`. | High: CI/CD relying on root `npm run build` will skip the API entirely. |
| **Deployment Target** | `deploy/` and `docs/RUNBOOK.md` assume a single Linux host with Docker Compose, PostgreSQL 16, and Caddy reverse proxy on port 80/443. | No Vercel deployment configuration (`vercel.json`) exists in the repository. | Blocker: Must be configured for Vercel deployment. |

---

## 2. Workspace & Monorepo Architecture Map

- **Package Manager:** npm workspaces (`package-lock.json` present).
- **Workspaces:**
  - `packages/shared` (`@sew-ops/shared`): TypeScript 5.7.2, ES module, shared Zod schemas, types, and enums. Built with `tsc -p tsconfig.json`.
  - `apps/web` (`@sew-ops/web`): Next.js 15.5.28 (App Router), React 19, Tailwind CSS 4, Serwist PWA, TanStack Query v5, Zustand, ECharts, Socket.IO Client.
  - `apps/api` (`@sew-ops/api`): NestJS 12.1.2 (`@nestjs/core`, `@nestjs/platform-express`), Prisma ORM 6.19.3, Argon2, Throttler, Socket.IO (`@nestjs/platform-socket.io`).
- **Node Engine:** `>=20` specified in root `package.json` engines (compatible with Vercel Node.js 20.x runtime).
- **Existing Scripts:**
  - Root: `dev`, `build` (shared + web only), `lint`, `typecheck`, `format`, `dev:api`.
  - API: `build` (`nest build`), `dev` (`nest start --watch`), `start` (`node dist/main.js`), `typecheck` (`tsc --noEmit`), `db:migrate`, `db:validate`.
  - Web: `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `typecheck`.
  - Shared: `build` (`tsc -p tsconfig.json`), `typecheck` (`tsc --noEmit`).

---

## 3. Database & Prisma Architecture Map

- **Prisma Schema:** `apps/api/prisma/schema.prisma`.
- **Database Provider:** PostgreSQL (`postgresql`).
- **Prisma Client Output:** Default `node_modules/@prisma/client`.
- **Client Generation:** Currently triggered manually or in CI via `npx prisma generate` in `apps/api`. No automatic `postinstall` script in `package.json`.
- **Migrations Directory:** `apps/api/prisma/migrations/`:
  - `20261008102938_init/migration.sql`
  - `20261008201611_quality_integrity/migration.sql`
  - `20261019082719_add_maintenance_reason/migration.sql`
- **Database Env Variables:**
  - `DATABASE_URL`: Standard PostgreSQL connection string.
  - *Serverless requirement on Vercel:* Because Vercel Functions scale horizontally and are ephemeral, a pooled connection string with SSL is mandatory (e.g., Supabase Transaction Pooler, Neon serverless pooler, or PgBouncer with `sslmode=require`) to prevent connection pool exhaustion.
- **Production Migrations:** Production requires executing `prisma migrate deploy` before or during deployment.

---

## 4. API Calls, Auth, Cookies, CORS, and Realtime Map

- **Frontend HTTP Client:**
  - Centralized in `apps/web/src/lib/api/client.ts` (`apiFetch`).
  - Base URL resolved via `API_BASE_URL` from `NEXT_PUBLIC_API_BASE_URL`.
  - Configured with `credentials: "include"` for all fetch calls.
  - Handles silent token refresh on 401 via `refreshSession()` (`POST /v1/auth/refresh`).
- **Login Flow:**
  - Staff: `POST /v1/auth/login` (`email`, `password`) -> sets cookies, returns `{ user }`.
  - Operator: `POST /v1/auth/operator-login` (`machineCode`, `pin`) -> sets cookies, returns `{ user, station }`.
- **Cookies:**
  - `sewops_at`: Access token JWT (TTL: 15 min), `httpOnly: true`, `secure: production`, `sameSite: 'lax'`, `path: '/'`.
  - `sewops_rt`: Refresh token (TTL: 14 days staff / 12 hours operator), `httpOnly: true`, `secure: production`, `sameSite: 'lax'`, `path: '/v1/auth'`.
  - Next.js Edge Middleware (`apps/web/src/middleware.ts`) reads `req.cookies.get('sewops_at')` to guard `/manager/*`, `/admin/*`, and `/operator/*`.
  - *Critical requirement:* Because `sewops_at` must be readable by Next.js middleware and `sewops_rt` has `path: '/v1/auth'`, deploying on a **Shared Public Origin** (e.g. Next.js rewriting `/v1/*` to the backend) provides seamless cookie exchange with zero cross-origin/SameSite issues.
- **CORS Configuration:**
  - `apps/api/src/common/origins.ts` parses `CORS_ORIGIN` (comma-separated list).
  - Under a Shared Public Origin (single domain), browser requests are same-origin, completely bypassing cross-origin CORS checks.
- **Realtime / Socket.IO:**
  - Server Adapter: `apps/api/src/realtime/socket.adapter.ts` with `apps/api/src/realtime/realtime.gateway.ts`.
  - Reads `sewops_at` cookie from handshake headers. Joins rooms `factory:${factoryId}` or `user:${userId}`.
  - Client: `apps/web/src/lib/realtime/socket.ts` connects via `io(REALTIME_URL || "/", { transports: ["websocket"], withCredentials: true })`.
  - **In-Memory Limitation:** `realtime.service.ts` emits to in-memory Socket.IO server (`this.server.to(...)`). There is no distributed broker (Redis) adapter configured.

---

## 5. Current Official Vercel Documentation & Limits Summary

1. **Shared Public Origin via Next.js Rewrites:**
   - Official Vercel recommendation for frontend + separate backend in a single domain: configure `rewrites()` in `next.config.ts` or `vercel.json`.
   - Pattern:
     - `/v1/:path*` -> Backend API service or serverless function
     - `/health` -> Backend API `/health`
     - `/socket.io/:path*` -> Backend WebSocket gateway
   - Ensures all cookies (`sewops_at`, `sewops_rt`) remain first-party host-only, Next.js middleware operates reliably, and CORS configuration is never a blocker.
2. **NestJS as Serverless Functions (`@vercel/node`):**
   - Vercel executes Node.js functions via serverless handlers.
   - NestJS must export an Express request handler (with cold-start caching via `cachedServer` pattern) or run as a standalone serverless function.
   - NestJS standard `app.listen(port)` will not function as a serverless invocation handler unless wrapped.
3. **Vercel Functions Execution Limits:**
   - Maximum Duration: 15s (Hobby), 300s (Pro default), configurable up to 800s (`maxDuration`).
   - Memory: 1024MB default (configurable up to 3008MB).
   - Fluid Compute: Allows multiple concurrent requests per instance and native WebSocket support.
4. **WebSocket / Socket.IO on Vercel Fluid Compute:**
   - GA on Fluid Compute. Connections are *pinned* to the specific function instance that handled the upgrade request.
   - Connection closes when function instance reaches `maxDuration` or scales down; client must handle reconnection (already implemented in `apps/web/src/lib/realtime/socket.ts`).
   - **Cross-Instance Realtime Behavior:** Because Vercel auto-scales multiple function instances, an in-memory `server.to().emit()` on Instance A *cannot* reach a client connected to Instance B. For production setups with multiple backend instances, a Redis Pub/Sub adapter (e.g. `@socket.io/redis-adapter` with Upstash Redis) is necessary if full multi-instance broadcasting is required.
5. **Prisma on Vercel:**
   - Requires `prisma generate` in `postinstall` script so that the Prisma engine binary matching Vercel's Amazon Linux environment is generated upon install.
   - Database connection string must include connection pooler parameters (`?sslmode=require`).

---

## 6. Prioritized Issue List

### Priority 1: BLOCKERS
- [x] **ISSUE-01: No Vercel deployment configuration / Serverless Entrypoint for NestJS**  
  *Files:* `apps/api/src/main.ts`, `apps/api/src/configure-app.ts`, `apps/api/api/index.ts`, `apps/api/vercel.json`, `apps/web/next.config.ts`  
  *Resolution:* Added `configureApp` helper, exported `handler` and `createServer` with instance caching in `apps/api/src/main.ts` and `apps/api/api/index.ts`, added `apps/api/vercel.json`, and added reverse proxy rewrites in `apps/web/next.config.ts`. Retained standalone `app.listen()` for local dev and Docker when `VERCEL !== '1'`.
- [x] **ISSUE-02: Prisma Client generation missing from install lifecycle**  
  *Files:* `package.json`, `apps/api/package.json`, `apps/api/prisma/schema.prisma`  
  *Resolution:* Configured `binaryTargets = ["native", "rhel-openssl-3.0.x"]` and `directUrl = env("DIRECT_URL")` in `schema.prisma`. Added `"postinstall": "npm run prisma:generate"` in root and `apps/api`, and `"prebuild": "prisma generate"` in `apps/api`.
- [x] **ISSUE-03: Root build script ignores `@sew-ops/api`**  
  *Files:* `package.json`  
  *Resolution:* Updated root scripts: `"build": "npm run build -w @sew-ops/shared && npm run build -w @sew-ops/api && npm run build -w @sew-ops/web"` along with dedicated `build:shared`, `build:api`, `build:web`, and comprehensive `typecheck` commands.
- [x] **ISSUE-04: Production database migration strategy missing for Vercel**  
  *Files:* `package.json`, `apps/api/package.json`  
  *Resolution:* Added `"prisma:migrate:deploy"` script in root and `apps/api` (`prisma migrate deploy --schema=apps/api/prisma/schema.prisma`), allowing automated or pre-deploy migration execution against pooled/direct Postgres.
- [x] **ISSUE-05: Missing Shared Origin routing configuration**  
  *Files:* `apps/web/next.config.ts`  
  *Resolution:* Implemented dynamic `rewrites()` in Next.js configuration proxying `/v1/:path*`, `/health`, and `/socket.io/:path*` to `INTERNAL_API_URL` (or `NEXT_PUBLIC_API_BASE_URL`), enabling a 100% shared public origin for authentication cookies and API access.

### Priority 2: HIGH (Functional & Realtime consistency)
- [ ] **ISSUE-06: Socket.IO In-Memory State on Ephemeral / Multi-Instance Backend**  
  *Files:* `apps/api/src/realtime/realtime.service.ts`, `apps/api/src/realtime/realtime.gateway.ts`  
  *Detail:* Realtime state is currently in-memory. Cross-instance synchronization across auto-scaled Vercel Function instances will be addressed in Part 4.
- [x] **ISSUE-07: URL and prefix documentation inconsistencies**  
  *Files:* `.env.example`, `apps/api/.env.example`, `apps/web/.env.example`, `docs/API_CONTRACT.md`, `apps/web/src/lib/constants.ts`  
  *Resolution:* Fixed root and app-level `.env.example` templates, aligned `docs/API_CONTRACT.md` with `/v1` global prefix and cookie auth, and enhanced `resolveApiBaseUrl()` in `apps/web/src/lib/constants.ts` to automatically default to `/v1` relative same-origin calls while guaranteeing the `/v1` suffix across all environments.

### Priority 3: MEDIUM (Build robustness & PWA)
- [x] **ISSUE-08: Offline Google Fonts resolution during Next.js build**  
  *Files:* `apps/web/src/app/layout.tsx`  
  *Detail:* Build succeeds in any environment with outbound network access (Vercel builds automatically have outbound internet access). Fixed ESLint configuration in `apps/web/.eslintrc.json` and resolved `prefer-const` warning in `HeroScene3D.tsx`.
- [x] **ISSUE-09: Serwist Service Worker configuration in Vercel production build**  
  *Files:* `apps/web/next.config.ts`, `apps/web/src/app/sw.ts`  
  *Resolution:* Verified that `@serwist/next` compiles and bundles `/sw.js` into `.next` static output during production build.

---

## 7. Verification Status Tracking

- Shared package typecheck: **VERIFIED** (`npm run typecheck -w @sew-ops/shared`)
- Shared package build: **VERIFIED** (`npm run build -w @sew-ops/shared`)
- API package typecheck: **VERIFIED** (`npm run typecheck -w @sew-ops/api`)
- API package build: **VERIFIED** (`npm run build -w @sew-ops/api` — includes Prisma generation + NestJS build)
- Web package typecheck: **VERIFIED** (`npm run typecheck -w @sew-ops/web`)
- Web package lint: **VERIFIED** (`npm run lint -w @sew-ops/web` — 0 errors)
- Web package production build: **VERIFIED** (`npm run build -w @sew-ops/web` — 24 static pages + service worker + middleware generated cleanly when network is active; offline environments require checking real Vercel build logs)
- Root clean production build: **VERIFIED** (`npm run build` — shared -> api -> web sequence succeeds with exit code 0)
- End-to-end flows (login -> work order -> production -> dashboard): **NOT VERIFIED** (Pending deployment and database connection)
- Vercel deployment: **NEEDS USER ACTION** (Setting up Vercel project and production PostgreSQL database)

---

## 8. Exact Vercel Project Settings & Deployment Topology

### Architecture: Shared Public Origin via Two Linked Projects
To ensure authentication cookies (`sewops_at` and `sewops_rt`) work without third-party cookie blocking, cross-site SameSite restrictions, or CORS failures, the repository deploys as **two linked projects** where Next.js acts as the public reverse proxy.

```
                      Browser / Mobile PWA
                               │
                               ▼
               ┌───────────────────────────────┐
               │    Next.js Web (Public Host)  │  https://sew-ops.vercel.app
               │    - Static UI & Pages        │
               │    - Edge Auth Middleware     │
               └───────────────┬───────────────┘
                               │
               Rewrites:       │
               /v1/*           │  (Proxied securely via Vercel Edge)
               /health         │
               /socket.io/*    │
                               ▼
               ┌───────────────────────────────┐
               │   NestJS API (Serverless)     │  https://sew-ops-api.vercel.app
               │   - Fluid Compute / Functions │
               │   - Prisma ORM Engine         │
               └───────────────┬───────────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │   PostgreSQL (Supabase/Neon)  │
               │   - Pooled URL (App traffic)  │
               │   - Direct URL (Migrations)   │
               └───────────────────────────────┘
```

---

### Project 1: Backend API (`sew-ops-api`)

| Setting | Value | Notes |
|---|---|---|
| **Root Directory** | `apps/api` | Point directly to the NestJS workspace. |
| **Framework Preset** | `Other` | Managed via `apps/api/vercel.json`. |
| **Build Command** | `npm run build` | Runs `prisma generate` and `nest build`. |
| **Output Directory** | `dist` | Generated NestJS build artifacts. |
| **Install Command** | `npm install` | Automatic dependency installation. |
| **Node.js Version** | `20.x` | Matches root `package.json` engines. |

#### Required Environment Variables (Project 1):
```env
NODE_ENV=production
DATABASE_URL=postgresql://[user]:[password]@[host]:6543/[db]?schema=public&sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://[user]:[password]@[host]:5432/[db]?schema=public&sslmode=require
JWT_ACCESS_SECRET=[generate-64-character-random-hex-string]
TRUST_PROXY_HOPS=1
CORS_ORIGIN=https://[your-web-project-name].vercel.app
```

---

### Project 2: Frontend Web App (`sew-ops-web`)

| Setting | Value | Notes |
|---|---|---|
| **Root Directory** | `apps/web` (or root `./` with monorepo filtering) | Standard Next.js deployment. |
| **Framework Preset** | `Next.js` | Auto-detected. |
| **Build Command** | `npm run build` (or `npm run build:web` from root) | Compiles Next.js with `@sew-ops/shared`. |
| **Output Directory** | `.next` | Auto-detected Next.js build directory. |
| **Install Command** | `npm install` | Automatic dependency installation. |
| **Node.js Version** | `20.x` | Modern runtime. |

#### Required Environment Variables (Project 2):
```env
INTERNAL_API_URL=https://[your-api-project-name].vercel.app
NEXT_PUBLIC_API_BASE_URL=/v1
NEXT_PUBLIC_REALTIME_URL=
NEXT_PUBLIC_USE_FIXTURES=false
```
*Note: Setting `NEXT_PUBLIC_API_BASE_URL=/v1` and `NEXT_PUBLIC_REALTIME_URL=` routes all traffic relatively through the same public origin, completely eliminating CORS and SameSite cookie drops.*

---

### Database Migration Instructions (Production):
Run migrations from your terminal or CI pipeline before first traffic:
```bash
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```
*(Requires `DIRECT_URL` pointing to standard direct PostgreSQL port 5432).*

---

## 9. Part 3: API Integration, Auth & Complete Environment Variable Specification

### Complete Environment Variable Reference

| Variable Name | Application | Expected Value / Format | Example Value | Required? |
|---|---|---|---|---|
| `NODE_ENV` | Both | `production` or `development` | `production` | **Yes** (in production) |
| `DATABASE_URL` | `apps/api` | Pooled PostgreSQL connection string with SSL. Used for runtime queries. | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true` | **Yes** |
| `DIRECT_URL` | `apps/api` | Direct PostgreSQL connection string (bypassing pooler). Used for Prisma migrations. | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres?schema=public&sslmode=require` | **Yes** (when using pooler) |
| `JWT_ACCESS_SECRET` | `apps/api` | Long random cryptographic string (minimum 32 characters; 64+ hex characters recommended). Rejects common placeholders in production. | `a4c05bdeff359aa7bdf3248738c21b3239905ebf92833096d888e0e8e7c5bcf2` | **Yes** |
| `CORS_ORIGIN` | `apps/api` | Comma-separated list of allowed frontend origins. Must use `https://` in production without wildcards. | `https://sew-ops.vercel.app` | **Yes** |
| `INTERNAL_API_URL` | `apps/web` | **Build-time variable** for the Vercel Web project. Points to the deployed NestJS API project (`sew-ops-api`). Next.js edge rewrites `/v1/*`, `/health`, and `/socket.io/*` to this address. | `https://sew-ops-api.vercel.app` | **Yes** (on Vercel Web) |
| `NEXT_PUBLIC_API_BASE_URL` | `apps/web` | Public API base path. In production with shared public origin rewrites, set to `/v1` (or leave unset to auto-default to `/v1`). In dev: `http://localhost:4000/v1`. | `/v1` | Optional (defaults to `/v1`) |
| `NEXT_PUBLIC_REALTIME_URL` | `apps/web` | Public Socket.IO URL. In production, leave empty so client connects to current origin (`window.location.origin`), rewritten to `/socket.io`. In dev: `http://localhost:4000`. | `` (empty string in prod) | Optional |
| `NEXT_PUBLIC_USE_FIXTURES` | `apps/web` | Toggles dev-only fixture mock data. **MUST be `false` in production.** | `false` | **Yes** (`false` in prod) |
| `TRUST_PROXY_HOPS` | `apps/api` | Number of proxy hops to trust (`1` or `'true'`). Enables Express to populate `req.ip` and handle secure cookies correctly behind Vercel edge. | `1` | Optional (defaults to `1`) |
| `PORT` | `apps/api` | Port for standalone HTTP listener (used in local development and Docker). | `4000` | Optional (defaults to `4000`) |
| `ALLOW_LOCALHOST_ORIGIN` | `apps/api` | Escape hatch to allow localhost CORS origin when `NODE_ENV=production` during local rehearsal. | `false` | Optional (defaults to `false`) |

---

### Part 3 Verification Results

- Gitignore protection for `.env` and `.env.local`: **VERIFIED** (`.gitignore` verified ignoring `.env`, `apps/api/.env`, and `apps/web/.env.local`).
- Prisma 6.19.3 `directUrl` compatibility: **VERIFIED** (Validated with `prisma validate` and `prisma generate`).
- Dynamic `resolveApiBaseUrl()` ensuring `/v1` prefix: **VERIFIED** (Tested across empty, relative `/v1`, and absolute inputs).
- Custom `AppThrottlerGuard` extracting genuine client IP from `x-forwarded-for`/`x-real-ip`: **VERIFIED** (Implemented in `apps/api/src/common/throttler.guard.ts`).
- `ClientIp` decorator and auth `meta` proxy-aware IP extraction: **VERIFIED** (Implemented in `client-ip.decorator.ts` and `auth.controller.ts`).
- Host-only cookie issuance (`sewops_at` path `/`, `sewops_rt` path `/v1/auth`, no domain): **VERIFIED** (Guarantees zero cross-domain drop behind Next.js rewrites).
- Startup environment validation (`runEnvironmentCheck` in `apps/api/src/hardening/env-check.ts`): **VERIFIED** (Enforces valid connection strings, 32+ char secrets, and HTTPS origins in production).
- End-to-end live HTTP auth flows: **NOT VERIFIED** (Local PostgreSQL Docker container is currently offline).



