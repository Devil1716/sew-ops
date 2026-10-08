import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { codeSchema, nameSchema, parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const userSelect = {
  id: true,
  name: true,
  email: true,
  employeeCode: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  factories: { select: { factoryId: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

const toDto = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  employeeCode: u.employeeCode,
  role: u.role,
  isActive: u.isActive,
  factoryIds: u.factories.map((f) => f.factoryId),
  lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  createdAt: u.createdAt.toISOString(),
});

function isWeakPin(pin: string) {
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = pin.split('').map(Number);
  const asc = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
  const desc = d.every((v, i) => i === 0 || v === d[i - 1] - 1);
  return asc || desc;
}

const pinSchema = z
  .string()
  .regex(/^\d{6}$/, 'PIN must be exactly 6 digits')
  .refine((p) => !isWeakPin(p), 'PIN is too easy to guess');

const passwordSchema = z.string().min(12, 'Password must be at least 12 characters').max(128);
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const factoryIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(20)
  .transform((ids) => [...new Set(ids)]);

const createSchema = z.discriminatedUnion('role', [
  z
    .object({
      role: z.literal('operator'),
      name: nameSchema,
      factoryIds: factoryIdsSchema,
      employeeCode: codeSchema(2),
      pin: pinSchema,
    })
    .strict(),
  z
    .object({
      role: z.literal('manager'),
      name: nameSchema,
      factoryIds: factoryIdsSchema,
      email: emailSchema,
      password: passwordSchema,
    })
    .strict(),
  z
    .object({
      role: z.literal('admin'),
      name: nameSchema,
      factoryIds: factoryIdsSchema,
      email: emailSchema,
      password: passwordSchema,
    })
    .strict(),
]);

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    isActive: z.boolean().optional(),
    factoryIds: factoryIdsSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const credentialsSchema = z.union([
  z.object({ password: passwordSchema }).strict(),
  z.object({ pin: pinSchema }).strict(),
]);

const listQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  role: z.nativeEnum(Role).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, query: unknown) {
    const q = parseBody(listQuerySchema, query);
    if (q.factoryId) assertFactoryAccess(actor, q.factoryId);

    const rows = await this.prisma.user.findMany({
      where: {
        factories: { some: { factoryId: q.factoryId ?? { in: actor.factoryIds } } },
        // Managers only ever see operators.
        ...(actor.role === 'manager' ? { role: Role.operator } : q.role ? { role: q.role } : {}),
        ...(q.includeInactive === 'true' ? {} : { isActive: true }),
      },
      select: userSelect,
      orderBy: { name: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(actor: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(createSchema, input);
    dto.factoryIds.forEach((id) => assertFactoryAccess(actor, id));

    const base = {
      name: dto.name,
      role: dto.role as Role,
      factories: { create: dto.factoryIds.map((factoryId) => ({ factoryId })) },
    };
    const data =
      dto.role === 'operator'
        ? { ...base, employeeCode: dto.employeeCode, pinHash: await hash(dto.pin) }
        : { ...base, email: dto.email, passwordHash: await hash(dto.password) };

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data, select: userSelect });
      await this.audit.log(
        {
          actor,
          factoryId: dto.factoryIds[0],
          action: 'user.created',
          entityType: 'user',
          entityId: user.id,
          after: toDto(user),
          ip,
        },
        tx,
      );
      return user;
    });
    return toDto(created);
  }

  async update(actor: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(updateSchema, input);
    const before = await this.findManageable(actor, id);

    if (id === actor.id && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    if (id === actor.id && dto.factoryIds) {
      throw new BadRequestException('You cannot change your own factory access.');
    }
    dto.factoryIds?.forEach((fid) => assertFactoryAccess(actor, fid));

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.factoryIds) {
        // Only touch factories the acting admin controls; others stay as they were.
        await tx.userFactory.deleteMany({
          where: { userId: id, factoryId: { in: actor.factoryIds, notIn: dto.factoryIds } },
        });
        await tx.userFactory.createMany({
          data: dto.factoryIds.map((factoryId) => ({ userId: id, factoryId })),
          skipDuplicates: true,
        });
      }

      await tx.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      if (dto.isActive === false) {
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const after = await tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
      await this.audit.log(
        {
          actor,
          factoryId: after.factories[0]?.factoryId ?? null,
          action: dto.isActive === false ? 'user.deactivated' : 'user.updated',
          entityType: 'user',
          entityId: id,
          before: toDto(before),
          after: toDto(after),
          ip,
        },
        tx,
      );
      return after;
    });
    return toDto(updated);
  }

  async resetCredentials(actor: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(credentialsSchema, input);
    const target = await this.findManageable(actor, id);

    if (id === actor.id) {
      throw new BadRequestException('Use the change-password feature for your own account.');
    }

    let data: { passwordHash: string } | { pinHash: string };
    if ('pin' in dto) {
      if (target.role !== 'operator') throw new BadRequestException('PINs are only for operators.');
      data = { pinHash: await hash(dto.pin) };
    } else {
      if (target.role === 'operator') {
        throw new BadRequestException('Operators use a PIN, not a password.');
      }
      data = { passwordHash: await hash(dto.password) };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { ...data, failedLoginCount: 0, lockedUntil: null },
      });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log(
        {
          actor,
          factoryId: target.factories[0]?.factoryId ?? null,
          action: 'user.credentials_reset',
          entityType: 'user',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  }

  private async findManageable(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user || !user.factories.some((f) => actor.factoryIds.includes(f.factoryId))) {
      throw new NotFoundException();
    }
    return user;
  }
}