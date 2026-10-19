import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Machine, MachineStatus } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { assertFactoryAccess } from '../common/access';
import { parseBody, parseUuid } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const schema = z.object({ on: z.boolean(), note: z.string().trim().max(200).optional() }).strict();

const snapshot = (m: Machine) => ({
  machineId: m.id,
  factoryId: m.factoryId,
  lineId: m.lineId,
  status: m.status,
  statusSince: m.statusSince.toISOString(),
  lastEventAt: m.lastEventAt ? m.lastEventAt.toISOString() : null,
});

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async set(user: AuthUser, rawId: string, input: unknown, ip: string | null) {
    const id = parseUuid(rawId);
    const dto = parseBody(schema, input);

    const machine = await this.prisma.machine.findUnique({ where: { id } });
    if (!machine) throw new NotFoundException();
    assertFactoryAccess(user, machine.factoryId);
    if (!machine.isActive) throw new BadRequestException('This machine is inactive.');

    return this.prisma.$transaction(async (tx) => {
      // Serialize with issue reports and taps on the same machine.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}::text))`;
      const fresh = await tx.machine.findUniqueOrThrow({ where: { id } });
      const now = new Date();

      if (dto.on) {
        if (fresh.status === 'maintenance') return { duplicate: true, machine: snapshot(fresh) };
        await tx.downtimeEvent.create({
          data: {
            factoryId: fresh.factoryId,
            machineId: id,
            issueId: null,
            reason: 'maintenance',
            planned: true,
            startedAt: now,
          },
        });
        const updated = await tx.machine.update({ where: { id }, data: { status: 'maintenance', statusSince: now } });
        await this.audit.log(
          {
            actor: user,
            factoryId: fresh.factoryId,
            action: 'machine.maintenance_started',
            entityType: 'machine',
            entityId: id,
            before: { status: fresh.status },
            after: { status: 'maintenance', note: dto.note ?? null },
            ip,
          },
          tx,
        );
        return { duplicate: false, machine: snapshot(updated) };
      }

      if (fresh.status !== 'maintenance') return { duplicate: true, machine: snapshot(fresh) };
      await tx.downtimeEvent.updateMany({
        where: { machineId: id, reason: 'maintenance', endedAt: null },
        data: { endedAt: now },
      });
      const open = await tx.issue.findMany({
        where: { machineId: id, status: { not: 'resolved' } },
        select: { type: true },
      });
      const next: MachineStatus = open.some((i) => i.type === 'machine_issue') ? 'breakdown' : 'idle';
      const updated = await tx.machine.update({ where: { id }, data: { status: next, statusSince: now } });
      await this.audit.log(
        {
          actor: user,
          factoryId: fresh.factoryId,
          action: 'machine.maintenance_ended',
          entityType: 'machine',
          entityId: id,
          before: { status: 'maintenance' },
          after: { status: next, note: dto.note ?? null },
          ip,
        },
        tx,
      );
      return { duplicate: false, machine: snapshot(updated) };
    });
  }
}