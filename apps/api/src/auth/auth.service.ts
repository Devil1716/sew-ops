import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { Role } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TTL_SECONDS,
  GENERIC_LOGIN_ERROR,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  REFRESH_TTL_DAYS,
} from './auth.constants';
import type { AuthUser, ClientMeta, PublicUser } from './auth.types';

type UserWithFactories = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  factories: { factoryId: string }[];
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newRefreshToken = () => randomBytes(32).toString('base64url');
const refreshExpiry = () => new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

@Injectable()
export class AuthService {
  private readonly secret: string;
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    if (this.secret.length < 32) {
      throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
    }
  }

  async login(email: string, password: string, meta: ClientMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { factories: { select: { factoryId: true } } },
    });

    let ok = false;
    const lockedNow = !!user?.lockedUntil && user.lockedUntil > new Date();

    if (user && user.passwordHash && user.isActive && user.role !== 'operator' && !lockedNow) {
      ok = await this.safeVerify(user.passwordHash, password);
      if (!ok) await this.recordFailure(user.id);
    } else {
      // Same work for unknown/locked accounts so response time does not reveal anything.
      await this.safeVerify(await this.getDummyHash(), password);
    }

    if (!ok || !user) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const { sessionId, refreshToken } = await this.createSession(user.id, meta);
    const accessToken = await this.signAccess(user.id, user.role, sessionId);

    await this.prisma.auditLog.create({
      data: {
        factoryId: user.factories[0]?.factoryId ?? null,
        actorId: user.id,
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        ipAddress: meta.ip,
      },
    });

    return { accessToken, refreshToken, user: this.toPublic(user) };
  }

  async refresh(rawToken: string | undefined, meta: ClientMeta) {
    if (!rawToken) throw new UnauthorizedException();
    const oldHash = sha256(rawToken);

    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: oldHash },
      include: { user: { include: { factories: { select: { factoryId: true } } } } },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      throw new UnauthorizedException();
    }

    const newToken = newRefreshToken();
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, refreshTokenHash: oldHash, revokedAt: null },
      data: {
        refreshTokenHash: sha256(newToken),
        expiresAt: refreshExpiry(),
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ipAddress: meta.ip,
      },
    });
    if (rotated.count !== 1) throw new UnauthorizedException();

    const accessToken = await this.signAccess(session.user.id, session.user.role, session.id);
    return { accessToken, refreshToken: newToken, user: this.toPublic(session.user) };
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const tokenHash = sha256(rawToken);
    const session = await this.prisma.authSession.findUnique({ where: { refreshTokenHash: tokenHash } });
    if (!session || session.revokedAt) return;

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'auth.logout',
        entityType: 'user',
        entityId: session.userId,
      },
    });
  }

  async authenticate(accessToken: string): Promise<AuthUser> {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(accessToken, {
        secret: this.secret,
      });
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: { include: { factories: { select: { factoryId: true } } } } },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException();
    }

    return { ...this.toPublic(session.user), sessionId: session.id };
  }

  // ---------- helpers ----------

  private async createSession(userId: string, meta: ClientMeta) {
    const refreshToken = newRefreshToken();
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: sha256(refreshToken),
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ipAddress: meta.ip,
        expiresAt: refreshExpiry(),
      },
    });
    return { sessionId: session.id, refreshToken };
  }

  private signAccess(userId: string, role: Role, sessionId: string) {
    return this.jwt.signAsync(
      { sub: userId, role, sid: sessionId },
      { secret: this.secret, expiresIn: ACCESS_TTL_SECONDS },
    );
  }

  private async recordFailure(userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });

    if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginCount: 0,
          lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000),
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'auth.account_locked',
          entityType: 'user',
          entityId: userId,
        },
      });
    }
  }

  private async safeVerify(passwordHash: string, password: string) {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private getDummyHash() {
    if (!this.dummyHash) this.dummyHash = hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }

  private toPublic(user: UserWithFactories): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      factoryIds: user.factories.map((f) => f.factoryId),
    };
  }
}