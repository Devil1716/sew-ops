# API contract (consumed by the web app, implemented by apps/api later)

All payloads validate against `packages/shared/src/schemas.ts`. All realtime payloads are in `RealtimePayloadMap`.

## REST
- `GET  /kpis/today` → `DashboardKpis`
- `GET  /lines/progress` → `LineProgress[]`
- `GET  /machines?lineId&factoryId&status` → `Machine[]`
- `GET  /work-orders` / `GET /work-orders/:id` → `WorkOrder[]` / `WorkOrder`
- `GET  /issues?status=open` → `Issue[]`
- `GET  /issues/today` → `Issue[]`
- `GET  /notifications` → `AppNotification[]`
- `GET  /trends/output?window=24h` → `TrendPoint[]`
- `GET  /downtime/today` → `DowntimeEntry[]`
- `GET  /factories` / `/lines` / `/users` / `/shifts` → `Factory[]` / `Line[]` / `User[]` / `Shift[]`
- `POST /auth/login` → `{ token, user }` from `LoginRequest`
- `POST /auth/operator-login` → `{ token, session }` from `OperatorPinLogin`
- `POST /production/events` (header `Idempotency-Key`) ← `RecordPieceRequest`
- `POST /production/events/undo` ← `UndoEventRequest`
- `POST /issues` (header `Idempotency-Key`) ← `OpenIssueRequest`

## Realtime (socket.io, event names in `RT`)
- `machine.status_changed` → `{ machineId, status, at }`
- `production.piece_completed` → `{ machineId, workOrderId, quantityCompleted }`
- `issue.opened` → `{ issue }`
- `issue.resolved` → `{ issueId, resolvedAt }`
- `work_order.updated` → `{ workOrder }`
- `notification.created` → `{ notification }`
