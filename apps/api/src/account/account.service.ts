import { BadRequestException, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { parseBody } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const schema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(12, 'Password must be at least 12 characters').max(128),
  })
  .strict();

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async changePassword(user: AuthUser, input: unknown, ip: string | null) {
    const dto = parseBody(schema, input);

    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!row?.passwordHash) throw new BadRequestException('This account does not use a password.');

    let ok = false;
    try {
      ok = await verify(row.passwordHash, dto.currentPassword);
    } catch {
      ok = false;
    }
    if (!ok) throw new BadRequestException('The current password is not correct.');
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('Choose a password different from the current one.');
    }

    const passwordHash = await hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      });
      // Every other device is signed out; this session stays.
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: user.sessionId } },
        data: { revokedAt: new Date() },
      });
      await this.audit.log(
        {
          actor: user,
          factoryId: user.factoryIds[0] ?? null,
          action: 'account.password_changed',
          entityType: 'user',
          entityId: user.id,
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  }
}