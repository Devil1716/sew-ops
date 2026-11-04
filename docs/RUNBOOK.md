# Sew Ops runbook

How to run, check, back up and safely change the system. Written for the person on duty, not for a developer.

## 1. What runs where (today, on the development computer)

| Part | What it is | Address |
|---|---|---|
| Database | PostgreSQL 16 in Docker, container `sewops-db` | localhost:5432 |
| Realtime adapter | Redis 7 in Docker | localhost:6380 |
| API | NestJS server (all the rules and data) | http://localhost:4000 (health: `/health`) |
| Website | Next.js app (manager, admin and operator screens) | http://localhost:3000 |

The website only talks to the API. The API is the only thing that talks to the database.

## 2. Start and stop

1. Open **Docker Desktop** and wait for "Engine running".
2. In PowerShell, copy `.env.example`, `apps/api/.env.example`, and `apps/web/.env.example` to `.env`, `apps/api/.env`, and `apps/web/.env.local`. Set the same `POSTGRES_PASSWORD` in Compose and the API database URLs. Run `npm ci`, `docker compose up -d db redis`, and `npm run prisma:migrate:deploy` once for a new database.
3. Run `.\scripts\start-dev.ps1` from the repository root. It starts/confirms Postgres and Redis, then launches the API and website and ends with `READY.`. Or run `npm run dev:api` and `npm run dev` in separate terminals.
4. To stop: close the two windows named **SEW OPS API** and **SEW OPS WEB**. Docker can stay on.

## 3. Is it healthy?

- `http://localhost:4000/health` should say `"status":"ok"` and `"database":"up"`.
- Admin screen **Settings > System status** shows the same live.
- The coloured badge in the top bar says **live** when Socket.IO is connected. If it says **Reconnecting**, dashboard KPIs still poll every five seconds. The operator terminal queues production events offline and replays them after reconnect using idempotency keys.
- Full check (takes a few minutes, cleans up after itself): `.\scripts\verify-all.ps1`.
- Security check: `.\scripts\security-review.ps1`.

## 4. Backups and restore

**Back up (do this before any change and every day):** `.\scripts\backup-db.ps1`. The newest 14 are kept in the `backups` folder. **That folder is on this computer: copy it to a cloud drive or USB regularly.**

**Prove the latest backup works:** `.\scripts\restore-test.ps1` (restores into a scratch database, compares, deletes it). Look for `RESTORE TEST PASSED`.

**Optional nightly backup at 02:00:** `.\scripts\schedule-backup.ps1` (remove with `-Remove`).

**Disaster restore (DESTROYS the current data, replacing it with a backup):**

1. Close the **SEW OPS API** window.
2. Take a fresh backup first if the database still opens: `.\scripts\backup-db.ps1`.
3. Pick the backup file, then run (replace the file name):

```powershell
docker cp backups\sewops_YYYY-MM-DD_HH-MM-SS.dump sewops-db:/tmp/restore.dump
docker exec sewops-db psql -U sewops -d postgres -c "DROP DATABASE sewops WITH (FORCE);"
docker exec sewops-db psql -U sewops -d postgres -c "CREATE DATABASE sewops;"
docker exec sewops-db pg_restore -U sewops -d sewops --no-owner --no-privileges /tmp/restore.dump
```

4. Start everything again with `.\scripts\start-dev.ps1` and check section 3.

Everything entered after the backup was taken is lost, so back up often.

## 5. Everyday jobs (all from the screens)

| Job | Where |
|---|---|
| Add a line or a machine | Admin > Floor setup |
| Add or change a shift | Admin > Shifts |
| New operator | Admin > Users > New user (role Operator: employee code and a 6-digit PIN), then Admin > Assignments to give them a machine and shift |
| Operator forgot the PIN | Admin > Users > Reset PIN |
| Manager forgot the password | Admin > Users > Reset password |
| Someone leaves | Admin > Users > Edit > untick Active. They are signed out at once. Nothing is deleted |
| Change my own password | Top-right menu > Change password |
| Plan work | Manager > Work Orders: create, assign to a line (optionally one machine or shift), Start |
| Stop a machine for service | Manager > Machines > Maintenance (planned downtime; pieces are refused until you end it) |
| A quality check was entered wrongly | Manager > Quality > Void (kept for the record, removed from totals) |
| Numbers for a period | Manager > Reports, then Download CSV |
| Who did what | Admin > Audit log |
| Which problems ring the bell | Admin > Settings |

