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

---

## 10. Part 4: Realtime on Vercel (2026-11-03)

### Current official Vercel documentation

The official pages are not fully consistent, so the older Part 1 statement that WebSockets are simply supported through Fluid Compute is not sufficient by itself:

- Vercel's [WebSockets guide](https://vercel.com/docs/functions/websockets) documents WebSocket connections on Functions, including Socket.IO. Its example says: “Socket.IO works the same way on the server,” and specifically requires `transports: ['websocket']` for the client. It describes connections as pinned to one function instance and closed at the function's maximum duration. The same page's FAQ still calls WebSocket support a public beta.
- Vercel's [WebSocket support changelog](https://vercel.com/changelog/websocket-support-is-now-generally-available) says WebSocket support became generally available on 2026-10-20.
- The general [Vercel Limits page](https://vercel.com/docs/limits) still states: “Vercel Functions do not support acting as a WebSocket server.” This conflicts with the newer dedicated guide and changelog. The dedicated guide is more specific and newer on WebSockets, but this discrepancy is recorded rather than treated as a verified deployment guarantee.
- The [Functions limits page](https://vercel.com/docs/functions/limitations) gives maximum-duration limits; the dedicated WebSockets guide says each connection closes at the function's maximum duration. Reconnect and resynchronization remain necessary.
- Vercel's [rewrites guide](https://vercel.com/docs/routing/rewrites) documents external-origin rewrites as reverse proxying and the WebSockets guide says routing Middleware, rewrites, and firewall rules run before an upgrade completes. Neither page explicitly guarantees that a Next.js external-origin rewrite will forward the WebSocket upgrade end to end. **NEEDS USER ACTION:** verify the actual `/socket.io` upgrade through the production Web project rewrite. Do not assume a successful ordinary HTTP rewrite proves WebSocket proxying.

### Changes made

- `apps/api/src/realtime/socket.adapter.ts`: production requires `REALTIME_REDIS_URL` (or `REDIS_URL`) and attaches the Socket.IO Redis Pub/Sub adapter, so factory room broadcasts can reach clients on other API instances. Redis connection errors are logged. Local non-production without Redis keeps the in-memory adapter and logs that broadcasts are instance-local. Use a Redis endpoint that supports Pub/Sub, not a REST-only Redis endpoint.
- Socket.IO server transport is restricted to WebSocket. `apps/web/src/lib/realtime/socket.ts` already uses `transports: ["websocket"]`, current-origin URL by default, and the default `/socket.io` path. Disabling Engine.IO long-polling avoids Socket.IO's sticky-session requirement; the Redis adapter alone would not solve polling session affinity. See the [Socket.IO Redis adapter documentation](https://socket.io/docs/v4/redis-adapter) and [multi-node documentation](https://socket.io/docs/v4/using-multiple-nodes/).
- Authentication and tenant isolation remain enforced by the existing handshake: the same-origin request carries the host-only `sewops_at` cookie; the gateway validates it, joins `factory:${factoryId}` or `user:${userId}`, and periodically drops revoked/expired sessions. No cross-origin socket token was added because the configured client uses the shared web origin. Exact-origin CORS remains configured for direct cross-origin use.
- `apps/web/src/features/kpis/hooks.ts`: dashboard KPI, line, trend, and downtime queries remain event-driven while the socket is live, and refetch every five seconds while it is reconnecting or offline. Socket reconnect uses the existing bounded delay backoff; `realtime.ready` invalidates cached queries to catch up after reconnect.
- Operator offline replay is unchanged: the terminal rehydrates its persisted queue and drains on initial load, browser `online`, and every eight seconds. The replay stays ordered and idempotent; it does not depend on the dashboard socket.

### Deployment and verification status

**Selected deployment posture:** Use option (c) as the guaranteed dashboard path on Vercel: five-second HTTP refetch while the socket is not confirmed live. Retain Socket.IO for event-driven updates where the Vercel upgrade path is confirmed, and use Redis fan-out for multi-instance broadcasts. This keeps the existing dashboard UI/features and avoids sticky-session dependence; the tradeoff is periodic API reads during disconnects and no verified Vercel realtime event delivery until deployment checks pass.

- API typecheck: **VERIFIED** (`npm run typecheck -w @sew-ops/api`).
- Web typecheck: **VERIFIED** (`npm run typecheck -w @sew-ops/web`).
- API production build: **VERIFIED** (`npm run build -w @sew-ops/api`, including Prisma generation and Nest build).
- Web production build: **NOT VERIFIED** in this environment. `next build` reached font compilation but failed because outbound DNS could not resolve `fonts.googleapis.com` (`next/font` could not fetch Geist, Geist Mono, and Instrument Serif). This does not establish whether a Vercel build succeeds.
- Local API runtime: **NOT VERIFIED** end to end. Nest initialized its modules and routes, then Prisma startup failed with `P1001` because no database was listening at `localhost:5432`.
- Live Redis fan-out between two API instances: **NOT VERIFIED** (no configured Redis service was available for a multi-instance rehearsal).
- Vercel WebSocket lifecycle, NestJS API function upgrade handling, and same-origin external rewrite forwarding: **NEEDS USER ACTION** (deploy with Fluid Compute enabled, configure `REALTIME_REDIS_URL`, then verify a real `/socket.io` upgrade, authenticated `realtime.ready`, and a dashboard event emitted from a different API instance). Vercel's guide documents Socket.IO with a default-exported HTTP server; this repository's existing API function entrypoint exports a request handler, so the specific NestJS serverless upgrade integration must be confirmed in deployment logs/browser network trace. Dashboard polling is the fallback if upgrade routing fails.
- Shared-origin cookie handshake: **NOT VERIFIED** in a deployed browser. The same-origin rewrite is intended to forward the host-only cookie, but should be checked alongside the upgrade.

---

## 11. Part 5: Database & E2E Verification (2026-11-04)

### Environment gate

- Docker CLI: **VERIFIED** installed and on PATH.
- Docker Engine: **NOT VERIFIED / BLOCKED**. `docker info` fails because it cannot connect to `npipe:////./pipe/dockerDesktopLinuxEngine`; the Docker Desktop Linux engine pipe is absent, indicating the engine is not running/available.
- Postgres and Redis startup: **NOT VERIFIED / BLOCKED**. No services were started. `docker-compose.yml` defines a `db` Postgres service only and has no Redis service; `scripts/start-dev.ps1` starts `docker compose up -d db` and therefore does not satisfy the Part 5 requirement to bring up both Postgres and Redis.

Per the Part 5 instruction, database-dependent work stopped here. No database was mocked and no credentials were fabricated.

### Verification steps

- Prisma migrations complete and clean on an empty database: **NOT VERIFIED** (no Postgres engine available, so migrations were not applied).
- Separate production migration command: **NOT VERIFIED** at runtime. Part 1 records the existing `prisma:migrate:deploy` script; it must be run as a separate deployment step, not from API cold-start code. No migration command was executed in Part 5.
- Seed step / initial admin availability: **NOT VERIFIED** (cannot inspect or apply seed state without the database; no seeded credentials were available to use).
- Local-only production environment setup for localhost Postgres/Redis: **NOT VERIFIED / NEEDS USER ACTION**. No `.env.production.local` or equivalent override was created because local services are unavailable; production env validation was not loosened.
- Production builds against the database: **NOT VERIFIED** (blocked before the database-backed production rehearsal).
- E2E login → create work order → record production → dashboard update over Socket.IO: **NOT VERIFIED** (blocked: no Postgres/Redis services and no verified seeded login).
- Dashboard update via five-second polling fallback: **NOT VERIFIED** (requires the app and API running against the database).

**Needed to resume:** start Docker Desktop's Linux Engine, add/provision a Redis service with `REALTIME_REDIS_URL`, rerun `scripts/start-dev.ps1` (or equivalent Compose startup for both services), apply migrations to an empty Postgres database, and identify an existing seeded user through the repository's documented seed process. Then run production builds and the specified UI flow using only that seeded account.

---

## 12. Part 5 Follow-up (2026-11-04)

This follow-up supersedes the Docker-unavailable blocker recorded above. Docker access was granted for this run; database and Redis checks below used the real local containers.

### Local production configuration added

- Added `apps/api/env.production.local.example` and `apps/web/env.production.local.example`. Copy them to the corresponding ignored `.env.production.local` files and replace local DB credentials and the JWT secret. The API example uses local Postgres, the Compose Redis port `6380`, `CORS_ORIGIN=https://localhost:3000`, and the existing explicit `ALLOW_LOCALHOST_ORIGIN=true` local rehearsal flag.
- Added `scripts/load-api-production-local-env.ps1`. Dot-source it in the API PowerShell session before running Prisma migrations or the built API; it imports the ignored local env file and requires `NODE_ENV=production`.
- No production validation code was loosened. The API env check still requires HTTPS origins, rejects localhost unless the existing local-only flag is set, and rejects placeholder JWT secrets. Keep this file local; do not deploy it.

Example local workflow (after copying/filling the env files):

```powershell
docker compose up -d db redis
. .\scripts\load-api-production-local-env.ps1
npm run prisma:migrate:deploy
npm run build
npm run start -w @sew-ops/api
# In another terminal, from the repository root:
npm run start -w @sew-ops/web
```

`prisma:migrate:deploy` is a separate migration step. Do not run it on API cold start. The one-time `apps/api/scripts/create-admin.ts` setup is an administrator bootstrap, not a seed account generator for this verification; it was not run.

### Results

- Docker Engine availability: **VERIFIED** (with the Docker Engine permission granted for this run).
- Postgres container: **VERIFIED** healthy on `127.0.0.1:5432`.
- Compose Redis service: **VERIFIED** added and healthy on `127.0.0.1:6380`; `redis-cli ping` returned `PONG`. The pre-existing Redis on port `6379` was preserved. `scripts/start-dev.ps1` now starts and waits for both `db` and `redis`; the Compose command itself was exercised, but the script's extra dev-window launch behavior was not run during the production build rehearsal.
- Empty database migration: **VERIFIED**. Created a new `sewops_migration_verify_20261104` database, confirmed it had zero public tables, ran the root `prisma:migrate:deploy` command, and Prisma applied all three checked-in migrations. `prisma migrate status` then reported the schema up to date.
- Prisma/client generation inside the standard API build: **NOT VERIFIED**. `npm run build` and the API workspace build both stopped in `prebuild: prisma generate` with Windows `EPERM` renaming the generated `query_engine-windows.dll.node`, including with elevated access. A direct Nest CLI compile completed without an error, but that does not verify the full API package build lifecycle.
- Web production build: **VERIFIED** after allowing the build to fetch fonts. Next.js compiled, type-checked, generated all 24 static pages, and completed build tracing. Four existing ESLint warnings were printed (unused `CODE_PATTERN`; three `useMemo` dependency warnings).
- Production API startup: **NOT VERIFIED**. The process passed Nest module initialization and logged successful Redis publisher/subscriber connections, then exited because port `4000` was already occupied (`EADDRINUSE`). No application data was written. The later port check found it free, but startup was not retried.
- Seed discovery: **VERIFIED** no project seed user is provided. There is no `apps/api/prisma/seed.*`, no package `seed` command, and no seed account documented in README/docs. The available `create-admin` command creates a new user interactively; it was not run.
- Login → create work order → record production → dashboard update: **NOT VERIFIED / NEEDS USER ACTION**. Stopped at the required seed-user gate: no seeded credentials exist in the repository, and no new user or credentials were created. Socket delivery and the five-second UI polling fallback were therefore not exercised end to end.
- Production builds against the migrated DB: **NOT VERIFIED** as a complete pair because the API package build's Prisma generation step failed; the web build itself completed.

**Current remaining action:** provide a project-approved seeded-user setup/credentials if this flow must be exercised. No credentials were invented and no user rows were created.

---

## 13. Part 5 Completion Attempt (2026-11-04)

- Root production build (`npm run build`): **VERIFIED**. Shared, API (including Prisma Client generation), and web builds completed with exit code 0. Next.js generated 24 static pages. Existing ESLint warnings remain in the admin factories and manager downtime/lines/machines pages.
- Local Redis URL: **VERIFIED** set to `REDIS_URL=redis://localhost:6380` in the ignored local production env. The API accepts `REDIS_URL` as a fallback alongside `REALTIME_REDIS_URL`.
- Production API startup: **VERIFIED**. Started the built NestJS API with the local production env; production checks passed, Postgres connected, Redis publisher/subscriber connected, and it listened on port 4000.
- Production web startup: **NOT VERIFIED / FAILED**. Exact error from `next start`: `Error: listen EADDRINUSE: address already in use :::3000` (`code: 'EADDRINUSE'`). Per the stop-on-first-failure instruction, no alternate port was tried and no later E2E step was attempted.
- API cleanup: **VERIFIED**. Stopped the API process started for this run and confirmed port 4000 is free. Port 3000 was also free at the final check; the conflicting listener had exited.
- Login, work-order creation, production recording, Socket.IO dashboard event, five-second fallback, cookie issuance, and refresh through the web `/v1` rewrite: **NOT VERIFIED** because the production web app did not start. No login request was made; the credential text in the request appeared as literal `<email> / <password>`, so there were no usable values to submit.
- Safe production migration step: **VERIFIED** present as root `npm run prisma:migrate:deploy` (`prisma migrate deploy --schema=apps/api/prisma/schema.prisma`). It is a separate command and is not invoked during API cold start. The empty database application was verified in Part 5 Follow-up above.

**Stop point:** production web startup failed at step 2. Remaining cookie and E2E checks require a free port 3000 and usable supplied test credentials; no data-changing requests were issued.

---

## 14. Part 5 E2E Attempt (2026-11-04)

- Production API start: **VERIFIED**. The built API started against local Postgres and connected its Redis publisher/subscriber to `redis://localhost:6380`.
- Production web start: **VERIFIED**. The built Next.js app started at `http://localhost:3000`.
- Login through the web app: **VERIFIED** using the supplied local admin login. The browser reached the authenticated admin area; its API calls used same-origin `/v1` paths.
- Work order creation: **VERIFIED** in the production web UI. Created `E2E-20261104-R1` with target quantity 3, then started it. It remains active and unassigned in the local database because the flow stopped at production recording.
- Session cookies through `/v1` rewrite: **VERIFIED**. Login returned `sewops_at` and `sewops_rt`; both were HttpOnly, Secure, SameSite=Lax, with paths `/` and `/v1/auth` respectively.
- Refresh through the web origin: **VERIFIED**. `POST http://localhost:3000/v1/auth/refresh` returned 200 and renewed both cookie names.
- Record production: **NOT VERIFIED / FAILED**. The request through the web origin reached the API and returned HTTP 403 with exact body `{"message":"Forbidden","statusCode":403}` using the supplied admin account. No production event was recorded. The requested flow stops here; no other account was used.
- Live Socket.IO dashboard update: **NOT VERIFIED**. The dashboard connection indicator showed `Reconnecting`; production recording failed before an event could be emitted.
- Five-second polling fallback: **NOT VERIFIED**. Not exercised because production recording failed at the preceding step.
- Process cleanup: **VERIFIED**. Stopped both production processes started for this attempt; confirmed ports 3000 and 4000 are free.

**Stop point:** production recording returned 403 for the supplied admin login. Completing the dashboard checks requires an authorized operator identity or a product-supported way for this admin account to record production; neither was used or changed in this run.




## 15. Part 5 E2E Follow-up (2026-11-04)

- Preflight ports 3000 and 4000: **VERIFIED** free; no listening processes were found.
- Operator credential availability: **NEEDS USER ACTION**. The request supplied the literal placeholders `<operator email> / <operator password>`, not usable credentials. No login attempt was made, and no credentials were guessed or generated.
- Assign work order `E2E-20261104-R1` to operator: **NOT VERIFIED**. Stopped before this mutation because a valid operator identity is required to confirm the correct assignment and complete the operator flow. The work order remains in its previously documented active, unassigned state.
- Operator login and production recording: **NOT VERIFIED**. No API/web processes were started and no production event was submitted.
- Admin dashboard live update: **NOT VERIFIED**. No production event was recorded.
- Socket.IO direct API origin (`localhost:4000`) versus web `/socket.io` rewrite: **NOT VERIFIED**. No live socket handshake was attempted, so the cause of the prior `Reconnecting` indicator remains undiagnosed.
- Five-second polling fallback with socket disconnected: **NOT VERIFIED**. No dashboard update event was available to observe.
- Process cleanup: **VERIFIED**. No API or web process was started during this attempt; ports 3000 and 4000 remain free.

**Stop point:** Step 1 requires usable operator credentials before assignment and operator login. Provide the actual operator email and password to continue. No users or work-order data were changed in this attempt.

## 16. Local app startup (2026-11-04)

- `scripts/start-dev.ps1`: **VERIFIED**. It started/confirmed Compose Postgres and Redis, launched API and web windows, and printed `READY` with API health responding at `http://localhost:4000/health`.
- Web UI: **VERIFIED**. Browser opened the home page at `http://127.0.0.1:3000/` (title `SewOps — Every stitch, counted.`). Navigation to `http://localhost:3000` timed out in the browser, so use `127.0.0.1` locally if needed.
- Credentials: **NEEDS USER ACTION**. The website does not display existing credentials. An admin creates an operator via **Admin → Users → New user**, choosing role **Operator**, employee code, and six-digit PIN, then assigns machine/shift in **Admin → Assignments**. No account was created during startup.
- API/web windows remain running for local use. Close the windows titled **SEW OPS API** and **SEW OPS WEB** to stop them.

## 17. E2E retry with supplied operator credentials (2026-11-04)

- Notes/preflight review: **VERIFIED**. Reviewed the prior E2E stop points. Ports were assumed free per request; the production API attempt established that port 4000 was occupied.
- Production API startup: **NOT VERIFIED / FAILED**. The local production env loader completed and Nest initialized, but binding failed with the exact error `Error: listen EADDRINUSE: address already in use :::4000` (`code: 'EADDRINUSE'`, `syscall: 'listen'`, `address: '::'`, `port: 4000`). This is the stop point; no credentials or application mutations were attempted.
- Assign `E2E-20261104-R1`, operator login, production record, admin dashboard update, Socket.IO direct-versus-rewrite comparison, and polling fallback: **NOT VERIFIED**. Stopped after the API bind failure per instruction.
- Cleanup: **VERIFIED**. The API and web listeners previously launched for local use were PID 36016 and PID 28468. Both were stopped; a post-stop listener check found no listeners on ports 3000 or 4000.
- Credentials: **VERIFIED supplied by user** for this attempt, but not used because API startup failed.

**Stop point:** exact API startup error above. Retry after ensuring port 4000 is free before starting the API; no user or work-order data was changed during this attempt.

## 18. E2E startup retry with port preflight (2026-11-04)

- Deployment notes review: **VERIFIED**. Reviewed the previous startup failure and E2E stop point before this retry.
- Port preflight: **VERIFIED**. Ports 3000 and 4000 had no listeners before starting.
- Production API startup: **VERIFIED**. Started one API instance only with `scripts/load-api-production-local-env.ps1`; Nest started on port 4000 and Redis publisher/subscriber connected. No API retry was needed.
- Production web startup: **NOT VERIFIED / FAILED**. `npm run start -w @sew-ops/web` exited with exact error: `[Error: Could not find a production build in the '.next' directory. Try building your app with 'next build' before starting the production server. https://nextjs.org/docs/messages/production-start-no-build-id]` (npm lifecycle exit code 1). No retry or build was run, following stop-on-failure.
- E2E assignment, operator login, production recording, admin dashboard update, Socket.IO origin comparison, and five-second polling fallback: **NOT VERIFIED**. Stopped at web startup failure; no login or data mutation was attempted.
- Cleanup: **VERIFIED**. Stopped the single API process started in this attempt. Post-cleanup port check found no listeners on 3000 or 4000.
- Credentials: **VERIFIED supplied by user**, not used because web startup failed.

**Stop point:** web production start reports no `apps/web/.next` build. Next authorized attempt needs the production web build present; this attempt made no changes to users or work orders.

## 19. E2E with existing operator and Socket.IO diagnosis (2026-11-04)

- Notes review and port preflight: **VERIFIED**. Read this file through section 18. Ports 3000 and 4000 were free before startup; no listener needed stopping.
- Operator login requirements: **VERIFIED** from `apps/web/src/app/(auth)/operator-login/page.tsx` and `apps/api/src/auth/auth.service.ts`: operators sign in with the active machine code and a six-digit PIN. The machine must have an active assignment for a current shift. The supplied `DEMO-OP1` is the operator employee code, as shown in Admin > Operator assignments; that existing assignment maps to machine `DEMO-M1` and shift `Demo AllDay`. Used machine code `DEMO-M1` with the user-supplied PIN. No user was created or altered.
- Production API startup: **VERIFIED**. Started once using the local production env loader; Nest listened on port 4000 and connected to Redis publisher/subscriber at the configured local Redis endpoint.
- Production web startup: **VERIFIED**. Confirmed `apps/web/.next/BUILD_ID` existed without rebuilding; started `next start` once and it reported `Ready` on port 3000.
- Admin login: **VERIFIED**. Logged in through the web origin with the supplied admin account; authenticated admin pages loaded.
- Work-order assignment: **VERIFIED**. Assigned active `E2E-20261104-R1` to `Demo Line · Whole line · Demo AllDay`, matching the operator's existing `DEMO-M1` / `Demo AllDay` station assignment. The operator terminal displayed this work order.
- Operator login and production: **VERIFIED**. The existing operator signed into `/operator-login` with `DEMO-M1` and the provided PIN. Recorded two pieces; the terminal showed `Recorded successfully` and progress `2 / 3`. No other credentials were tried.
- Admin dashboard after recording: **VERIFIED**. Dashboard showed completed 6 and Demo Line 6 after the first recording (pre-existing total included 5). After the second recording it advanced to completed 7 and Demo Line 7.
- Socket.IO direct API handshake: **VERIFIED** when using an authenticated admin cookie and configured allowed Origin `https://localhost:3000`; API `http://localhost:4000` emitted `realtime.ready` with role `admin`.
- Socket.IO through the web `/socket.io` rewrite: **NOT VERIFIED / FAILED LOCALLY**. With the same REST-verified admin cookie and allowed Origin, `http://localhost:3000` returned Socket.IO `CONNECT_ERROR timeout`; the authenticated handshake did not reach `realtime.ready` through this local Next production rewrite.
- Local HTTP Origin behavior: **VERIFIED**. Direct API handshake with actual local page Origin `http://localhost:3000` was disconnected by the API (`DISCONNECT io server disconnect`); API local production env has `CORS_ORIGIN=https://localhost:3000`, and the gateway checks Origin by exact match. Thus an HTTP localhost page is also rejected on the direct route.
- Cause of the UI's `Reconnecting` indicator: **VERIFIED LOCALLY**. The client defaults to same-origin `/socket.io` (`NEXT_PUBLIC_REALTIME_URL` is empty in the local web config); the local Next.js rewrite probe timed out. If pointing the client directly at the API, the current local HTTP Origin also fails the API's exact `CORS_ORIGIN` allowlist. In the tested local setup, the direct API route works only with the configured HTTPS Origin, while the same-origin rewrite did not complete a WebSocket handshake. This local result does not establish Vercel rewrite behavior.
- Five-second polling fallback: **VERIFIED**. Admin dashboard remained `Reconnecting` while the operator recorded a second piece; after waiting approximately 6.5 seconds without a dashboard socket connection, dashboard completed count and Demo Line progress each advanced from 6 to 7.
- Vercel deployment behavior: **NOT VERIFIED**. The direct/rewrite comparison above used local production processes; no real Vercel deployment was exercised.
- Cleanup: **VERIFIED**. Stopped the one API and one web process started for this run; confirmed no listeners remain on ports 3000 and 4000.

**Result:** operator production and dashboard polling were verified locally. Local Socket.IO works when connected directly with the configured HTTPS Origin; the local Next `/socket.io` rewrite timed out. Validate the deployed Vercel routing/Origin configuration on a real deployment before claiming hosted realtime works.
