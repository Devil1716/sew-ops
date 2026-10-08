import { z } from "zod";
import {
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  MACHINE_STATUSES,
  PRODUCTION_EVENT_TYPES,
  ROLES,
  WORK_ORDER_STATUSES,
} from "./enums";

export const machineStatusSchema = z.enum(MACHINE_STATUSES);
export const issueTypeSchema = z.enum(ISSUE_TYPES);
export const issueSeveritySchema = z.enum(ISSUE_SEVERITIES);
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const roleSchema = z.enum(ROLES);
export const workOrderStatusSchema = z.enum(WORK_ORDER_STATUSES);
export const productionEventTypeSchema = z.enum(PRODUCTION_EVENT_TYPES);

export const factorySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
});

export const lineSchema = z.object({
  id: z.string(),
  factoryId: z.string(),
  name: z.string(),
  code: z.string(),
  targetPerShift: z.number().int().nonnegative(),
});

export const machineSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  factoryId: z.string(),
  name: z.string(),
  code: z.string(),
  model: z.string().nullable(),
  status: machineStatusSchema,
  lastEventAt: z.string().nullable(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: roleSchema,
  factoryIds: z.array(z.string()),
});

export const shiftSchema = z.object({
  id: z.string(),
  factoryId: z.string(),
  name: z.string(),
  startsAt: z.string(), // "HH:mm"
  endsAt: z.string(),
});

export const workOrderSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  styleCode: z.string(),
  garment: z.string(),
  quantityTarget: z.number().int().nonnegative(),
  quantityCompleted: z.number().int().nonnegative(),
  status: workOrderStatusSchema,
  plannedStart: z.string(),
  plannedEnd: z.string().nullable(),
});

export const issueSchema = z.object({
  id: z.string(),
  machineId: z.string(),
  lineId: z.string(),
  workOrderId: z.string().nullable(),
  type: issueTypeSchema,
  severity: issueSeveritySchema,
  note: z.string().nullable(),
  status: issueStatusSchema,
  openedAt: z.string(),
  resolvedAt: z.string().nullable(),
  openedBy: z.string(),
});

export const productionEventSchema = z.object({
  id: z.string(),
  machineId: z.string(),
  workOrderId: z.string(),
  type: productionEventTypeSchema,
  quantity: z.number().int(),
  idempotencyKey: z.string(),
  occurredAt: z.string(),
  syncedAt: z.string().nullable(),
});

export const dashboardKpisSchema = z.object({
  target: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  machinesActive: z.number().int().nonnegative(),
  machinesStopped: z.number().int().nonnegative(),
  issuesToday: z.number().int().nonnegative(),
});

export const lineProgressSchema = z.object({
  lineId: z.string(),
  lineName: z.string(),
  target: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

export const trendPointSchema = z.object({
  ts: z.string(),
  completed: z.number().nonnegative(),
  target: z.number().nonnegative(),
});

export const downtimeEntrySchema = z.object({
  machineId: z.string(),
  machineName: z.string(),
  reason: issueTypeSchema,
  minutes: z.number().nonnegative(),
  startedAt: z.string(),
});

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
});

/** ---- Realtime payloads ---- */

export const machineStatusChangedPayloadSchema = z.object({
  machineId: z.string(),
  status: machineStatusSchema,
  at: z.string(),
});

export const pieceCompletedPayloadSchema = z.object({
  machineId: z.string(),
  workOrderId: z.string(),
  quantityCompleted: z.number().int().nonnegative(),
});

export const issueOpenedPayloadSchema = z.object({ issue: issueSchema });
export const issueResolvedPayloadSchema = z.object({ issueId: z.string(), resolvedAt: z.string() });
export const workOrderUpdatedPayloadSchema = z.object({ workOrder: workOrderSchema });
export const notificationCreatedPayloadSchema = z.object({ notification: notificationSchema });

/** ---- Requests ---- */

export const recordPieceRequestSchema = z.object({
  machineId: z.string(),
  workOrderId: z.string(),
  quantity: z.number().int().positive().default(1),
  idempotencyKey: z.string().min(8),
  occurredAt: z.string(),
});

export const openIssueRequestSchema = z.object({
  machineId: z.string(),
  workOrderId: z.string().nullable(),
  type: issueTypeSchema,
  note: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8),
  occurredAt: z.string(),
});

export const undoEventRequestSchema = z.object({
  idempotencyKey: z.string().min(8),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const operatorPinLoginSchema = z.object({
  machineCode: z.string().min(1),
  pin: z.string().regex(/^\d{4,6}$/),
});

export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  });
