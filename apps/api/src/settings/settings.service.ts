import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { ALERT_KEY, loadAlertRules } from './alert-rules';

const getSchema = z.object({ factoryId: z.string().uuid().optional() });

const updateSchema = z
  .object({
    factoryId: z.string().uuid().optional(),
    rules: z
      .object({
        machine_issue: z.boolean().optional(),
        thread_empty: z.boolean().optional(),
        material_missing: z.boolean().optional(),
        quality_issue: z.boolean().optional(),
        other: z.boolean().optional(),
      })
      .strict(),
  })
  .strict()
  .refine((v) => Object.values(v.rules).some((x) => x !== undefined), 'Nothing to change');

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async resolveFactory(user: AuthUser, factoryId?: string) {
    let id = factoryId;
    if (id) assertFactoryAccess(user, id);
    else if (user.factoryIds.length === 1) id = user.factoryIds[0];
    else throw new BadRequestException('factoryId is required.');

    const factory = await this.prisma.factory.findUnique({
      where: { id },
      select: { id: true, name: true, timezone: true },
    });
    if (!factory) throw new NotFoundException();
    return factory;
  }

  async get(user: AuthUser, query: unknown) {
    const q = parseBody(getSchema, query);
    const factory = await this.resolveFactory(user, q.factoryId);
    return {
      factoryId: factory.id,
      factoryName: factory.name,
      timezone: factory.timezone,
      alertRules: await loadAlertRules(this.prisma, factory.id),
    };
  }

  async updateAlertRules(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(updateSchema, input);
    const factory = await this.resolveFactory(user, dto.factoryId);

    const before = await loadAlertRules(this.prisma, factory.id);
    const changes = Object.fromEntries(Object.entries(dto.rules).filter(([, v]) => v !== undefined));
    const after = { ...before, ...changes };

    await this.prisma.$transaction(async (tx) => {
      const value = after as unknown as Prisma.InputJsonValue;
      await tx.factorySetting.upsert({
        where: { factoryId_key: { factoryId: factory.id, key: ALERT_KEY } },
        create: { factoryId: factory.id, key: ALERT_KEY, value },
        update: { value },
      });
      await this.audit.log(
        {
          actor: user,
          factoryId: factory.id,
          action: 'settings.alert_rules_updated',
          entityType: 'factory',
          entityId: factory.id,
          before,
          after,
          ip,
        },
        tx,
      );
    });
    return { factoryId: factory.id, alertRules: after };
  }
}