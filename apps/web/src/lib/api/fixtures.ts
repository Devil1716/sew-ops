/**
 * Dev-only fixtures. Enabled by NEXT_PUBLIC_USE_FIXTURES=true.
 * Provides realistic, rich demo data for local exploration when the backend service is offline.
 */
import { USE_FIXTURES } from "@/lib/constants";
import type {
  DashboardKpis,
  DowntimeEntry,
  Factory,
  Issue,
  Line,
  LineProgress,
  Machine,
  AppNotification,
  Shift,
  TrendPoint,
  User,
  WorkOrder,
} from "@sew-ops/shared";

const dashboardKpis: DashboardKpis = {
  target: 12500,
  completed: 8940,
  remaining: 3560,
  machinesActive: 10,
  machinesStopped: 2,
  issuesToday: 3,
};

const factories: Factory[] = [
  { id: "f-1", name: "Main Plant — Alpha", code: "F01", timezone: "America/New_York", createdAt: new Date().toISOString() },
  { id: "f-2", name: "Facility Beta", code: "F02", timezone: "Asia/Ho_Chi_Minh", createdAt: new Date().toISOString() },
];

const lines: Line[] = [
  { id: "l-1", factoryId: "f-1", name: "Line A — Shirts & Tops", code: "LA", targetPerShift: 6000 },
  { id: "l-2", factoryId: "f-1", name: "Line B — Outerwear & Bottoms", code: "LB", targetPerShift: 6500 },
];

const machineStatuses: Array<Machine["status"]> = [
  "running",
  "running",
  "running",
  "idle",
  "running",
  "running",
  "running",
  "breakdown",
  "running",
  "running",
  "maintenance",
  "running",
];

const machineModels = [
  "Juki DDL-9000C",
  "Brother S-7300A",
  "Pegasus M900",
  "Yamato FD-62GS",
  "Juki MO-6814S",
  "Brother BAS-311HN",
];

const machines: Machine[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `m-${i + 1}`,
  lineId: i < 6 ? "l-1" : "l-2",
  factoryId: "f-1",
  name: `Sew Station ${String(i + 1).padStart(2, "0")}`,
  code: `M${String(i + 1).padStart(2, "0")}`,
  model: machineModels[i % machineModels.length],
  status: machineStatuses[i],
  lastEventAt: new Date(Date.now() - (i + 1) * 120_000).toISOString(),
}));

const workOrders: WorkOrder[] = [
  {
    id: "wo-101",
    lineId: "l-1",
    styleCode: "OX-2026",
    garment: "Oxford Classic Button-Down",
    quantityTarget: 3200,
    quantityCompleted: 2540,
    status: "active",
    plannedStart: "2026-10-08T06:00:00Z",
    plannedEnd: "2026-10-08T18:00:00Z",
  },
  {
    id: "wo-102",
    lineId: "l-1",
    styleCode: "DN-404",
    garment: "Denim Worker Overshirt",
    quantityTarget: 2800,
    quantityCompleted: 2310,
    status: "active",
    plannedStart: "2026-10-08T06:00:00Z",
    plannedEnd: "2026-10-08T18:00:00Z",
  },
  {
    id: "wo-103",
    lineId: "l-2",
    styleCode: "TS-102",
    garment: "Heavyweight Crewneck Tee",
    quantityTarget: 4000,
    quantityCompleted: 2980,
    status: "active",
    plannedStart: "2026-10-08T06:00:00Z",
    plannedEnd: "2026-10-08T18:00:00Z",
  },
  {
    id: "wo-104",
    lineId: "l-2",
    styleCode: "PL-550",
    garment: "Pique Cotton Polo",
    quantityTarget: 2500,
    quantityCompleted: 1110,
    status: "active",
    plannedStart: "2026-10-08T06:00:00Z",
    plannedEnd: "2026-10-08T18:00:00Z",
  },
];

const issues: Issue[] = [
  {
    id: "iss-1",
    machineId: "m-8",
    lineId: "l-2",
    workOrderId: "wo-103",
    type: "thread_empty",
    severity: "low",
    note: "Bobbin thread exhausted on double-stitch run",
    status: "open",
    openedAt: new Date(Date.now() - 35 * 60_000).toISOString(),
    resolvedAt: null,
    openedBy: "Operator 08",
  },
  {
    id: "iss-2",
    machineId: "m-4",
    lineId: "l-1",
    workOrderId: "wo-101",
    type: "machine_issue",
    severity: "medium",
    note: "Feed dog alignment error detected during high speed cycle",
    status: "open",
    openedAt: new Date(Date.now() - 50 * 60_000).toISOString(),
    resolvedAt: null,
    openedBy: "Operator 04",
  },
  {
    id: "iss-3",
    machineId: "m-11",
    lineId: "l-2",
    workOrderId: "wo-104",
    type: "quality_issue",
    severity: "high",
    note: "Tension uneven across seam line B — inspection flagged",
    status: "open",
    openedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    resolvedAt: null,
    openedBy: "QA Lead",
  },
];

