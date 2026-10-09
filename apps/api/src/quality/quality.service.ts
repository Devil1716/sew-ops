import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

export const DEFECT_TYPES = [
  'broken_stitch',
  'skipped_stitch',
  'open_seam',
  'puckering',
  'stain',
  'wrong_measurement',
  'uneven_hem',
  'loose_thread',
  'other',
] as const;

const keySchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid key');

const qty = z.number().int().min(0).max(1_000_000);

const createSchema = z
  .object({
    workOrderId: z.string().uuid(),
    machineId: z.string().uuid().nullable().optional(),
    inspectedQty: qty,
    rejectedQty: qty,
    defectType: z.enum(DEFECT_TYPES).nullable().optional(),
    note: z.string().trim().max(500).optional(),
    idempotencyKey: keySchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (v.inspectedQty === 0 && v.rejectedQty === 0) bad('inspectedQty', 'Enter an inspected or rejected quantity');
    if (v.inspectedQty > 0 && v.rejectedQty > v.inspectedQty) bad('rejectedQty', 'Rejected cannot exceed inspected');
    if (v.rejectedQty > 0 && !v.defectType) bad('defectType', 'A defect type is required when pieces are rejected');
    if (v.rejectedQty === 0 && v.defectType) bad('defectType', 'A defect type is only allowed with rejected pieces');
  });

const listSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  machineId: z.string().uuid().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  includeVoided: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const include = {
  workOrder: { select: { orderNumber: true } },
  machine: { select: { code: true } },
  inspector: { select: { name: true } },
} satisfies Prisma.QualityCheckInclude;

type Row = Prisma.QualityCheckGetPayload<{ include: typeof include }>;

const toDto = (q: Row) => ({
  id: q.id,
  workOrderId: q.workOrderId,
  orderNumber: q.workOrder.orderNumber,
  machineId: q.machineId,
  machineCode: q.machine?.code ?? null,
  inspectedQty: q.inspectedQty,
  rejectedQty: q.rejectedQty,
  defectType: q.defectType,
  note: q.note,
  inspector: q.inspector?.name ?? null,
  checkedAt: q.checkedAt.toISOString(),
  voided: q.voidedAt !== null,
});

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);

    const workOrder = await this.prisma.workOrder.findUnique({ where: { id: dto.workOrderId } });
    if (!workOrder) throw new NotFoundException();
    assertFactoryAccess(user, workOrder.factoryId);

    const existing = await this.findByKey(workOrder.factoryId, dto.idempotencyKey);
    if (existing) return this.replay(existing, user);

    if (workOrder.status === 'cancelled') throw new BadRequestException('This work order is cancelled.');
    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine || machine.factoryId !== workOrder.factoryId) {
        throw new BadRequestException('Machine not found in this factory.');
      }
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.qualityCheck.create({
          data: {
            factoryId: workOrder.factoryId,
            workOrderId: workOrder.id,
            machineId: dto.machineId ?? null,
            inspectorId: user.id,
            inspectedQty: dto.inspectedQty,
            rejectedQty: dto.rejectedQty,
            defectType: dto.defectType ?? null,
            note: dto.note || null,
            idempotencyKey: dto.idempotencyKey,
          },
          include,
        });
        await this.audit.log(
          {
            actor: user,
            factoryId: workOrder.factoryId,
            action: 'quality.check_created',
            entityType: 'quality_check',
            entityId: created.id,
            after: toDto(created),
            ip,
          },
          tx,
        );
        return created;
      });
      return { duplicate: false, check: toDto(row) };
    } catch (e) {
      if (isUniqueViolation(e)) {
        const winner = await this.findByKey(workOrder.factoryId, dto.idempotencyKey);
        if (winner) return this.replay(winner, user);
      }
      throw e;
    }
  }

  async list(user: AuthUser, query: unknown) {
    const q = parseBody(listSchema, query);
    const rows = await this.prisma.qualityCheck.findMany({
      where: {
        factoryId: { in: user.factoryIds },
        ...(q.includeVoided === 'true' ? {} : { voidedAt: null }),
        ...(q.workOrderId ? { workOrderId: q.workOrderId } : {}),
        ...(q.machineId ? { machineId: q.machineId } : {}),
        ...(q.since ? { checkedAt: { gte: new Date(q.since) } } : {}),
      },
      include,
      orderBy: { checkedAt: 'desc' },
      take: q.limit,
    });
    return rows.map(toDto);
  }

  /** Quality checks are never deleted. A mistaken entry is voided and audited. */
  async void(user: AuthUser, rawId: string, ip: string | null) {
    const id = parseUuid(rawId);
    const row = await this.prisma.qualityCheck.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException();
    assertFactoryAccess(user, row.factoryId);
    if (row.voidedAt) return { duplicate: true, check: toDto(row) };

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.qualityCheck.updateMany({
        where: { id, voidedAt: null },
        data: { voidedAt: new Date() },
      });
      const fresh = await tx.qualityCheck.findUniqueOrThrow({ where: { id }, include });
      if (changed.count !== 1) return { duplicate: true, check: toDto(fresh) };

      await this.audit.log(
        {
          actor: user,
          factoryId: row.factoryId,
          action: 'quality.check_voided',
          entityType: 'quality_check',
          entityId: id,
          before: toDto(row),
          after: toDto(fresh),
          ip,
        },
        tx,
      );
      return { duplicate: false, check: toDto(fresh) };
    });
  }

  private findByKey(factoryId: string, idempotencyKey: string) {
    return this.prisma.qualityCheck.findUnique({
      where: { factoryId_idempotencyKey: { factoryId, idempotencyKey } },
      include,
    });
  }

  private replay(existing: Row, user: AuthUser) {
    if (existing.inspectorId !== user.id) {
      throw new ConflictException('This request key was already used.');
    }
    return { duplicate: true, check: toDto(existing) };
  }
}