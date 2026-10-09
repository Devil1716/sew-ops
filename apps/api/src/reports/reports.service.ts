import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { toCsv } from '../common/csv';
import { parseBody } from '../common/validation';
import { rangeQuerySchema, resolveRange } from '../common/report-range';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportResult {
  format: 'json' | 'csv';
  filename: string;
  data: unknown;
  csvText?: string;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 10000) / 100 : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(user: AuthUser, query: unknown) {
    const q = parseBody(rangeQuerySchema, query);
    let factoryId = q.factoryId;
    if (factoryId) assertFactoryAccess(user, factoryId);
    else if (user.factoryIds.length === 1) factoryId = user.factoryIds[0];
    else throw new BadRequestException('factoryId is required.');

    const factory = await this.prisma.factory.findUnique({
      where: { id: factoryId },
      select: { timezone: true },
    });
    if (!factory) throw new NotFoundException();

    const range = resolveRange(factory.timezone, q.from, q.to);
    return { factoryId, tz: factory.timezone, from: range.from, to: range.to, format: q.format };
  }

  async production(user: AuthUser, query: unknown): Promise<ReportResult> {
    const c = await this.context(user, query);
    const raw = await this.prisma.$queryRaw<
      { day: Date; line_code: string; machine_code: string; order_number: string; pieces: number }[]
    >`
      WITH r AS (
        SELECT (${c.from}::date)::timestamp AT TIME ZONE ${c.tz} AS f,
               ((${c.to}::date + 1)::timestamp AT TIME ZONE ${c.tz}) AS t
      )
      SELECT (e.occurred_at AT TIME ZONE ${c.tz})::date AS day,
             l.code AS line_code, m.code AS machine_code, w.order_number AS order_number,
             SUM(e.quantity)::int AS pieces
      FROM production_events e
      JOIN machines m ON m.id = e.machine_id
      JOIN lines l ON l.id = e.line_id
      JOIN work_orders w ON w.id = e.work_order_id
      CROSS JOIN r
      WHERE e.factory_id = ${c.factoryId}::uuid AND e.occurred_at >= r.f AND e.occurred_at < r.t
      GROUP BY 1, 2, 3, 4
      ORDER BY 1, 2, 3, 4`;

    const rows = raw.map((r) => ({
      day: day(r.day),
      lineCode: r.line_code,
      machineCode: r.machine_code,
      orderNumber: r.order_number,
      pieces: r.pieces,
    }));
    const byLine = new Map<string, number>();
    for (const r of rows) byLine.set(r.lineCode, (byLine.get(r.lineCode) ?? 0) + r.pieces);

    const data = {
      factoryId: c.factoryId,
      timezone: c.tz,
      from: c.from,
      to: c.to,
      rows,
      totals: { pieces: rows.reduce((s, r) => s + r.pieces, 0) },
      byLine: [...byLine].map(([lineCode, pieces]) => ({ lineCode, pieces })),
    };
    return {
      format: c.format,
      filename: `production_${c.from}_${c.to}.csv`,
      data,
      csvText:
        c.format === 'csv'
          ? toCsv(['day', 'line', 'machine', 'work_order', 'pieces'], rows.map((r) => [r.day, r.lineCode, r.machineCode, r.orderNumber, r.pieces]))
          : undefined,
    };
  }

  async downtime(user: AuthUser, query: unknown): Promise<ReportResult> {
    const c = await this.context(user, query);
    const raw = await this.prisma.$queryRaw<
      { line_code: string; machine_code: string; reason: string; planned: boolean; events: number; minutes: number }[]
    >`
      WITH r AS (
        SELECT (${c.from}::date)::timestamp AT TIME ZONE ${c.tz} AS f,
               ((${c.to}::date + 1)::timestamp AT TIME ZONE ${c.tz}) AS t
      )
      SELECT l.code AS line_code, m.code AS machine_code, d.reason::text AS reason, d.planned AS planned,
             COUNT(*)::int AS events,
             ROUND(SUM(EXTRACT(EPOCH FROM (LEAST(COALESCE(d.ended_at, now()), r.t) - GREATEST(d.started_at, r.f))) / 60)::numeric, 1)::float8 AS minutes
      FROM downtime_events d
      JOIN machines m ON m.id = d.machine_id
      JOIN lines l ON l.id = m.line_id
      CROSS JOIN r
      WHERE d.factory_id = ${c.factoryId}::uuid AND d.started_at < r.t AND COALESCE(d.ended_at, now()) > r.f
      GROUP BY 1, 2, 3, 4
      ORDER BY 1, 2, 3, 4`;

    const rows = raw.map((r) => ({
      lineCode: r.line_code,
      machineCode: r.machine_code,
      reason: r.reason,
      planned: r.planned,
      events: r.events,
      minutes: r.minutes,
    }));
    const data = {
      factoryId: c.factoryId,
      timezone: c.tz,
      from: c.from,
      to: c.to,
      rows,
      totals: {
        events: rows.reduce((s, r) => s + r.events, 0),
        plannedMinutes: round1(rows.filter((r) => r.planned).reduce((s, r) => s + r.minutes, 0)),
        unplannedMinutes: round1(rows.filter((r) => !r.planned).reduce((s, r) => s + r.minutes, 0)),
      },
    };
    return {
      format: c.format,
      filename: `downtime_${c.from}_${c.to}.csv`,
      data,
      csvText:
        c.format === 'csv'
          ? toCsv(['line', 'machine', 'reason', 'planned', 'events', 'minutes'], rows.map((r) => [r.lineCode, r.machineCode, r.reason, r.planned, r.events, r.minutes]))
          : undefined,
    };
  }

  async quality(user: AuthUser, query: unknown): Promise<ReportResult> {
    const c = await this.context(user, query);
    const raw = await this.prisma.$queryRaw<
      { day: Date; order_number: string; defect_type: string | null; inspected: number; rejected: number }[]
    >`
      WITH r AS (
        SELECT (${c.from}::date)::timestamp AT TIME ZONE ${c.tz} AS f,
               ((${c.to}::date + 1)::timestamp AT TIME ZONE ${c.tz}) AS t
      )
      SELECT (q.checked_at AT TIME ZONE ${c.tz})::date AS day, w.order_number AS order_number,
             q.defect_type AS defect_type,
             SUM(q.inspected_qty)::int AS inspected, SUM(q.rejected_qty)::int AS rejected
      FROM quality_checks q
      JOIN work_orders w ON w.id = q.work_order_id
      CROSS JOIN r
      WHERE q.factory_id = ${c.factoryId}::uuid AND q.voided_at IS NULL
        AND q.checked_at >= r.f AND q.checked_at < r.t
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3`;

    const rows = raw.map((r) => ({
      day: day(r.day),
      orderNumber: r.order_number,
      defectType: r.defect_type,
      inspected: r.inspected,
      rejected: r.rejected,
    }));

    const byDefect = new Map<string, number>();
    const byOrder = new Map<string, { inspected: number; rejected: number }>();
    for (const r of rows) {
      if (r.defectType) byDefect.set(r.defectType, (byDefect.get(r.defectType) ?? 0) + r.rejected);
      const o = byOrder.get(r.orderNumber) ?? { inspected: 0, rejected: 0 };
      o.inspected += r.inspected;
      o.rejected += r.rejected;
      byOrder.set(r.orderNumber, o);
    }
    const inspected = rows.reduce((s, r) => s + r.inspected, 0);
    const rejected = rows.reduce((s, r) => s + r.rejected, 0);

    const data = {
      factoryId: c.factoryId,
      timezone: c.tz,
      from: c.from,
      to: c.to,
      rows,
      totals: { inspected, rejected, rejectRatePct: pct(rejected, inspected) },
      byDefect: [...byDefect].map(([defectType, count]) => ({ defectType, rejected: count })).sort((a, b) => b.rejected - a.rejected),
      byWorkOrder: [...byOrder].map(([orderNumber, v]) => ({ orderNumber, ...v, rejectRatePct: pct(v.rejected, v.inspected) })),
    };
    return {
      format: c.format,
      filename: `quality_${c.from}_${c.to}.csv`,
      data,
      csvText:
        c.format === 'csv'
          ? toCsv(['day', 'work_order', 'defect_type', 'inspected', 'rejected'], rows.map((r) => [r.day, r.orderNumber, r.defectType, r.inspected, r.rejected]))
          : undefined,
    };
  }
}