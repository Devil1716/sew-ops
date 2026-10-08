import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { allowedOrigins } from '../common/origins';
import { PrismaService } from '../prisma/prisma.service';
import { RT } from './events';
import { RealtimeService } from './realtime.service';

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger('Realtime');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
    const every = Number(process.env.REALTIME_SESSION_CHECK_MS ?? 20_000);
    this.timer = setInterval(() => void this.dropDeadSessions(server), every);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async handleConnection(client: Socket) {
    try {
      const origin = client.handshake.headers.origin;
      if (origin && !allowedOrigins().includes(origin)) throw new Error('origin not allowed');

      const token = readCookie(client.handshake.headers.cookie, ACCESS_COOKIE);
      if (!token) throw new Error('no session');

      const user = await this.auth.authenticate(token);
      client.data.sessionId = user.sessionId;
      client.data.userId = user.id;

      if (user.role === 'operator') {
        await client.join(`user:${user.id}`);
      } else {
        for (const factoryId of user.factoryIds) await client.join(`factory:${factoryId}`);
      }
      client.emit(RT.Ready, { role: user.role });
    } catch {
      client.disconnect(true);
    }
  }

  /** Logged-out, expired or deactivated users must not keep receiving data. */
  private async dropDeadSessions(server: Server) {
    try {
      const sockets = [...server.sockets.sockets.values()];
      const ids = [
        ...new Set(
          sockets
            .map((s) => s.data.sessionId as string | undefined)
            .filter((v): v is string => !!v),
        ),
      ];
      if (ids.length === 0) return;

      const valid = await this.prisma.authSession.findMany({
        where: {
          id: { in: ids },
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { isActive: true },
        },
        select: { id: true },
      });
      const ok = new Set(valid.map((v) => v.id));
      for (const s of sockets) {
        const sid = s.data.sessionId as string | undefined;
        if (sid && !ok.has(sid)) s.disconnect(true);
      }
    } catch (e) {
      this.logger.warn(`session check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}