/**
 * Canonical enums. Defined ONCE here; UI maps them to color/icon/label in
 * status-map.ts, backend reuses the same values for persistence.
 */

export const MACHINE_STATUSES = ["running", "idle", "breakdown", "maintenance", "offline"] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export const ISSUE_TYPES = [
  "machine_issue",
  "thread_empty",
  "material_missing",
  "quality_issue",
  "break_pause",
  "other",
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ROLES = ["admin", "manager", "operator"] as const;
export type Role = (typeof ROLES)[number];

export const WORK_ORDER_STATUSES = [
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const PRODUCTION_EVENT_TYPES = [
  "piece_completed",
  "pieces_undo",
  "issue_opened",
  "issue_resolved",
  "status_changed",
] as const;
export type ProductionEventType = (typeof PRODUCTION_EVENT_TYPES)[number];

/** Realtime event names on the socket.io gateway. */
export const RT = {
  MachineStatusChanged: "machine.status_changed",
  PieceCompleted: "production.piece_completed",
  IssueOpened: "issue.opened",
  IssueResolved: "issue.resolved",
  WorkOrderUpdated: "work_order.updated",
  NotificationCreated: "notification.created",
} as const;
export type RealtimeEventName = (typeof RT)[keyof typeof RT];
