import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { nameSchema, parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  scheduled: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));
const codeText = z.string().trim().toUpperCase().min(1).max(40);
const quantitySchema = z.number().int().min(1).max(1_000_000);

const createSchema = z
  .object({
    factoryId: z.string().uuid(),
    orderNumber: codeText,
    styleCode: codeText,
    garment: nameSchema,
    quantityTarget: quantitySchema,
    plannedStart: isoDate,
    plannedEnd: isoDate.nullable().optional(),
  })
  .strict()
  .refine((v) => !v.plannedEnd || v.plannedEnd >= v.plannedStart, {
    message: 'plannedEnd must not be before plannedStart',
    path: ['plannedEnd'],
  });

const updateSchema = z
  .object({
    styleCode: codeText.optional(),
    garment: nameSchema.optional(),
    quantityTarget: quantitySchema.optional(),
    plannedEnd: isoDate.nullable().optional(),
    status: z.nativeEnum(WorkOrderStatus).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const assignmentSchema = z
  .object({
    lineId: z.string().uuid(),
    machineId: z.string().uuid().nullable().optional(),
    shiftId: z.string().uuid().nullable().optional(),
  })
  .strict();

const listQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  status: z.nativeEnum(WorkOrderStatus).optional(),
});

const include = {
  assignments: { select: { id: true, lineId: true, machineId: true, shiftId: true } },
} satisfies Prisma.WorkOrderInclude;

type Row = Prisma.WorkOrderGetPayload<{ include: typeof include }>;

const toDto = (w: Row) => ({
  id: w.id,
  factoryId: w.factoryId,
  orderNumber: w.orderNumber,
  styleCode: w.styleCode,
  garment: w.garment,
  quantityTarget: w.quantityTarget,
  quantityCompleted: w.quantityCompleted,
  status: w.status,
  plannedStart: w.plannedStart.toISOString(),
  plannedEnd: w.plannedEnd ? w.plannedEnd.toISOString() : null,
  lineIds: [...new Set(w.assignments.map((a) => a.lineId))],
  assignments: w.assignments,
});

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, query: unknown) {
    const q = parseBody(listQuerySchema, query);
    if (q.factoryId) assertFactoryAccess(actor, q.factoryId);

    const rows = await this.prisma.workOrder.findMany({
      where: {
        factoryId: q.factoryId ?? { in: actor.factoryIds },
        ...(q.status ? { status: q.status } : {}),
      },
      include,
      orderBy: { plannedStart: 'desc' },
      take: 500,
    });
    return rows.map(toDto);
  }

  async get(actor: AuthUser, rawId: string) {
    return toDto(await this.findAccessible(actor, parseUuid(rawId)));
  }

  async create(actor: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);
    assertFactoryAccess(actor, dto.factoryId);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.workOrder.create({
        data: { ...dto, plannedEnd: dto.plannedEnd ?? null },
        include,
      });
      await this.audit.log(
        {
          actor,
          factoryId: row.factoryId,
          action: 'work_order.created',
          entityType: 'work_order',
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

  async update(actor: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(updateSchema, input);
    const before = await this.findAccessible(actor, id);

    const statusChanged = dto.status !== undefined && dto.status !== before.status;
    if (TRANSITIONS[before.status].length === 0) {
      throw new BadRequestException('Completed or cancelled work orders cannot be changed.');
    }
    if (statusChanged && !TRANSITIONS[before.status].includes(dto.status as WorkOrderStatus)) {
      throw new BadRequestException(`Cannot change status from ${before.status} to ${dto.status}.`);
    }
    if (dto.quantityTarget !== undefined && dto.quantityTarget < before.quantityCompleted) {
      throw new BadRequestException(
        `Target cannot be lower than the ${before.quantityCompleted} pieces already completed.`,
      );
    }
    const plannedEnd = dto.plannedEnd !== undefined ? dto.plannedEnd : before.plannedEnd;
    if (plannedEnd && plannedEnd < before.plannedStart) {
      throw new BadRequestException('plannedEnd must not be before plannedStart.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.workOrder.update({
        where: { id },
        data: {
          ...(dto.styleCode !== undefined ? { styleCode: dto.styleCode } : {}),
          ...(dto.garment !== undefined ? { garment: dto.garment } : {}),
          ...(dto.quantityTarget !== undefined ? { quantityTarget: dto.quantityTarget } : {}),
          ...(dto.plannedEnd !== undefined ? { plannedEnd: dto.plannedEnd } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include,
      });
      await this.audit.log(
        {
          actor,
          factoryId: row.factoryId,
          action: statusChanged ? 'work_order.status_changed' : 'work_order.updated',
          entityType: 'work_order',
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

  async addAssignment(actor: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(assignmentSchema, input);
    const workOrder = await this.findAccessible(actor, id);

    if (TRANSITIONS[workOrder.status].length === 0) {
      throw new BadRequestException('Completed or cancelled work orders cannot be reassigned.');
    }

    const line = await this.prisma.line.findUnique({ where: { id: dto.lineId } });
    if (!line || line.factoryId !== workOrder.factoryId || !line.isActive) {
      throw new BadRequestException('Line not found in this factory.');
    }
    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine || machine.lineId !== line.id || !machine.isActive) {
        throw new BadRequestException('Machine not found on that line.');
      }
    }
    if (dto.shiftId) {
      const shift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } });
      if (!shift || shift.factoryId !== workOrder.factoryId || !shift.isActive) {
        throw new BadRequestException('Shift not found in this factory.');
      }
    }

    const duplicate = await this.prisma.workOrderAssignment.findFirst({
      where: {
        workOrderId: id,
        lineId: dto.lineId,
        machineId: dto.machineId ?? null,
        shiftId: dto.shiftId ?? null,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('This assignment already exists.');

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.workOrderAssignment.create({
        data: {
          factoryId: workOrder.factoryId,
          workOrderId: id,
          lineId: dto.lineId,
          machineId: dto.machineId ?? null,
          shiftId: dto.shiftId ?? null,
        },
        select: { id: true, lineId: true, machineId: true, shiftId: true },
      });
      await this.audit.log(
        {
          actor,
          factoryId: workOrder.factoryId,
          action: 'work_order.assignment_added',
          entityType: 'work_order',
          entityId: id,
          after: row,
          ip,
        },
        tx,
      );
      return row;
    });
    return created;
  }

  async removeAssignment(actor: AuthUser, rawId: string, rawAssignmentId: string, ip: string | null) {
    const id = parseUuid(rawId);
    const assignmentId = parseUuid(rawAssignmentId);
    const workOrder = await this.findAccessible(actor, id);

    const existing = workOrder.assignments.find((a) => a.id === assignmentId);
    if (!existing) throw new NotFoundException();

    await this.prisma.$transaction(async (tx) => {
      await tx.workOrderAssignment.delete({ where: { id: assignmentId } });
      await this.audit.log(
        {
          actor,
          factoryId: workOrder.factoryId,
          action: 'work_order.assignment_removed',
          entityType: 'work_order',
          entityId: id,
          before: existing,
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  }

  private async findAccessible(actor: AuthUser, id: string) {
    const row = await this.prisma.workOrder.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException();
    assertFactoryAccess(actor, row.factoryId);
    return row;
  }
}