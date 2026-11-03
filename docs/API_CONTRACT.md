# API contract (consumed by the web app, implemented by apps/api)

All REST endpoints are versioned under the `/v1` global prefix (except `/health`). All payloads validate against `packages/shared/src/schemas.ts`. All realtime payloads are in `RealtimePayloadMap`.

## Health
- `GET  /health` → `{ status: "ok", database: "up" }`

## REST (/v1)
- `GET  /v1/kpis/today` → `DashboardKpis`
- `GET  /v1/lines/progress` → `LineProgress[]`
- `GET  /v1/machines?lineId&factoryId&status` → `Machine[]`
- `GET  /v1/work-orders` / `GET /v1/work-orders/:id` → `WorkOrder[]` / `WorkOrder`
- `GET  /v1/issues?status=open` → `Issue[]`
- `GET  /v1/issues/today` → `Issue[]`
- `GET  /v1/notifications` → `AppNotification[]`
- `GET  /v1/trends/output?window=24h` → `TrendPoint[]`
- `GET  /v1/downtime/today` → `DowntimeEntry[]`
- `GET  /v1/factories` / `/v1/lines` / `/v1/users` / `/v1/shifts` → `Factory[]` / `Line[]` / `User[]` / `Shift[]`
- `POST /v1/auth/login` → `{ user: SessionUser }` from `LoginRequest` (JWT set in httpOnly `sewops_at` and `sewops_rt` cookies)
- `POST /v1/auth/operator-login` → `{ user: SessionUser, station: StationInfo }` from `OperatorPinLogin` (JWT set in httpOnly cookies)
- `POST /v1/auth/refresh` → `{ user: SessionUser }` (Rotates `sewops_rt` and issues fresh `sewops_at`)
- `POST /v1/auth/logout` → `{ ok: true }` (Clears auth cookies and revokes session)
- `GET  /v1/auth/me` → `{ user: SessionUser }`
- `POST /v1/production/events` (header `Idempotency-Key`) ← `RecordPieceRequest`
- `POST /v1/production/events/undo` ← `UndoEventRequest`
- `POST /v1/issues` (header `Idempotency-Key`) ← `OpenIssueRequest`

## Realtime (Socket.IO, event names in `RT`)
- `machine.status_changed` → `{ machineId, status, at }`
- `production.piece_completed` → `{ machineId, workOrderId, quantityCompleted }`
- `issue.opened` → `{ issue }`
- `issue.resolved` → `{ issueId, resolvedAt }`
- `work_order.updated` → `{ workOrder }`
- `notification.created` → `{ notification }`
