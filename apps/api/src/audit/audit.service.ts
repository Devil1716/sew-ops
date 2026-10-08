import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actor: AuthUser;
  factoryId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

const toJson = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass a transaction client (tx) so the audit row commits or rolls back with the change. */
  async log(entry: AuditEntry, db: Prisma.TransactionClient = this.prisma) {
    await db.auditLog.create({
      data: {
        factoryId: entry.factoryId,
        actorId: entry.actor.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ipAddress: entry.ip ?? null,
      },
    });
  }
}