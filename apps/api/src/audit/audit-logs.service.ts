import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORIES = [
  'auth',
  'user',
  'factory',
  'line',
  'machine',
  'shift',
  'assignment',
  'work_order',
  'issue',
  'production',
  'quality',
  'account',
  'settings',
] as const;

const when = z.string().datetime({ offset: true });

const querySchema = z.object({
  factoryId: z.string().uuid().optional(),
  category: z.enum(CATEGORIES).optional(),
  from: when.optional(),
  to: when.optional(),
  before: when.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first. Pass the returned nextBefore back as `before` to get older entries. */
  async list(user: AuthUser, query: unknown) {
    const q = parseBody(querySchema, query);
    if (q.factoryId) assertFactoryAccess(user, q.factoryId);

    const scope: Prisma.AuditLogWhereInput = q.factoryId
      ? { factoryId: q.factoryId }
      : {
          OR: [
            { factoryId: { in: user.factoryIds } },
            { factoryId: null, actor: { factories: { some: { factoryId: { in: user.factoryIds } } } } },
          ],
        };

    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from) createdAt.gte = new Date(q.from);
    if (q.to) createdAt.lte = new Date(q.to);
    if (q.before) createdAt.lt = new Date(q.before);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        AND: [
          scope,
          ...(q.category ? [{ action: { startsWith: `${q.category}.` } }] : []),
          ...(Object.keys(createdAt).length ? [{ createdAt }] : []),
        ],
      },
      include: { actor: { select: { name: true, role: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit,
    });

    const labels = await this.entityLabels(rows, user.factoryIds);

    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        entityLabel: (r.entityId && labels.get(`${r.entityType}:${r.entityId}`)) || snapshotLabel(r.entityType, r.before, r.after) || humanType(r.entityType),
        actorName: r.actor?.name ?? null,
        actorRole: r.actor?.role ?? null,
        ip: r.ipAddress,
        before: r.before,
        after: r.after,
      })),
      nextBefore: rows.length === q.limit ? rows[rows.length - 1].createdAt.toISOString() : null,
    };
  }

  /** Current names for the records on this page. Deleted rows fall back to the stored snapshot. */
  private async entityLabels(
    rows: { entityType: string; entityId: string | null }[],
    factoryIds: string[],
  ): Promise<Map<string, string>> {
    const ids = (type: string) =>
      [...new Set(rows.filter((r) => r.entityType === type && r.entityId && UUID_RE.test(r.entityId)).map((r) => r.entityId as string))];
    const inFactory = { factoryId: { in: factoryIds } };
    const [
      users,
      factories,
      lines,
      machines,
      shifts,
      orders,
      assignments,
      issues,
      checks,
      events,
    ] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids('user') } }, select: { id: true, name: true } }),
      this.prisma.factory.findMany({ where: { id: { in: ids('factory') } }, select: { id: true, name: true, code: true } }),
      this.prisma.line.findMany({ where: { id: { in: ids('line') }, ...inFactory }, select: { id: true, name: true, code: true } }),
      this.prisma.machine.findMany({ where: { id: { in: ids('machine') }, ...inFactory }, select: { id: true, name: true, code: true } }),
      this.prisma.shift.findMany({ where: { id: { in: ids('shift') }, ...inFactory }, select: { id: true, name: true } }),
      this.prisma.workOrder.findMany({ where: { id: { in: ids('work_order') }, ...inFactory }, select: { id: true, orderNumber: true, garment: true } }),
      this.prisma.operatorAssignment.findMany({
        where: { id: { in: ids('operator_assignment') }, ...inFactory },
        select: { id: true, user: { select: { name: true } }, machine: { select: { code: true } }, shift: { select: { name: true } } },
      }),
      this.prisma.issue.findMany({
        where: { id: { in: ids('issue') }, ...inFactory },
        select: { id: true, type: true, machine: { select: { code: true } } },
      }),
      this.prisma.qualityCheck.findMany({
        where: { id: { in: ids('quality_check') }, ...inFactory },
        select: { id: true, workOrder: { select: { orderNumber: true } } },
      }),
      this.prisma.productionEvent.findMany({
        where: { id: { in: ids('production_event') }, ...inFactory },
        select: { id: true, quantity: true, machine: { select: { code: true } }, workOrder: { select: { orderNumber: true } } },
      }),
    ]);

    const labels = new Map<string, string>();
    const put = (type: string, id: string, label: string | null) => {
      if (label) labels.set(`${type}:${id}`, label);
    };
    for (const row of users) put('user', row.id, row.name);
    for (const row of factories) put('factory', row.id, row.name || row.code);
    for (const row of lines) put('line', row.id, joinPresent(row.name, row.code));
    for (const row of machines) put('machine', row.id, joinPresent(row.code, row.name));
    for (const row of shifts) put('shift', row.id, row.name);
    for (const row of orders) put('work_order', row.id, joinPresent(row.orderNumber, row.garment));
    for (const row of assignments) put('operator_assignment', row.id, joinPresent(row.user.name, row.machine.code, row.shift.name));
    for (const row of issues) put('issue', row.id, joinPresent(humanType(row.type), row.machine.code));
    for (const row of checks) put('quality_check', row.id, row.workOrder.orderNumber ? `Quality · ${row.workOrder.orderNumber}` : null);
    for (const row of events) put('production_event', row.id, joinPresent(row.machine.code, row.workOrder.orderNumber, `${row.quantity} pcs`));
    return labels;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function humanType(value: string): string {
  return value.replace(/_/g, ' ');
}

function joinPresent(...parts: Array<string | null | undefined>): string | null {
  const kept = parts.map((part) => part?.trim()).filter((part): part is string => !!part);
  return kept.length ? kept.join(' · ') : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function snapshotLabel(entityType: string, before: unknown, after: unknown): string | null {
  const bag = { ...(asRecord(before) ?? {}), ...(asRecord(after) ?? {}) };
  switch (entityType) {
    case 'user':
    case 'factory':
    case 'shift':
      return text(bag.name);
    case 'line':
      return joinPresent(text(bag.name), text(bag.code));
    case 'machine':
      return joinPresent(text(bag.code), text(bag.name));
    case 'work_order':
      return joinPresent(text(bag.orderNumber), text(bag.garment));
    case 'operator_assignment':
      return joinPresent(text(bag.operatorName), text(bag.machineCode), text(bag.shiftName));
    case 'quality_check':
      return text(bag.orderNumber) ? `Quality · ${text(bag.orderNumber)}` : null;
    case 'issue':
      return text(bag.type) ? humanType(text(bag.type) as string) : null;
    default:
      return text(bag.name) ?? text(bag.code) ?? text(bag.orderNumber);
  }
}