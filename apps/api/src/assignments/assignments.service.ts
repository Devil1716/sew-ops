import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = toDate(s);
    return !Number.isNaN(d.getTime()) && day(d) === s;
  }, 'Invalid date (use YYYY-MM-DD)');

const createSchema = z
  .object({
    userId: z.string().uuid(),
    machineId: z.string().uuid(),
    shiftId: z.string().uuid(),
    startDate: dateSchema,
    endDate: dateSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

const endSchema = z.object({ endDate: dateSchema }).strict();

const listQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  machineId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  activeOn: dateSchema.optional(),
});

const include = {
  user: { select: { name: true, employeeCode: true } },
  machine: { select: { name: true, code: true } },
  shift: { select: { name: true } },
} satisfies Prisma.OperatorAssignmentInclude;

type Row = Prisma.OperatorAssignmentGetPayload<{ include: typeof include }>;

const toDto = (a: Row) => ({
  id: a.id,
  factoryId: a.factoryId,
  userId: a.userId,
  operatorName: a.user.name,
  employeeCode: a.user.employeeCode,
  machineId: a.machineId,
  machineName: a.machine.name,
  machineCode: a.machine.code,
  shiftId: a.shiftId,
  shiftName: a.shift.name,
  startDate: day(a.startDate),
  endDate: a.endDate ? day(a.endDate) : null,
});

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, query: unknown) {
    const q = parseBody(listQuerySchema, query);
    if (q.factoryId) assertFactoryAccess(actor, q.factoryId);

    const where: Prisma.OperatorAssignmentWhereInput = {
      factoryId: q.factoryId ?? { in: actor.factoryIds },
      ...(q.machineId ? { machineId: q.machineId } : {}),
      ...(q.shiftId ? { shiftId: q.shiftId } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
    };
    if (q.activeOn) {
      const d = toDate(q.activeOn);
      where.startDate = { lte: d };
      where.AND = [{ OR: [{ endDate: null }, { endDate: { gte: d } }] }];
    }

    const rows = await this.prisma.operatorAssignment.findMany({
      where,
      include,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toDto);
  }

  async create(actor: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);

    const [machine, shift, operator] = await Promise.all([
      this.prisma.machine.findUnique({ where: { id: dto.machineId } }),
      this.prisma.shift.findUnique({ where: { id: dto.shiftId } }),
      this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, role: true, isActive: true, factories: { select: { factoryId: true } } },
      }),
    ]);
    if (!machine || !shift || !operator) {
      throw new BadRequestException('Machine, shift or operator not found.');
    }
    assertFactoryAccess(actor, machine.factoryId);

    if (
      shift.factoryId !== machine.factoryId ||
      !operator.factories.some((f) => f.factoryId === machine.factoryId)
    ) {
      throw new BadRequestException('Machine, shift and operator must belong to the same factory.');
    }
    if (operator.role !== 'operator' || !operator.isActive) {
      throw new BadRequestException('The user must be an active operator.');
    }
    if (!machine.isActive || !shift.isActive) {
      throw new BadRequestException('The machine and shift must be active.');
    }

    const start = toDate(dto.startDate);
    const end = dto.endDate ? toDate(dto.endDate) : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const clash = await tx.operatorAssignment.findFirst({
        where: {
          shiftId: dto.shiftId,
          OR: [{ machineId: dto.machineId }, { userId: dto.userId }],
          ...(end ? { startDate: { lte: end } } : {}),
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: start } }] }],
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(
          'Overlaps an existing assignment for this machine or operator in that shift.',
        );
      }

      const row = await tx.operatorAssignment.create({
        data: {
          factoryId: machine.factoryId,
          userId: dto.userId,
          machineId: dto.machineId,
          shiftId: dto.shiftId,
          startDate: start,
          endDate: end,
        },
        include,
      });
      await this.audit.log(
        {
          actor,
          factoryId: row.factoryId,
          action: 'assignment.created',
          entityType: 'operator_assignment',
          entityId: row.id,
          after: toDto(row),
          ip,
        },
        tx,
      );
      return row;
    });
    return toDto(created);
  }

  /** Assignments are history: you can end or shorten them, never delete or extend. */
  async end(actor: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(endSchema, input);

    const before = await this.prisma.operatorAssignment.findUnique({ where: { id }, include });
    if (!before) throw new NotFoundException();
    assertFactoryAccess(actor, before.factoryId);

    const end = toDate(dto.endDate);
    if (end < before.startDate) {
      throw new BadRequestException('endDate must be on or after the start date.');
    }
    if (before.endDate && end > before.endDate) {
      throw new BadRequestException('You can only end or shorten an assignment. Create a new one to extend.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operatorAssignment.update({
        where: { id },
        data: { endDate: end },
        include,
      });
      await this.audit.log(
        {
          actor,
          factoryId: row.factoryId,
          action: 'assignment.ended',
          entityType: 'operator_assignment',
          entityId: id,
          before: toDto(before),
          after: toDto(row),
          ip,
        },
        tx,
      );
      return row;
    });
    return toDto(updated);
  }
}