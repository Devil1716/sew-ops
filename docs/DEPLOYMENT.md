# Deployment and verification guide

Status labels in this document mean:

- **VERIFIED** — actually exercised locally in this repository.
- **NOT VERIFIED** — not exercised in a real Vercel deployment, or an observed attempt failed.
- **NEEDS USER ACTION** — requires Vercel, database, DNS, or account access from the project owner.

Last reviewed: 2026-11-08.

## Architecture and current platform evidence

The recommended topology is two projects from this npm-workspaces repository: a Next.js web project and a NestJS API project. The web project's `/v1`, `/health`, and `/socket.io` rewrites target the API deployment. The browser therefore calls the web origin, keeping the host-only `sewops_at` and `sewops_rt` cookies on that origin.

**VERIFIED locally:** Vercel's current NestJS guide says a NestJS app deploys as one Vercel Function and identifies `src/main.ts` as a supported entrypoint. Vercel's WebSockets documentation says Functions can serve WebSockets on all plans, that a connection is pinned to one Function instance, that a rewrite is part of request routing before upgrade, and that Socket.IO clients should select the WebSocket transport. The Oct. 20, 2026 Vercel changelog says WebSocket support is generally available. The docs require Fluid Compute; Vercel says it is the default for projects created on or after Apr. 23, 2025. A separate Knowledge Base FAQ still says “public beta,” which is stale relative to the GA changelog.

The current official wording is: “WebSockets are available on all plans” and “A single WebSocket connection is pinned to one Vercel Function instance.” Vercel also says a reconnect may reach a different instance and recommends external storage such as Redis for shared rooms/pub-sub. The docs say upgrade requests pass through routing and rewrites, but do not explicitly promise that an external rewrite between two Vercel projects carries a Socket.IO WebSocket upgrade end to end.

**NOT VERIFIED / NEEDS USER ACTION:** Vercel's pages do not explicitly guarantee that an external rewrite from one Vercel project to a different project preserves a Socket.IO WebSocket upgrade end to end. In this repository's local production run, the authenticated API socket reached `realtime.ready` directly, while the web-origin `/socket.io` rewrite returned `CONNECT_ERROR timeout`. Verify the actual Vercel web-to-API rewrite after deployment. Until that succeeds, the web UI can remain in “Reconnecting”; dashboard data still refreshes every five seconds while disconnected.

**VERIFIED locally:** the client is WebSocket-only (`transports: ["websocket"]`), so Socket.IO long-polling and its sticky-session requirement are not used. The API requires `REDIS_URL` or `REALTIME_REDIS_URL` in production and installs the Socket.IO Redis adapter. Vercel states that reconnects may land on another Function instance, so Redis is required for cross-instance room/event fan-out. Client reconnect/backoff is implemented; the operator terminal queues offline production events and replays them using idempotency keys.

**Current limits to plan for:** with Fluid Compute, Vercel's current Functions limits document 300 seconds default and maximum for Hobby; Pro/Enterprise default 300 seconds and generally available max 800 seconds; 1,800 seconds is a separate beta maximum. WebSocket connections close at the Function's max duration, so reconnect and catch-up remain necessary. Standard Node.js Function bundle limit is 250 MB uncompressed. Confirm the latest plan settings in Vercel before deployment.

Official Vercel sources fetched for this guide:

