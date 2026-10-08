import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ProductionEvent } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { parseBody } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { StationService } from './station.service';

const UNDO_WINDOW_MS = 120_000;
const MAX_PAST_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

const keySchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid key');

const recordSchema = z.object({
  idempotencyKey: keySchema,
  quantity: z.number().int().min(1).max(50).default(1),
  occurredAt: z
    .string()
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .optional(),
});

const undoSchema = z.object({ idempotencyKey: keySchema });

const listSchema = z.object({
  machineId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const toDto = (e: ProductionEvent) => ({
  id: e.id,
  machineId: e.machineId,
  lineId: e.lineId,
  workOrderId: e.workOrderId,
  operatorId: e.operatorId,
  type: e.type,
  quantity: e.quantity,
  idempotencyKey: e.idempotencyKey,
  reversesEventId: e.reversesEventId,
  occurredAt: e.occurredAt.toISOString(),
  createdAt: e.createdAt.toISOString(),
});

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly station: StationService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Piece Completed ----------

  async recordPiece(user: AuthUser, input: unknown) {
    const dto = parseBody(recordSchema, input);

    const ctx = await this.station.resolve(user);
    if (!ctx) throw new NotFoundException('No station is assigned to you right now.');

    const now = Date.now();
    const occurredAt = dto.occurredAt ?? new Date(now);
    if (occurredAt.getTime() > now + MAX_FUTURE_MS || occurredAt.getTime() < now - MAX_PAST_MS) {
      throw new BadRequestException('occurredAt is outside the allowed time window.');
    }

    // Retry / double-tap / offline replay: answer with the original result, count nothing twice.
    const existing = await this.findByKey(ctx.factoryId, dto.idempotencyKey);
    if (existing) return this.replay(existing, user);

    if (!ctx.workOrder) {
      throw new ConflictException('No active work order is assigned to this station.');
    }
    const workOrderId = ctx.workOrder.id;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.productionEvent.create({
          data: {
            factoryId: ctx.factoryId,
            machineId: ctx.machine.id,
            lineId: ctx.line.id,
            workOrderId,
            operatorId: user.id,
            type: 'piece_completed',
            quantity: dto.quantity,
            idempotencyKey: dto.idempotencyKey,
            occurredAt,
          },
        });

        // Atomic increment, only while the work order is still active.
        const updated = await tx.workOrder.updateMany({
          where: { id: workOrderId, status: 'active' },
          data: { quantityCompleted: { increment: dto.quantity } },
        });
        if (updated.count !== 1) {
          throw new ConflictException('This work order is no longer active.');
        }

        await tx.machine.updateMany({
          where: { id: ctx.machine.id, status: { in: ['idle', 'offline'] } },
          data: { status: 'running', statusSince: new Date() },
        });
        await tx.machine.update({
          where: { id: ctx.machine.id },
          data: { lastEventAt: new Date() },
        });

        const workOrder = await tx.workOrder.findUniqueOrThrow({
          where: { id: workOrderId },
          select: { id: true, quantityCompleted: true, quantityTarget: true },
        });
        return { duplicate: false, event: toDto(event), workOrder };
      });
    } catch (e) {
      // Two identical requests raced: the loser lands here. Return the winner''s result.
      if (isUniqueViolation(e)) {
        const winner = await this.findByKey(ctx.factoryId, dto.idempotencyKey);
        if (winner) return this.replay(winner, user);
      }
      throw e;
    }
  }

  // ---------- Undo (a reversing event, never a delete) ----------

  async undo(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(undoSchema, input);

    const original = await this.prisma.productionEvent.findFirst({
      where: { idempotencyKey: dto.idempotencyKey, factoryId: { in: user.factoryIds } },
    });
    if (!original) throw new NotFoundException();
    if (original.type !== 'piece_completed') {
      throw new BadRequestException('Only completed-piece events can be undone.');
    }

    if (user.role === 'operator') {
      if (original.operatorId !== user.id) throw new NotFoundException();
      if (Date.now() - original.createdAt.getTime() > UNDO_WINDOW_MS) {
        throw new ForbiddenException('The undo window has passed. Ask a manager to correct it.');
      }
    }

    const done = await this.prisma.productionEvent.findUnique({
      where: { reversesEventId: original.id },
    });
    if (done) return this.undoResult(done, original.workOrderId, true);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const reversal = await tx.productionEvent.create({
          data: {
            factoryId: original.factoryId,
            machineId: original.machineId,
            lineId: original.lineId,
            workOrderId: original.workOrderId,
            operatorId: user.id,
            type: 'pieces_undo',
            quantity: -original.quantity,
            idempotencyKey: `undo:${original.id}`,
            reversesEventId: original.id,
            occurredAt: new Date(),
          },
        });

        const updated = await tx.workOrder.updateMany({
          where: { id: original.workOrderId, quantityCompleted: { gte: original.quantity } },
          data: { quantityCompleted: { decrement: original.quantity } },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Cannot undo: the work order count is too low.');
        }

        await this.audit.log(
          {
            actor: user,
            factoryId: original.factoryId,
            action: 'production.event_undone',
            entityType: 'production_event',
            entityId: original.id,
            after: { reversalId: reversal.id, quantity: -original.quantity },
            ip,
          },
          tx,
        );

        const workOrder = await tx.workOrder.findUniqueOrThrow({
          where: { id: original.workOrderId },
          select: { id: true, quantityCompleted: true, quantityTarget: true },
        });
        return { duplicate: false, event: toDto(reversal), workOrder };
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        const reversal = await this.prisma.productionEvent.findUnique({
          where: { reversesEventId: original.id },
        });
        if (reversal) return this.undoResult(reversal, original.workOrderId, true);
        throw new ConflictException('This event was already undone.');
      }
      throw e;
    }
  }

  // ---------- recent events (managers) ----------

  async list(user: AuthUser, query: unknown) {
    const q = parseBody(listSchema, query);
    const rows = await this.prisma.productionEvent.findMany({
      where: {
        factoryId: { in: user.factoryIds },
        ...(q.machineId ? { machineId: q.machineId } : {}),
        ...(q.workOrderId ? { workOrderId: q.workOrderId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });
    return rows.map(toDto);
  }

  // ---------- helpers ----------

  private findByKey(factoryId: string, idempotencyKey: string) {
    return this.prisma.productionEvent.findUnique({
      where: { factoryId_idempotencyKey: { factoryId, idempotencyKey } },
    });
  }

  private async replay(existing: ProductionEvent, user: AuthUser) {
    if (existing.operatorId !== user.id) {
      throw new ConflictException('This request key was already used.');
    }
    return this.undoResult(existing, existing.workOrderId, true);
  }

  private async undoResult(event: ProductionEvent, workOrderId: string, duplicate: boolean) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, quantityCompleted: true, quantityTarget: true },
    });
    return { duplicate, event: toDto(event), workOrder };
  }
}