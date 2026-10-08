import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Shift } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { nameSchema, parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm');

const createSchema = z
  .object({
    factoryId: z.string().uuid(),
    name: nameSchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .strict()
  .refine((v) => v.startsAt !== v.endsAt, {
    message: 'Start and end time cannot be the same',
    path: ['endsAt'],
  });

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    startsAt: timeSchema.optional(),
    endsAt: timeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const listQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const toDto = (s: Shift) => ({
  id: s.id,
  factoryId: s.factoryId,
  name: s.name,
  startsAt: s.startsAt,
  endsAt: s.endsAt,
  isActive: s.isActive,
});

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: unknown) {
    const q = parseBody(listQuerySchema, query);
    if (q.factoryId) assertFactoryAccess(user, q.factoryId);

    const rows = await this.prisma.shift.findMany({
      where: {
        factoryId: q.factoryId ?? { in: user.factoryIds },
        ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);
    assertFactoryAccess(user, dto.factoryId);

    const created = await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.create({ data: dto });
      await this.audit.log(
        {
          actor: user,
          factoryId: shift.factoryId,
          action: 'shift.created',
          entityType: 'shift',
          entityId: shift.id,
          after: toDto(shift),
          ip,
        },
        tx,
      );
      return shift;
    });
    return toDto(created);
  }

  async update(user: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(updateSchema, input);

    const before = await this.prisma.shift.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    assertFactoryAccess(user, before.factoryId);

    const startsAt = dto.startsAt ?? before.startsAt;
    const endsAt = dto.endsAt ?? before.endsAt;
    if (startsAt === endsAt) throw new BadRequestException('Start and end time cannot be the same.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.update({ where: { id }, data: dto });
      await this.audit.log(
        {
          actor: user,
          factoryId: shift.factoryId,
          action: 'shift.updated',
          entityType: 'shift',
          entityId: id,
          before: toDto(before),
          after: toDto(shift),
          ip,
        },
        tx,
      );
      return shift;
    });
    return toDto(updated);
  }
}