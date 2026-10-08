import { Injectable, NotFoundException } from '@nestjs/common';
import type { Factory } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { codeSchema, nameSchema, parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const timezoneSchema = z.string().trim().refine(isValidTimezone, 'Invalid timezone');

const createSchema = z.object({
  name: nameSchema,
  code: codeSchema(2),
  timezone: timezoneSchema.default('Asia/Kolkata'),
});

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    timezone: timezoneSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const toDto = (f: Factory) => ({
  id: f.id,
  name: f.name,
  code: f.code,
  timezone: f.timezone,
  isActive: f.isActive,
  createdAt: f.createdAt.toISOString(),
});

@Injectable()
export class FactoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser) {
    const rows = await this.prisma.factory.findMany({
      where: { id: { in: user.factoryIds } },
      orderBy: { name: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);
    const created = await this.prisma.$transaction(async (tx) => {
      const factory = await tx.factory.create({ data: dto });
      await tx.userFactory.create({ data: { userId: user.id, factoryId: factory.id } });
      await this.audit.log(
        {
          actor: user,
          factoryId: factory.id,
          action: 'factory.created',
          entityType: 'factory',
          entityId: factory.id,
          after: toDto(factory),
          ip,
        },
        tx,
      );
      return factory;
    });
    return toDto(created);
  }

  async update(user: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(updateSchema, input);
    assertFactoryAccess(user, id);

    const before = await this.prisma.factory.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();

    const updated = await this.prisma.$transaction(async (tx) => {
      const factory = await tx.factory.update({ where: { id }, data: dto });
      await this.audit.log(
        {
          actor: user,
          factoryId: id,
          action: 'factory.updated',
          entityType: 'factory',
          entityId: id,
          before: toDto(before),
          after: toDto(factory),
          ip,
        },
        tx,
      );
      return factory;
    });
    return toDto(updated);
  }
}