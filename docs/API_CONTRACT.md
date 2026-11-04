# API contract

Implemented by `apps/api`; the web client uses `/v1` through the web-origin rewrite. Except for `GET /health`, routes use the `/v1` prefix. See controller files for request schemas and role requirements; payload validation schemas are in `packages/shared/src/schemas.ts`.

## Health and authentication

- `GET /health` — service/database health.
- `POST /v1/auth/login`, `/operator-login`, `/refresh`, `/logout`; `GET /v1/auth/me`; password change/reset routes are defined in `auth.controller.ts`.
- Staff sign in with email/password. Operators sign in with the active machine code and six-digit PIN. Authentication tokens are sent in host-only httpOnly `sewops_at` and `sewops_rt` cookies.

## Main route groups

- `/v1/dashboard`: `GET kpis`, `lines`, `trend`, `downtime`.
- `/v1/work-orders`: list/detail/create/update, `POST :id/assignments`, `DELETE :id/assignments/:assignmentId`.
- `/v1/production/events`: record and undo production; record requests use an `Idempotency-Key`.
- `/v1/issues`: list/create/acknowledge/resolve; `/v1/operator/issues` is the operator view.
- `/v1/machines`: list and machine maintenance actions; `/v1/downtime`: list.
- `/v1/operator/station` and `/v1/operator/assignments`: operator station and assignment flows.
- `/v1/factories`, `/v1/lines`, `/v1/shifts`, `/v1/users`, `/v1/quality-checks`, `/v1/notifications`, `/v1/reports`, `/v1/settings`, `/v1/audit-logs`: controller-specific management and reporting routes.

## Realtime

Socket.IO uses the `/socket.io` path and WebSocket transport. Auth is checked from the session cookie during handshake, tenant/factory room scoping is enforced, and the Redis adapter fans events across API instances. Dashboard polling continues every five seconds while the client is not live. The external Vercel web-to-API rewrite for WebSocket upgrades remains **NOT VERIFIED**; see [deployment verification](DEPLOYMENT.md#post-deploy-acceptance-checklist).

Realtime event names are defined in `packages/shared` (`RealtimePayloadMap`/`RT`); current families include machine status, production completion, issue opened/resolved, work-order updates, and notifications. Check the shared types when consuming event payloads rather than relying on this summary.
