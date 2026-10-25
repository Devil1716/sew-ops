# Sew Ops runbook

How to run, check, back up and safely change the system. Written for the person on duty, not for a developer.

## 1. What runs where (today, on the development computer)

| Part | What it is | Address |
|---|---|---|
| Database | PostgreSQL 16 in Docker, container `sewops-db` | inside Docker |
| API | NestJS server (all the rules and data) | http://localhost:4000 (health: `/health`) |
| Website | Next.js app (manager, admin and operator screens) | http://localhost:3000 |

The website only talks to the API. The API is the only thing that talks to the database.

## 2. Start and stop

1. Open **Docker Desktop** and wait for "Engine running".
2. In PowerShell: `.\scripts\start-dev.ps1` (from `C:\dev\sew-ops\sew-ops`). It starts the database, the API and the website and ends with a green `READY.`
3. To stop: close the two windows named **SEW OPS API** and **SEW OPS WEB**. Docker can stay on.

## 3. Is it healthy?

- `http://localhost:4000/health` should say `"status":"ok"` and `"database":"up"`.
- Admin screen **Settings > System status** shows the same live.
- The coloured badge in the top bar says **live** when real-time updates are flowing.
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
| Numbers not moving on a screen | Real-time link lost (badge says Reconnecting) | Check the API window; the screen catches up by itself on reconnect |
| "Too many attempts" | Rate limit on logins | Wait one minute |
| Forgot the admin password | | `.\scripts\reset-admin-password.ps1` |
| Anything strange | | Note the time and the **request id** (in the browser's network tab, header `X-Request-Id`); the API log has a line with that id |

## 7. Before going live (the "TODO" items from the security review)

- [ ] Set `NODE_ENV=production` on the API host. The API then refuses to start with a weak secret or a non-https website address.
- [ ] `CORS_ORIGIN` = the real https website address. `NEXT_PUBLIC_API_BASE_URL` = the real https API address.
- [ ] `NEXT_PUBLIC_USE_FIXTURES=false` for the website (it is the demo-data switch).
- [ ] Cookies need `Secure` over https; set `COOKIE_DOMAIN` if the website and API are on different subdomains. Re-run `.\scripts\security-review.ps1` against the live address.
- [ ] Change the admin password (top-right menu > Change password): the first one was shared in a chat during development.
- [ ] Off-site backups (host snapshots or cloud storage) and one real restore test there.
- [ ] No critical or high library vulnerabilities (`npm audit --omit=dev`).
- [ ] Run `.\scripts\verify-all.ps1` once more against the final build.

## 8. Changing the system safely

1. Back up: `.\scripts\backup-db.ps1`.
2. Make the change.
3. `.\scripts\verify-all.ps1` must end with `EVERYTHING PASSED`.
4. `git add .`, `git commit`, `git push`. GitHub then runs the type checks automatically (repo > Actions tab: green is good).
5. Database changes: edit `apps/api/prisma/schema.prisma`, then `npm run db:migrate -w @sew-ops/api -- --name what_changed`. Never edit a migration that has already been applied; add a new one. Renaming or removing a column needs two releases (add the new, move the data, remove the old later).

## 9. Rules the system keeps (do not break them)

- A piece is counted **once**, no matter how often a terminal resends it (idempotency keys).
- Production events and the audit log are **append-only**. A mistake is corrected by an opposite entry, never by deleting.
- Nothing important is deleted: people, machines, lines and shifts are deactivated.
- "Today" always means today on the **factory's** clock, not the viewer's.
- Passwords and PINs are never logged or shown.