- [WebSockets on Vercel Functions](https://vercel.com/docs/functions/websockets)
- [WebSocket support is generally available (Oct. 20, 2026)](https://vercel.com/changelog/websocket-support-is-now-generally-available)
- [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Rewrites on Vercel](https://vercel.com/docs/routing/rewrites)
- [Configuring a build](https://vercel.com/docs/builds/configure-a-build)
- [Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Set up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel Marketplace storage](https://vercel.com/docs/storage)

## Local development

Requirements: Node.js 20+, npm, and Docker Desktop. From the repository root, copy the example files and set the same Postgres password in Compose and the API connection URLs:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
npm ci
docker compose up -d db redis
npm run prisma:migrate:deploy
```

Run `npm run dev:api` and `npm run dev` in separate terminals, or use `./scripts/start-dev.ps1` to launch the database, Redis, API, and web processes. The site is `http://localhost:3000`, API health is `http://localhost:4000/health`, Postgres is `localhost:5432`, and Compose Redis is `localhost:6380`.

No Prisma seed or seeded login is supplied. Create the first local admin once with `./apps/api/scripts/create-admin.ps1`. Before running the script, make sure `DATABASE_URL` and `DIRECT_URL` are present in the PowerShell process environment; it prompts for the factory name/code and admin name/email/password. It refuses to run if an admin already exists. Operators are then created in Admin → Users and assigned a machine and shift in Admin → Operator assignments. Operators log in with the active machine code and their six-digit PIN, not an email/password.

### Local production rehearsal

The ignored `apps/api/.env.production.local` and `apps/web/.env.production.local` files are for local rehearsal only. Copy the matching `*.example` templates, fill local DB/JWT values, and keep `REDIS_URL=redis://localhost:6380`. Load API values with:

```powershell
. .\scripts\load-api-production-local-env.ps1
npm run start -w @sew-ops/api
```

In a second terminal run `npm run start -w @sew-ops/web` after a successful web build. The local production API env check intentionally still requires HTTPS origins and rejects weak JWT secrets; do not remove that check to make an HTTP localhost rehearsal appear production-like. The browser-served page at HTTP localhost has a different Origin from the example's HTTPS CORS origin, so local production Socket.IO may show “Reconnecting”; the local polling fallback was verified.

## Vercel project settings

Create two projects from the same Git repository. In **both** projects, set Root Directory to the app shown and enable **Include source files outside of the Root Directory in the Build Step** so the npm workspace root, lockfile, and `packages/shared` are available. Keep the repository-root `package-lock.json`; do not create independent app lockfiles.

| Setting | Web project | API project |
|---|---|---|
| Project | `sew-ops-i3u5` (current Vercel web project) | `sew-ops` (current Vercel API project) |
| Root Directory | `apps/web` | `apps/api` |
| Framework Preset | Next.js (set by `apps/web/vercel.json`) | NestJS (set by `apps/api/vercel.json`) |
| Install Command | `cd ../.. && npm ci` (set in app `vercel.json`) | `cd ../.. && npm ci` (set in app `vercel.json`) |
| Build Command | `cd ../.. && npm run build:web` (set in app `vercel.json`) | `cd ../.. && npm run build:api` (set in app `vercel.json`) |
| Output Directory | `.next` (default) | No static output override; the API is served by the function entrypoint under `apps/api/api/index.ts` |
| Node.js | 22.x recommended; repository engine is `>=20` | 22.x recommended; repository engine is `>=20` |

The install command returns to the workspace root so npm uses the repository lockfile and installs all workspaces; the repo's postinstall generates Prisma Client. The web build builds `@sew-ops/shared`, then the web workspace. The API build builds shared first, then the API workspace (including Nest compilation). `apps/api/api/index.ts` exports the cached Nest/Express handler and `apps/api/vercel.json` routes requests to it. Root Directory is a Vercel dashboard setting and must be set separately for each project. The API project is already configured at `apps/api`; change the no-production project `sew-ops-i3u5` to `apps/web`. **NOT VERIFIED:** Vercel has not yet exercised the committed app configuration and handler routing. Confirm the API deployment exposes `GET /health` and preserves `/v1/*` request paths before directing production traffic.

`INTERNAL_API_URL` is a **build-time** variable for the web project because `next.config.ts` creates rewrites while the deployment is built. Set it before the first web deployment and redeploy whenever it changes. For Production, set it to the API project's deployment origin, e.g. `https://sew-ops-api.vercel.app`. For Preview, use the matching API Preview deployment origin if Preview environments are enabled.

### Environment variables

Set these per project and per Vercel environment. Use separate Preview resources/secrets where practical. Never copy local `.env.production.local` values to Vercel.

**API project (`apps/api`):**

| Variable | Value / status |
|---|---|
| `DATABASE_URL` | **Required.** Hosted PostgreSQL pooled/runtime URL with TLS, e.g. provider's pooler URL and `sslmode=require`. |
| `DIRECT_URL` | **Required.** Hosted PostgreSQL direct/non-pooled URL with TLS; Prisma uses this for schema/migration connections. |
| `JWT_ACCESS_SECRET` | **Required.** Random secret, at least 32 chars; use 64+ random hex characters. Never reuse the sample. |
| `CORS_ORIGIN` | **Required.** Exact HTTPS web origin(s), comma-separated with no wildcard, e.g. `https://ops.example.com`. For production, include the final public web origin; add a stable preview origin only if needed. |
| `REALTIME_REDIS_URL` | **Required for production realtime fan-out.** Hosted Redis URL reachable from Vercel, TLS if required by provider. `REDIS_URL` is accepted as an alternative (Marketplace integrations often provide it). |
| `TRUST_PROXY_HOPS` | Set to `1` for the Vercel proxy. The app uses forwarded IP data for throttling/request context; verify spoof resistance after deployment. |
| `NODE_ENV` | Vercel-managed as `production` for Production deployments; do not enable the local-only `ALLOW_LOCALHOST_ORIGIN` flag. |
| `PORT` | Vercel-managed/not required by the serverless handler. The code uses it only in standalone mode. |
| `ALLOW_LOCALHOST_ORIGIN` | Do not set on Vercel. It is only for the local production rehearsal. |
| `REALTIME_SESSION_CHECK_MS` | Optional. Defaults to 20,000 ms; omit unless the session check interval is intentionally changed. |

**Web project (`apps/web`):**

| Variable | Value / status |
|---|---|
| `INTERNAL_API_URL` | **Required at build time.** API project's HTTPS origin. Rebuild/redeploy web after changing it. |
| `NEXT_PUBLIC_API_BASE_URL` | `/v1` so REST calls use the shared public web origin. |
| `NEXT_PUBLIC_REALTIME_URL` | Empty string so the Socket.IO client targets the same public origin and `/socket.io` rewrite. The external rewrite WebSocket path is **NOT VERIFIED** until tested on Vercel. |
| `NEXT_PUBLIC_USE_FIXTURES` | `false` in every deployed environment. |

Do not configure `COOKIE_DOMAIN`: current auth cookies are host-only, httpOnly, Secure in production, and the app does not read a cookie-domain environment variable. Do not put database, JWT, or Redis secrets in any `NEXT_PUBLIC_*` variable.

Vercel applies environment-variable changes only to new deployments; redeploy after changing build-time variables. Vercel's current WebSocket documentation says WebSockets require Fluid Compute. It is enabled by default on projects created on/after Apr. 23, 2025; check **Project Settings → Functions** and enable Fluid Compute if disabled. The Oct. 20 changelog says WebSocket support is GA, so a separate beta permission should not ordinarily be required; **NEEDS USER ACTION** if the Vercel dashboard for this account still displays an access/feature gate.

### Hosted database, migration, and initial admin

1. Provision hosted PostgreSQL and hosted Redis through Vercel Marketplace or your preferred provider. Vercel Marketplace lists Postgres providers including Neon/Supabase and Redis providers; choose a region near the API Function.
2. Put the provider's **pooled** connection string in API `DATABASE_URL`, and the provider's **direct** connection string in API `DIRECT_URL`. Keep TLS/SSL required. Connect the hosted Redis credential as `REALTIME_REDIS_URL` or `REDIS_URL`.
3. Run this migration command **once per environment before the first API traffic**, from the repository root with `DATABASE_URL` and `DIRECT_URL` set to that environment's hosted DB:

   ```powershell
   npm run prisma:migrate:deploy
   ```

   This runs `prisma migrate deploy --schema=apps/api/prisma/schema.prisma`. It is deliberately not part of function startup. **VERIFIED locally:** all three checked-in migrations were applied to an empty local PostgreSQL database and Prisma reported the database up to date. **NOT VERIFIED:** applying them to the hosted production database.
4. Bootstrap the first admin once against that same hosted database. In PowerShell, set `DATABASE_URL` and `DIRECT_URL` in the current process environment (use a secure local secret store/terminal method), then from repository root run:

   ```powershell
   .\apps\api\scripts\create-admin.ps1
   ```

   It prompts for the factory name/code and admin name/email/password and refuses to run after an admin already exists. Do not generate a seed user or run it against the wrong database. The script needs both database URLs in its process environment; the prompts do not load Vercel environment variables automatically.
5. Add operators after admin login: Admin → Users → New user (Operator, employee code, 6-digit PIN), then Admin → Operator assignments (machine and shift). Operator sign-in requires the machine code assigned for the current shift plus that PIN.

### Public domain and DNS

1. Deploy and verify both projects on their `vercel.app` URLs first.
2. Add the desired production domain only to the **web project** under **Settings → Domains**. The API remains a separate project and can use its deployment URL as the rewrite target; the browser stays on the web domain.
3. Follow the exact DNS records Vercel shows for the domain. An apex commonly uses an A record and a subdomain commonly uses a CNAME, but use `vercel domains inspect <domain>` / the dashboard's displayed values because project-specific records can differ. Verify DNS, then wait for Vercel's TLS certificate.
4. Set API `CORS_ORIGIN` to the exact final web origin, update web `INTERNAL_API_URL` to the chosen API origin, redeploy API/web as needed, and use only the HTTPS public URL for cookies.

## Post-deploy acceptance checklist

The following remain **NEEDS USER ACTION** until performed against the actual Vercel projects and hosted services:

- [ ] Open web deployment and API `GET /health`; confirm `{ status: "ok", database: "up" }`.
- [ ] Verify staff login, host-only `sewops_at` / `sewops_rt` cookies (`HttpOnly`, `Secure`, expected paths), and `POST /v1/auth/refresh` through the web origin.
- [ ] As admin, create/assign a work order; sign in as the assigned operator using machine code + PIN; record a piece; verify audit/production records.
- [ ] Confirm the dashboard advances after recording. Confirm polling still refreshes within roughly 5 seconds while Socket.IO is disconnected.
- [ ] In browser DevTools → Network → WS, verify the web-origin `wss://<web-host>/socket.io/...` handshake completes (101/connected), `realtime.ready` arrives, and a production event invalidates dashboard data. Reconnect once and verify state catches up.
- [ ] Test two concurrent API instances/connections and verify Redis fan-out reaches clients on different instances; verify reconnect and operator offline-queue replay do not double-count (idempotency).
- [ ] Check rate limiting using a **Preview/test account**, not a production admin. Send controlled failed logins from one client while varying a spoofed `X-Forwarded-For`; confirm the limit is keyed by the real client IP and cannot be reset by caller-supplied forwarded headers. Current code reads forwarded-for headers directly, so this spoof-resistance check is **NOT VERIFIED** and must be reviewed on Vercel.
- [ ] Inspect Vercel Functions/Fluid Compute settings and confirm observed duration/region/bundle size fit the plan. Confirm the WebSocket closes/reconnects cleanly at the configured duration.

If anything fails, share these redacted diagnostics:

- Vercel project name, environment (Production/Preview), deployment ID/URL, and deployment timestamp.
- Build logs for the failing project, including install/build command output and Prisma generation lines.
- API Function runtime logs with timestamp, route/status, `X-Request-Id`, and stack trace; redact cookies, JWTs, passwords, and full database/Redis URLs.
- Web browser console output and sanitized Network details for `/v1/auth/login`, `/v1/auth/refresh`, the failed API request, and WS handshake (status, URL path, response/error, timing); never send cookie values or Authorization headers.
- Vercel Root Directory, Framework Preset, Build/Install commands, relevant environment-variable **names** and whether set (not secret values), Fluid Compute status, and domain/DNS verification state.
- Hosted Postgres/Redis provider, region, health/connection status, and Prisma migration status; redact all credentials.

## Verification ledger

| Item | Status | Evidence / remaining work |
|---|---|---|
| Clean install (`npm ci`) | **NOT VERIFIED / prior Windows failure** | Earlier attempts stopped with Windows `EPERM` unlinking `node_modules/.prisma/client/query_engine-windows.dll.node`. A clean install has not been repeated in this deployment review. |
| Root production build (`npm run build`) | **VERIFIED 2026-11-08** | Shared TypeScript build, Prisma Client generation, NestJS build, and Next.js production build completed. Replaced `next/font/google` downloads with local system-font stacks so builds do not need Google Fonts network access. Next reports four existing lint warnings in admin/factories and manager downtime, lines, and machines. |
| Empty local Postgres migration | **VERIFIED** | Three migrations applied to an empty database; Prisma reported up to date. |
| Local production login/refresh, work-order assignment, operator recording, dashboard polling | **VERIFIED** | Auth cookies/refresh and two recorded pieces were exercised locally; polling advanced dashboard totals while badge showed Reconnecting. |
| Local Socket.IO API origin | **VERIFIED** | Authenticated handshake received `realtime.ready` when Origin matched configured `https://localhost:3000`. |
| Local Next web `/socket.io` rewrite | **NOT VERIFIED / failed locally** | Authenticated probe returned `CONNECT_ERROR timeout`; validate Vercel's external rewrite behavior after deploy. |
| Hosted Vercel deploy, hosted DB migration/bootstrap, public DNS, production E2E | **NEEDS USER ACTION** | Requires Vercel/provider/domain access and the post-deploy checks above. |

### Dashboard count note

**VERIFIED expected behavior from code and the local test:** `DashboardService.kpis()` sums `quantityCompleted` across active/paused work orders in the factory. Another existing order already contributed five pieces. The two E2E recordings raised the aggregate to 7 (observed 6 after the first and 7 after the second); that total is expected and does not mean two pieces were lost.
