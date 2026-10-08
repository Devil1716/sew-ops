import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Machine, MachineStatus } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { codeSchema, nameSchema, parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const modelSchema = z.string().trim().max(80);

const createSchema = z.object({
  lineId: z.string().uuid(),
  name: nameSchema,
  code: codeSchema(1),
  model: modelSchema.nullable().optional(),
});

const updateSchema = z
  .object({
    lineId: z.string().uuid().optional(),
    name: nameSchema.optional(),
    code: codeSchema(1).optional(),
    model: modelSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const listQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  lineId: z.string().uuid().optional(),
  status: z.nativeEnum(MachineStatus).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const toDto = (m: Machine) => ({
  id: m.id,
  lineId: m.lineId,
  factoryId: m.factoryId,
  name: m.name,
  code: m.code,
  model: m.model,
  status: m.status,
  lastEventAt: m.lastEventAt ? m.lastEventAt.toISOString() : null,
  isActive: m.isActive,
});

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: unknown) {
    const q = parseBody(listQuerySchema, query);
    if (q.factoryId) assertFactoryAccess(user, q.factoryId);

    const rows = await this.prisma.machine.findMany({
      where: {
        factoryId: q.factoryId ?? { in: user.factoryIds },
        ...(q.lineId ? { lineId: q.lineId } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      },
      orderBy: { code: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);

    const line = await this.prisma.line.findUnique({ where: { id: dto.lineId } });
    if (!line) throw new NotFoundException();
    assertFactoryAccess(user, line.factoryId);
    if (!line.isActive) throw new BadRequestException('That line is inactive.');

    const created = await this.prisma.$transaction(async (tx) => {
      const machine = await tx.machine.create({
        data: {
          factoryId: line.factoryId,
          lineId: line.id,
          name: dto.name,
          code: dto.code,
          model: dto.model || null,
        },
      });
      await this.audit.log(
        {
          actor: user,
          factoryId: machine.factoryId,
          action: 'machine.created',
          entityType: 'machine',
          entityId: machine.id,
          after: toDto(machine),
          ip,
        },
        tx,
      );
      return machine;
    });
    return toDto(created);
  }

  async update(user: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(updateSchema, input);

    const before = await this.prisma.machine.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    assertFactoryAccess(user, before.factoryId);

    if (dto.lineId && dto.lineId !== before.lineId) {
      const line = await this.prisma.line.findUnique({ where: { id: dto.lineId } });
      if (!line || line.factoryId !== before.factoryId || !line.isActive) {
        throw new BadRequestException('Line not found in this factory.');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const machine = await tx.machine.update({
        where: { id },
        data: { ...dto, ...(dto.model !== undefined ? { model: dto.model || null } : {}) },
      });
      await this.audit.log(
        {
          actor: user,
          factoryId: machine.factoryId,
          action: 'machine.updated',
          entityType: 'machine',
          entityId: id,
          before: toDto(before),
          after: toDto(machine),
          ip,
        },
        tx,
      );
      return machine;
    });
    return toDto(updated);
  }
}