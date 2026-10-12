import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MachineStatus } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const querySchema = z.object({
  factoryId: z.string().uuid().optional(),
  window: z.string().regex(/^\d{1,2}h$/).optional(),
});

const OPEN_ORDERS = ['active', 'paused'] as const;

/** "YYYY-MM-DDTHH:00:00" for the hour containing `at`, as the factory's wall clock. */
function localHourLabel(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00:00`;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(user: AuthUser, query: unknown) {
    const q = parseBody(querySchema, query);
    let factoryId = q.factoryId;
    if (factoryId) assertFactoryAccess(user, factoryId);
    else if (user.factoryIds.length === 1) factoryId = user.factoryIds[0];
    else throw new BadRequestException('factoryId is required.');

    const factory = await this.prisma.factory.findUnique({
      where: { id: factoryId },
      select: { timezone: true },
    });
    if (!factory) throw new NotFoundException();

    const hours = q.window ? Math.min(72, Math.max(1, Number(q.window.slice(0, -1)))) : 24;
    return { factoryId, tz: factory.timezone, hours };
  }

  async kpis(user: AuthUser, query: unknown) {
    const c = await this.context(user, query);

    const [orders, groups, today] = await Promise.all([
      this.prisma.workOrder.aggregate({
        where: { factoryId: c.factoryId, status: { in: [...OPEN_ORDERS] } },
        _sum: { quantityTarget: true, quantityCompleted: true },
      }),
      this.prisma.machine.groupBy({
        by: ['status'],
        where: { factoryId: c.factoryId, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ issues_today: number; completed_today: number }[]>`
        WITH r AS (SELECT ((now() AT TIME ZONE ${c.tz})::date)::timestamp AT TIME ZONE ${c.tz} AS f)
        SELECT
          (SELECT COUNT(*)::int FROM issues i CROSS JOIN r
             WHERE i.factory_id = ${c.factoryId}::uuid AND i.opened_at >= r.f) AS issues_today,
          (SELECT COALESCE(SUM(e.quantity), 0)::int FROM production_events e CROSS JOIN r
             WHERE e.factory_id = ${c.factoryId}::uuid AND e.occurred_at >= r.f) AS completed_today`,
    ]);

    const count = (s: MachineStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
    const target = orders._sum.quantityTarget ?? 0;
    const completed = orders._sum.quantityCompleted ?? 0;

    return {
      target,
      completed,
      remaining: Math.max(0, target - completed),
      completedToday: today[0]?.completed_today ?? 0,
      machinesActive: count('running'),
      machinesStopped: count('idle') + count('breakdown') + count('maintenance'),
      machinesOffline: count('offline'),
      machinesTotal: groups.reduce((s, g) => s + g._count._all, 0),
      issuesToday: today[0]?.issues_today ?? 0,
    };
  }

  /** Orders shared by several lines count in full on each line. */
  async lines(user: AuthUser, query: unknown) {
    const c = await this.context(user, query);

    const lines = await this.prisma.line.findMany({
      where: { factoryId: c.factoryId, isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, name: true, code: true },
    });
    const assignments = await this.prisma.workOrderAssignment.findMany({
      where: {
        factoryId: c.factoryId,
        lineId: { in: lines.map((l) => l.id) },
        workOrder: { status: { in: [...OPEN_ORDERS] } },
      },
      select: {
        lineId: true,
        workOrder: {
          select: { id: true, orderNumber: true, garment: true, quantityTarget: true, quantityCompleted: true },
        },
      },
    });

    type Order = (typeof assignments)[number]['workOrder'];
    const byLine = new Map<string, Map<string, Order>>();
    for (const a of assignments) {
      const orders = byLine.get(a.lineId) ?? new Map<string, Order>();
      orders.set(a.workOrder.id, a.workOrder);
      byLine.set(a.lineId, orders);
    }

    return lines.map((l) => {
      const orders = [...(byLine.get(l.id)?.values() ?? [])];
      return {
        lineId: l.id,
        lineName: l.name,
        lineCode: l.code,
        garment: orders[0]?.garment ?? null,
        orderNumbers: orders.map((o) => o.orderNumber),
        target: orders.reduce((s, o) => s + o.quantityTarget, 0),
        completed: orders.reduce((s, o) => s + o.quantityCompleted, 0),
      };
    });
  }

  /** Net pieces per hour for the last N hours; hours with no output are included as 0. */
  async trend(user: AuthUser, query: unknown) {
    const c = await this.context(user, query);

    const rows = await this.prisma.$queryRaw<{ ts: string; completed: number }[]>`
      SELECT to_char(date_trunc('hour', e.occurred_at AT TIME ZONE ${c.tz}), 'YYYY-MM-DD"T"HH24:MI:SS') AS ts,
             SUM(e.quantity)::int AS completed
      FROM production_events e
      WHERE e.factory_id = ${c.factoryId}::uuid
        AND e.occurred_at >= now() - (${c.hours}::int * interval '1 hour')
      GROUP BY 1
      ORDER BY 1`;
    const byHour = new Map(rows.map((r) => [r.ts, r.completed]));

    const now = Date.now();
    const points: { ts: string; completed: number; target: number }[] = [];
    for (let i = c.hours - 1; i >= 0; i -= 1) {
      const ts = localHourLabel(c.tz, new Date(now - i * 3_600_000));
      points.push({ ts, completed: byHour.get(ts) ?? 0, target: 0 });
    }
    return points;
  }

  /** Today's downtime minutes by reason (ongoing downtime counts up to now). */
  async downtime(user: AuthUser, query: unknown) {
    const c = await this.context(user, query);

    return this.prisma.$queryRaw<{ reason: string; planned: boolean; events: number; minutes: number }[]>`
      WITH r AS (SELECT ((now() AT TIME ZONE ${c.tz})::date)::timestamp AT TIME ZONE ${c.tz} AS f)
      SELECT d.reason::text AS reason, d.planned AS planned, COUNT(*)::int AS events,
             ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(d.ended_at, now()) - GREATEST(d.started_at, r.f))) / 60)::numeric, 1)::float8 AS minutes
      FROM downtime_events d CROSS JOIN r
      WHERE d.factory_id = ${c.factoryId}::uuid AND COALESCE(d.ended_at, now()) > r.f
      GROUP BY 1, 2
      ORDER BY minutes DESC`;
  }
}