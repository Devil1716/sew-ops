import { IoAdapter } from '@nestjs/platform-socket.io';
import { allowedOrigins } from '../common/origins';

type IoOptions = NonNullable<Parameters<IoAdapter['createIOServer']>[1]>;

/** Reads CORS_ORIGIN at runtime (after .env is loaded), not at import time. */
export class SocketAdapter extends IoAdapter {
  createIOServer(port: number, options?: IoOptions) {
    return super.createIOServer(port, {
      ...(options ?? {}),
      cors: { origin: allowedOrigins(), credentials: true },
      maxHttpBufferSize: 100_000,
    } as IoOptions);
  }
}