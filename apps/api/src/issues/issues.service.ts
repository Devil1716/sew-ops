import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IssueSeverity, IssueStatus, IssueType, MachineStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { StationService } from '../production/station.service';

const SEVERITY: Record<IssueType, IssueSeverity> = {
  machine_issue: 'high',
  thread_empty: 'low',
  material_missing: 'medium',
  quality_issue: 'medium',
  break_pause: 'low',
  other: 'medium',
};

/** Operators can end their own self-fixable issues; everything else needs a manager. */
const OPERATOR_RESOLVABLE: IssueType[] = ['break_pause', 'thread_empty'];

const keySchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid key');

const openSchema = z
  .object({
    type: z.nativeEnum(IssueType),
    note: z.string().trim().max(500).optional(),
    idempotencyKey: keySchema,
  })
  .strict();

const resolveSchema = z
  .object({ resolutionNote: z.string().trim().max(500).optional() })
  .strict();

const listSchema = z.object({
  status: z.nativeEnum(IssueStatus).optional(),
  machineId: z.string().uuid().optional(),
  lineId: z.string().uuid().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const downtimeQuerySchema = z.object({
  machineId: z.string().uuid().optional(),
  lineId: z.string().uuid().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const include = {
  machine: { select: { name: true, code: true } },
  line: { select: { name: true, code: true } },
  openedBy: { select: { name: true } },
  downtimeEvent: { select: { startedAt: true, endedAt: true } },
} satisfies Prisma.IssueInclude;

type Row = Prisma.IssueGetPayload<{ include: typeof include }>;

const minutesBetween = (from: Date, to: Date) =>
  Math.round(((to.getTime() - from.getTime()) / 60000) * 10) / 10;

const toDto = (i: Row) => ({
  id: i.id,
  machineId: i.machineId,
  machineName: i.machine.name,
  machineCode: i.machine.code,
  lineId: i.lineId,
  lineName: i.line.name,
  workOrderId: i.workOrderId,
  type: i.type,
  severity: i.severity,
  status: i.status,
  note: i.note,
  resolutionNote: i.resolutionNote,
  openedAt: i.openedAt.toISOString(),
  acknowledgedAt: i.acknowledgedAt ? i.acknowledgedAt.toISOString() : null,
  resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
  openedById: i.openedById,
  openedBy: i.openedBy?.name ?? null,
  durationMinutes: minutesBetween(i.openedAt, i.resolvedAt ?? new Date()),
});

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly station: StationService,
    private readonly audit: AuditService,
  ) {}

  // ---------- operator: report an issue ----------

  async open(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(openSchema, input);

    const ctx = await this.station.resolve(user);
    if (!ctx) throw new NotFoundException('No station is assigned to you right now.');

    const existing = await this.findByKey(ctx.factoryId, dto.idempotencyKey);
    if (existing) return this.replay(existing, user);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // One issue operation per machine at a time, so status and downtime never race.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.machine.id}::text))`;

        const alreadyOpen = await tx.issue.findFirst({
          where: { machineId: ctx.machine.id, type: dto.type, status: { not: 'resolved' } },
          include,
        });
        if (alreadyOpen) return { duplicate: true, issue: toDto(alreadyOpen) };

        const now = new Date();
        const created = await tx.issue.create({
          data: {
            factoryId: ctx.factoryId,
            machineId: ctx.machine.id,
            lineId: ctx.line.id,
            workOrderId: ctx.workOrder?.id ?? null,
            type: dto.type,
            severity: SEVERITY[dto.type],
            note: dto.note || null,
            idempotencyKey: dto.idempotencyKey,
            openedAt: now,
            openedById: user.id,
          },
        });

        await tx.downtimeEvent.create({
          data: {
            factoryId: ctx.factoryId,
            machineId: ctx.machine.id,
            issueId: created.id,
            reason: dto.type,
            planned: dto.type === 'break_pause',
            startedAt: now,
          },
        });

        const machine = await tx.machine.findUniqueOrThrow({
          where: { id: ctx.machine.id },
          select: { status: true },
        });
        let next: MachineStatus = machine.status;
        if (dto.type === 'machine_issue') next = 'breakdown';
        else if (machine.status === 'running' || machine.status === 'offline') next = 'idle';
        if (machine.status !== 'maintenance' && next !== machine.status) {
          await tx.machine.update({
            where: { id: ctx.machine.id },
            data: { status: next, statusSince: now },
          });
        }

        const full = await tx.issue.findUniqueOrThrow({ where: { id: created.id }, include });
        await this.audit.log(
          {
            actor: user,
            factoryId: ctx.factoryId,
            action: 'issue.opened',
            entityType: 'issue',
            entityId: created.id,
            after: { type: dto.type, machineId: ctx.machine.id, severity: SEVERITY[dto.type] },
            ip,
          },
          tx,
        );
        return { duplicate: false, issue: toDto(full) };
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        const winner = await this.findByKey(ctx.factoryId, dto.idempotencyKey);
        if (winner) return this.replay(winner, user);
      }
      throw e;
    }
  }

  async openForMyStation(user: AuthUser) {
    const ctx = await this.station.resolve(user);
    if (!ctx) throw new NotFoundException('No station is assigned to you right now.');
    const rows = await this.prisma.issue.findMany({
      where: { machineId: ctx.machine.id, status: { not: 'resolved' } },
      include,
      orderBy: { openedAt: 'asc' },
    });
    return rows.map(toDto);
  }

  // ---------- managers: review ----------

  async list(user: AuthUser, query: unknown) {
    const q = parseBody(listSchema, query);
    const rows = await this.prisma.issue.findMany({
      where: {
        factoryId: { in: user.factoryIds },
        status: q.status ?? { not: 'resolved' },
        ...(q.machineId ? { machineId: q.machineId } : {}),
        ...(q.lineId ? { lineId: q.lineId } : {}),
        ...(q.since ? { openedAt: { gte: new Date(q.since) } } : {}),
      },
      include,
      orderBy: { openedAt: 'desc' },
      take: q.limit,
    });
    return rows.map(toDto);
  }

  async acknowledge(user: AuthUser, rawId: string, ip: string | null) {
    const id = parseUuid(rawId);
    const issue = await this.findAccessible(user, id);

    if (issue.status === 'resolved') throw new BadRequestException('This issue is already resolved.');
    if (issue.status === 'acknowledged') return { duplicate: true, issue: toDto(issue) };

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.issue.updateMany({
        where: { id, status: 'open' },
        data: { status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedById: user.id },
      });
      const full = await tx.issue.findUniqueOrThrow({ where: { id }, include });
      if (changed.count !== 1) return { duplicate: true, issue: toDto(full) };

      await this.audit.log(
        {
          actor: user,
          factoryId: issue.factoryId,
          action: 'issue.acknowledged',
          entityType: 'issue',
          entityId: id,
          ip,
        },
        tx,
      );
      return { duplicate: false, issue: toDto(full) };
    });
  }

  async resolve(user: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(resolveSchema, input ?? {});
    const issue = await this.findAccessible(user, id);

    if (user.role === 'operator') {
      if (issue.openedById !== user.id || !OPERATOR_RESOLVABLE.includes(issue.type)) {
        throw new ForbiddenException('A manager must resolve this issue.');
      }
    }
    if (issue.status === 'resolved') return { duplicate: true, issue: toDto(issue) };

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${issue.machineId}::text))`;

      const fresh = await tx.issue.findUniqueOrThrow({ where: { id }, include });
      if (fresh.status === 'resolved') return { duplicate: true, issue: toDto(fresh) };

      const now = new Date();
      await tx.issue.update({
        where: { id },
        data: {
          status: 'resolved',
          resolvedAt: now,
          resolvedById: user.id,
          resolutionNote: dto.resolutionNote || null,
        },
      });
      await tx.downtimeEvent.updateMany({
        where: { issueId: id, endedAt: null },
        data: { endedAt: now },
      });

      const remaining = await tx.issue.findMany({
        where: { machineId: issue.machineId, status: { not: 'resolved' } },
        select: { type: true },
      });
      const machine = await tx.machine.findUniqueOrThrow({
        where: { id: issue.machineId },
        select: { status: true },
      });
      if (machine.status !== 'maintenance' && machine.status !== 'offline') {
        const next: MachineStatus =
          remaining.length === 0
            ? 'running'
            : remaining.some((r) => r.type === 'machine_issue')
              ? 'breakdown'
              : 'idle';
        if (next !== machine.status) {
          await tx.machine.update({
            where: { id: issue.machineId },
            data: { status: next, statusSince: now },
          });
        }
      }

      const full = await tx.issue.findUniqueOrThrow({ where: { id }, include });
      await this.audit.log(
        {
          actor: user,
          factoryId: issue.factoryId,
          action: 'issue.resolved',
          entityType: 'issue',
          entityId: id,
          before: { status: issue.status },
          after: { status: 'resolved', durationMinutes: toDto(full).durationMinutes },
          ip,
        },
        tx,
      );
      return { duplicate: false, issue: toDto(full) };
    });
  }

  // ---------- downtime ----------

  async listDowntime(user: AuthUser, query: unknown) {
    const q = parseBody(downtimeQuerySchema, query);
    const since = q.since ? new Date(q.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await this.prisma.downtimeEvent.findMany({
      where: {
        factoryId: { in: user.factoryIds },
        OR: [{ startedAt: { gte: since } }, { endedAt: null }],
        ...(q.machineId ? { machineId: q.machineId } : {}),
        ...(q.lineId ? { machine: { lineId: q.lineId } } : {}),
      },
      include: { machine: { select: { name: true, code: true, lineId: true } } },
      orderBy: { startedAt: 'desc' },
      take: q.limit,
    });

    const now = new Date();
    return rows.map((d) => ({
      id: d.id,
      machineId: d.machineId,
      machineName: d.machine.name,
      machineCode: d.machine.code,
      lineId: d.machine.lineId,
      issueId: d.issueId,
      reason: d.reason,
      planned: d.planned,
      startedAt: d.startedAt.toISOString(),
      endedAt: d.endedAt ? d.endedAt.toISOString() : null,
      ongoing: d.endedAt === null,
      minutes: minutesBetween(d.startedAt, d.endedAt ?? now),
    }));
  }

  // ---------- helpers ----------

  private findByKey(factoryId: string, idempotencyKey: string) {
    return this.prisma.issue.findUnique({
      where: { factoryId_idempotencyKey: { factoryId, idempotencyKey } },
      include,
    });
  }

  private replay(existing: Row, user: AuthUser) {
    if (existing.openedById !== user.id) {
      throw new ConflictException('This request key was already used.');
    }
    return { duplicate: true, issue: toDto(existing) };
  }

  private async findAccessible(user: AuthUser, id: string) {
    const row = await this.prisma.issue.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException();
    assertFactoryAccess(user, row.factoryId);
    return row;
  }
}