import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const listSchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

const toDto = (n: Notification) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  entityType: n.entityType,
  entityId: n.entityId,
  readAt: n.readAt ? n.readAt.toISOString() : null,
  createdAt: n.createdAt.toISOString(),
});

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Alerts belong to one person: you only ever see and change your own. */
  async list(user: AuthUser, query: unknown) {
    const q = parseBody(listSchema, query);
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id, ...(q.unread === 'true' ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: q.limit,
      }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items: items.map(toDto), unreadCount };
  }

  async markRead(user: AuthUser, rawId: string) {
    const id = parseUuid(rawId);
    const row = await this.prisma.notification.findFirst({ where: { id, userId: user.id } });
    if (!row) throw new NotFoundException();
    if (!row.readAt) {
      await this.prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
    }
    return { ok: true };
  }

  async markAllRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}