const notifications: AppNotification[] = [
  {
    id: "notif-1",
    title: "High Severity Quality Flag",
    body: "Machine M11 on Line B reported tension discrepancy.",
    createdAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    read: false,
  },
  {
    id: "notif-2",
    title: "Line A Target Milestone (80%)",
    body: "Line A reached 4,850 completed pieces.",
    createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    read: true,
  },
  {
    id: "notif-3",
    title: "Shift 1 Handover in 2 Hours",
    body: "Prepare shift report for Day Shift handover.",
    createdAt: new Date(Date.now() - 120 * 60_000).toISOString(),
    read: true,
  },
];

const lineProgress: LineProgress[] = [
  {
    lineId: "l-1",
    lineName: "Line A — Shirts & Tops",
    target: 6000,
    completed: 4850,
  },
  {
    lineId: "l-2",
    lineName: "Line B — Outerwear & Bottoms",
    target: 6500,
    completed: 4090,
  },
];

const hours = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const trend: TrendPoint[] = hours.map((h, i) => {
  const baseTarget = (i + 1) * 1050;
  const baseCompleted = Math.floor(baseTarget * (0.88 + Math.sin(i * 0.5) * 0.08));
  return {
    ts: `2026-10-08T${h}:00Z`,
    completed: baseCompleted,
    target: baseTarget,
  };
});

const downtime: DowntimeEntry[] = [
  {
    machineId: "m-8",
    machineName: "Station 08",
    reason: "thread_empty",
    minutes: 42,
    startedAt: new Date(Date.now() - 42 * 60_000).toISOString(),
  },
  {
    machineId: "m-4",
    machineName: "Station 04",
    reason: "machine_issue",
    minutes: 36,
    startedAt: new Date(Date.now() - 36 * 60_000).toISOString(),
  },
  {
    machineId: "m-11",
    machineName: "Station 11",
    reason: "quality_issue",
    minutes: 18,
    startedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    machineId: "m-6",
    machineName: "Station 06",
    reason: "material_missing",
    minutes: 14,
    startedAt: new Date(Date.now() - 14 * 60_000).toISOString(),
  },
];

const shifts: Shift[] = [
  { id: "sh-1", factoryId: "f-1", name: "Morning Shift (Shift 1)", startsAt: "06:00", endsAt: "14:30" },
  { id: "sh-2", factoryId: "f-1", name: "Evening Shift (Shift 2)", startsAt: "14:30", endsAt: "23:00" },
  { id: "sh-3", factoryId: "f-1", name: "Night Shift (Shift 3)", startsAt: "23:00", endsAt: "06:00" },
];

const users: User[] = [
  { id: "u-1", name: "Elena Vance", email: "elena.vance@sewops.internal", role: "manager", factoryIds: ["f-1"] },
  { id: "u-2", name: "Marcus Thorne", email: "admin@sewops.internal", role: "admin", factoryIds: ["f-1", "f-2"] },
  { id: "u-3", name: "Ravi Patel", email: "ravi.patel@sewops.internal", role: "operator", factoryIds: ["f-1"] },
];

const registry: Record<string, unknown> = {
  "/kpis/today": dashboardKpis,
  "/lines/progress": lineProgress,
  "/machines": machines,
  "/work-orders": workOrders,
  "/issues?status=open": issues,
  "/issues/today": issues,
  "/issues": issues,
  "/notifications": notifications,
  "/trends/output?window=24h": trend,
  "/trends/output": trend,
  "/downtime/today": downtime,
  "/factories": factories,
  "/lines": lines,
  "/shifts": shifts,
  "/users": users,
};

export function resolveFixture<T>(path: string): T | undefined {
  if (!USE_FIXTURES) return undefined;
  const base = path.split("?")[0];
  if (path in registry) return registry[path] as T;
  if (base in registry) return registry[base] as T;

  // Handle single entity by id lookup e.g. /work-orders/wo-101
  if (base.startsWith("/work-orders/")) {
    const id = base.replace("/work-orders/", "");
    const wo = workOrders.find((w) => w.id === id) || workOrders[0];
    return wo as T;
  }
  if (base.startsWith("/machines/")) {
    const id = base.replace("/machines/", "");
    const m = machines.find((item) => item.id === id) || machines[0];
    return m as T;
  }
  if (base.startsWith("/issues/")) {
    const id = base.replace("/issues/", "");
    const it = issues.find((item) => item.id === id) || issues[0];
    return it as T;
  }

  return undefined;
}
