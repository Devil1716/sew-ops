import { z } from "zod";
import { RT } from "./enums";
import {
  dashboardKpisSchema,
  downtimeEntrySchema,
  factorySchema,
  issueOpenedPayloadSchema,
  issueResolvedPayloadSchema,
  issueSchema,
  lineProgressSchema,
  lineSchema,
  loginRequestSchema,
  machineSchema,
  machineStatusChangedPayloadSchema,
  notificationCreatedPayloadSchema,
  notificationSchema,
  openIssueRequestSchema,
  operatorPinLoginSchema,
  pieceCompletedPayloadSchema,
  productionEventSchema,
  recordPieceRequestSchema,
  shiftSchema,
  trendPointSchema,
  undoEventRequestSchema,
  userSchema,
  workOrderSchema,
  workOrderUpdatedPayloadSchema,
} from "./schemas";

export type Factory = z.infer<typeof factorySchema>;
export type Line = z.infer<typeof lineSchema>;
export type Machine = z.infer<typeof machineSchema>;
export type User = z.infer<typeof userSchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type WorkOrder = z.infer<typeof workOrderSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type ProductionEvent = z.infer<typeof productionEventSchema>;
export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;
export type LineProgress = z.infer<typeof lineProgressSchema>;
export type TrendPoint = z.infer<typeof trendPointSchema>;
export type DowntimeEntry = z.infer<typeof downtimeEntrySchema>;
export type AppNotification = z.infer<typeof notificationSchema>;

export type RecordPieceRequest = z.infer<typeof recordPieceRequestSchema>;
export type OpenIssueRequest = z.infer<typeof openIssueRequestSchema>;
export type UndoEventRequest = z.infer<typeof undoEventRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type OperatorPinLogin = z.infer<typeof operatorPinLoginSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Filters shared by list endpoints. All optional; backend applies defaults. */
export interface ListFilters {
  dateFrom?: string;
  dateTo?: string;
  factoryId?: string;
  lineId?: string;
  machineId?: string;
  garment?: string;
  shiftId?: string;
  page?: number;
  pageSize?: number;
}

/** Typed map of realtime event name -> payload, used by lib/realtime. */
export interface RealtimePayloadMap {
  [RT.MachineStatusChanged]: z.infer<typeof machineStatusChangedPayloadSchema>;
  [RT.PieceCompleted]: z.infer<typeof pieceCompletedPayloadSchema>;
  [RT.IssueOpened]: z.infer<typeof issueOpenedPayloadSchema>;
  [RT.IssueResolved]: z.infer<typeof issueResolvedPayloadSchema>;
  [RT.WorkOrderUpdated]: z.infer<typeof workOrderUpdatedPayloadSchema>;
  [RT.NotificationCreated]: z.infer<typeof notificationCreatedPayloadSchema>;
}
