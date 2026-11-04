import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { allowedOrigins } from '../common/origins';

type IoOptions = NonNullable<Parameters<IoAdapter['createIOServer']>[1]>;

/** Reads CORS_ORIGIN at runtime (after .env is loaded), not at import time. */
export class SocketAdapter extends IoAdapter {
  private readonly redisLogger = new Logger(SocketAdapter.name);
  private readonly pub: Redis | null;
  private readonly sub: Redis | null;

  constructor(app: any) {
    super(app);
    const redisUrl = process.env.REALTIME_REDIS_URL ?? process.env.REDIS_URL;
    if (!redisUrl && process.env.NODE_ENV === 'production') {
      throw new Error('REALTIME_REDIS_URL (or REDIS_URL) is required for production realtime fan-out');
    }

    if (redisUrl) {
      this.pub = new Redis(redisUrl, { maxRetriesPerRequest: null });
      this.sub = this.pub.duplicate();
      for (const client of [this.pub, this.sub]) {
        client.on('error', (error) => this.redisLogger.error(`Redis realtime connection error: ${error.message}`));
      }
      this.pub.on('ready', () => this.redisLogger.log('Redis realtime publisher connected'));
      this.sub.on('ready', () => this.redisLogger.log('Redis realtime subscriber connected'));
    } else {
      this.pub = null;
      this.sub = null;
      this.redisLogger.warn('Redis realtime adapter disabled outside production; broadcasts are instance-local');
    }
  }

  createIOServer(port: number, options?: IoOptions) {
    const server = super.createIOServer(port, {
      ...(options ?? {}),
      // WebSocket-only avoids Socket.IO polling sessions, which need sticky routing
      // and cannot be guaranteed across independently scaled function instances.
      transports: ['websocket'],
      cors: { origin: allowedOrigins(), credentials: true },
      maxHttpBufferSize: 100_000,
    } as IoOptions);
    if (this.pub && this.sub) server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  async close(server: Parameters<IoAdapter['close']>[0]) {
    await super.close(server);
    await Promise.all([this.pub?.quit(), this.sub?.quit()]);
  }
}
