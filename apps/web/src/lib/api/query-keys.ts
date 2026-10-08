/** Centralized TanStack Query keys — never hand-write key arrays elsewhere. */
import type { ListFilters } from "@sew-ops/shared";

export const qk = {
  kpisToday: ["kpis", "today"] as const,
  lineProgress: ["lines", "progress"] as const,
  machines: (filters?: ListFilters) => ["machines", filters ?? {}] as const,
  machine: (id: string) => ["machines", id] as const,
  workOrders: (filters?: ListFilters) => ["work-orders", filters ?? {}] as const,
  workOrder: (id: string) => ["work-orders", id] as const,
  issues: (filters?: ListFilters) => ["issues", filters ?? {}] as const,
  issuesToday: ["issues", "today"] as const,
  notifications: ["notifications"] as const,
  trendsOutput: (window: string) => ["trends", "output", window] as const,
  downtimeToday: ["downtime", "today"] as const,
  factories: ["factories"] as const,
  lines: ["lines"] as const,
  users: ["users"] as const,
  shifts: ["shifts"] as const,
  auditLog: (page: number) => ["audit-log", page] as const,
} as const;