## 6. When something goes wrong

| What you see | Likely cause | What to do |
|---|---|---|
| Website opens but shows errors or "No connection" | API not running | Run `.\scripts\start-dev.ps1`, check `/health` |
| API window shows `P1001` or "Can't reach database" | Docker or the database is not running | Open Docker Desktop, wait for Engine running, run the start script |
| Operator: "Wrong PIN, or nobody is assigned" | No assignment for that machine and shift today, the shift is not running, or a wrong PIN | Check Admin > Assignments; reset the PIN if needed |
| Operator account locked | 5 wrong PINs: locked for 15 minutes | Wait, or Admin > Users > Reset PIN |
| Operator: "under maintenance" | A manager put the machine in maintenance | Manager > Machines > End maintenance |
| Operator: "No active work order" | The order is not Active, or is not assigned to that machine's line | Manager > Work Orders |
| Numbers not moving on a screen | Socket.IO is reconnecting or API requests fail | Check API health and browser Network/Console. Dashboard KPIs poll every five seconds without the socket; operator events queue offline and replay on reconnect. |
| "Too many attempts" | Rate limit on logins | Wait one minute |
| Forgot the admin password | | `.\scripts\reset-admin-password.ps1` |
| Anything strange | | Note the time and the **request id** (in the browser's network tab, header `X-Request-Id`); the API log has a line with that id |

## 7. Production deployment

Production uses two Vercel projects: web root `apps/web` and API root `apps/api`. Browser API calls use the web origin's `/v1` rewrite; auth cookies are host-only, httpOnly, and Secure on HTTPS. Set the web project's build-time `INTERNAL_API_URL` to the API origin. The API needs hosted PostgreSQL (`DATABASE_URL` pooled, `DIRECT_URL` direct), hosted Redis (`REALTIME_REDIS_URL` or `REDIS_URL`), a strong `JWT_ACCESS_SECRET`, and exact HTTPS `CORS_ORIGIN`. Set `NEXT_PUBLIC_API_BASE_URL=/v1` and `NEXT_PUBLIC_USE_FIXTURES=false` on web. Do not set `COOKIE_DOMAIN` or local-only `ALLOW_LOCALHOST_ORIGIN`.

Apply schema changes once before routing traffic with `npm run prisma:migrate:deploy` from the repository root, using the target database URLs. Bootstrap the first admin with `./apps/api/scripts/create-admin.ps1` against that database; there is no seed account. Full project settings, environment variables, DNS, Socket.IO deployment checks, and verification status are in [DEPLOYMENT.md](DEPLOYMENT.md). The web-to-API external Socket.IO rewrite timed out locally and remains unverified on Vercel; dashboard polling was verified locally.

- [ ] Verify Vercel health, login/refresh cookies through the web origin, work-order assignment, operator recording, dashboard polling, Socket.IO, Redis cross-instance fan-out, and rate limiting after deployment.
- [ ] Change the bootstrapped admin password after first login.
- [ ] Configure off-site backups and complete a restore test with the hosted provider.

## 8. Changing the system safely

1. Back up: `.\scripts\backup-db.ps1`.
2. Make the change.
3. `.\scripts\verify-all.ps1` must end with `EVERYTHING PASSED`.
4. `git add .`, `git commit`, `git push`. GitHub then runs the type checks automatically (repo > Actions tab: green is good).
5. Database changes: edit `apps/api/prisma/schema.prisma`, then `npm run db:migrate -w @sew-ops/api -- --name what_changed`. Never edit a migration that has already been applied; add a new one. For hosted deployment, apply the committed migration separately with `npm run prisma:migrate:deploy` before directing traffic. Renaming or removing a column needs two releases (add the new, move the data, remove the old later).

## 9. Rules the system keeps (do not break them)

- A piece is counted **once**, no matter how often a terminal resends it (idempotency keys).
- Production events and the audit log are **append-only**. A mistake is corrected by an opposite entry, never by deleting.
- Nothing important is deleted: people, machines, lines and shifts are deactivated.
- "Today" always means today on the **factory's** clock, not the viewer's.
- Passwords and PINs are never logged or shown.
