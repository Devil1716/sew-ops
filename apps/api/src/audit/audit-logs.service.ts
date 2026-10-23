import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORIES = [
  'auth',
  'user',
  'factory',
  'line',
  'machine',
  'shift',
  'assignment',
  'work_order',
  'issue',
  'production',
  'quality',
  'account',
  'settings',
] as const;

const when = z.string().datetime({ offset: true });

const querySchema = z.object({
  factoryId: z.string().uuid().optional(),
  category: z.enum(CATEGORIES).optional(),
  from: when.optional(),
  to: when.optional(),
  before: when.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first. Pass the returned nextBefore back as `before` to get older entries. */
  async list(user: AuthUser, query: unknown) {
    const q = parseBody(querySchema, query);
    if (q.factoryId) assertFactoryAccess(user, q.factoryId);

    const scope: Prisma.AuditLogWhereInput = q.factoryId
      ? { factoryId: q.factoryId }
      : {
          OR: [
            { factoryId: { in: user.factoryIds } },
            { factoryId: null, actor: { factories: { some: { factoryId: { in: user.factoryIds } } } } },
          ],
        };

    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from) createdAt.gte = new Date(q.from);
    if (q.to) createdAt.lte = new Date(q.to);
    if (q.before) createdAt.lt = new Date(q.before);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        AND: [
          scope,
          ...(q.category ? [{ action: { startsWith: `${q.category}.` } }] : []),
          ...(Object.keys(createdAt).length ? [{ createdAt }] : []),
        ],
      },
      include: { actor: { select: { name: true, role: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit,
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actorName: r.actor?.name ?? null,
        actorRole: r.actor?.role ?? null,
        ip: r.ipAddress,
        before: r.before,
        after: r.after,
      })),
      nextBefore: rows.length === q.limit ? rows[rows.length - 1].createdAt.toISOString() : null,
    };
  }
}