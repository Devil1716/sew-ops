# Sew Ops

Sew Ops combines a public site, Manager/Admin workspace, and an offline-capable Operator terminal. The Next.js frontend uses a NestJS API; PostgreSQL stores the business data and Redis coordinates Socket.IO across API instances.

## Local development

Requirements: Node.js 20+, npm, and Docker Desktop.

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
# Set POSTGRES_PASSWORD in .env to the same value used in the API DATABASE_URL/DIRECT_URL.
npm ci
docker compose up -d db redis
npm run prisma:migrate:deploy
```

Then run `npm run dev:api` and `npm run dev` in separate terminals. The API is at `http://localhost:4000`, the website at `http://localhost:3000`; Compose maps PostgreSQL to `5432` and Redis to `6380`. Or run `./scripts/start-dev.ps1` to start Postgres, Redis, API, and web in separate windows. See [docs/RUNBOOK.md](docs/RUNBOOK.md) for daily operation and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for local production rehearsals and Vercel setup.

There is no automatic database seed. After migrations, create the first local admin once with `./apps/api/scripts/create-admin.ps1`; the script prompts for the factory and admin details. It needs `DATABASE_URL` and `DIRECT_URL` in the current PowerShell environment. Do not run it if the database already has an admin.

## Production and Vercel

The monorepo deploys as two Vercel projects: Next.js (`apps/web`) and NestJS (`apps/api`). The web project rewrites `/v1`, `/health`, and `/socket.io` to the API project so browser requests and host-only auth cookies stay on the web origin. Production also requires a pooled PostgreSQL URL, a direct migration URL, a strong JWT secret, and hosted Redis. The API and production migrations must be configured separately; migrations do not run on function cold starts.

**Realtime status:** dashboard polling every five seconds was verified locally while Socket.IO was disconnected. An authenticated Socket.IO handshake worked directly against the local API with an allowed origin; the local web `/socket.io` rewrite timed out. Vercel currently documents WebSocket support for Functions, but this deployment's external rewrite path still needs verification on Vercel. See the deployment checklist before treating hosted Socket.IO as verified.

**Dashboard count:** the Completed KPI sums completed quantities for active and paused work orders. The local test began with five pieces already completed; two more recordings moved the aggregate to 6 and then 7, as expected. `completedToday` is a separate metric.

**Verification status (2026-11-04):** local migrations and the Part 5 production build/E2E flow were verified earlier. The Part 6 clean-install rerun is **NOT VERIFIED**: `npm ci` failed twice with Windows `EPERM` unlinking Prisma's `query_engine-windows.dll.node`; the following build stopped because `tsc` was unavailable. No Vercel deployment has been exercised. See [the full checklist and deployment guide](docs/DEPLOYMENT.md).

## Routes and code map

- `/` — public site
- `/login`, `/operator-login` — staff password and operator machine-code/PIN login
- `/manager/*`, `/admin/*` — authenticated workspace
- `/operator` — operator terminal with offline queue and replay

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md), [docs/FRONTEND_PRD.md](docs/FRONTEND_PRD.md), [docs/RUNBOOK.md](docs/RUNBOOK.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
