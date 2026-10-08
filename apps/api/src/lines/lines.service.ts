import { Injectable, NotFoundException } from '@nestjs/common';
import type { Line } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { codeSchema, nameSchema, parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const targetSchema = z.number().int().min(0).max(1_000_000);

const createSchema = z.object({
  factoryId: z.string().uuid(),
  name: nameSchema,
  code: codeSchema(1),
  targetPerShift: targetSchema.default(0),
});

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    code: codeSchema(1).optional(),
    targetPerShift: targetSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const listQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const toDto = (l: Line) => ({
  id: l.id,
  factoryId: l.factoryId,
  name: l.name,
  code: l.code,
  targetPerShift: l.targetPerShift,
  isActive: l.isActive,
});

@Injectable()
export class LinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: unknown) {
    const q = parseBody(listQuerySchema, query);
    if (q.factoryId) assertFactoryAccess(user, q.factoryId);

    const rows = await this.prisma.line.findMany({
      where: {
        factoryId: q.factoryId ?? { in: user.factoryIds },
        ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      },
      orderBy: { code: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);
    assertFactoryAccess(user, dto.factoryId);

    const created = await this.prisma.$transaction(async (tx) => {
      const line = await tx.line.create({ data: dto });
      await this.audit.log(
        {
          actor: user,
          factoryId: line.factoryId,
          action: 'line.created',
          entityType: 'line',
          entityId: line.id,
          after: toDto(line),
          ip,
        },
        tx,
      );
      return line;
    });
    return toDto(created);
  }

  async update(user: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(updateSchema, input);

    const before = await this.prisma.line.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    assertFactoryAccess(user, before.factoryId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const line = await tx.line.update({ where: { id }, data: dto });
      await this.audit.log(
        {
          actor: user,
          factoryId: line.factoryId,
          action: 'line.updated',
          entityType: 'line',
          entityId: id,
          before: toDto(before),
          after: toDto(line),
          ip,
        },
        tx,
      );
      return line;
    });
    return toDto(updated);
  }
}