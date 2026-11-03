import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { allowedOrigins } from './common/origins';
import { SocketAdapter } from './realtime/socket.adapter';

/**
 * Common configuration applied to both standalone HTTP server and Vercel serverless function.
 */
export function configureApp(app: INestApplication): void {
  // Behind Vercel Edge / HTTPS reverse proxy: trust forwarded addresses so rate limiting,
  // client IP extraction, and secure cookies see the genuine visitor.
  const rawProxyHops = process.env.TRUST_PROXY_HOPS ?? (process.env.VERCEL === '1' ? '1' : '1');
  if (rawProxyHops === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  } else {
    const hops = Number(rawProxyHops);
    if (Number.isInteger(hops) && hops > 0) {
      app.getHttpAdapter().getInstance().set('trust proxy', hops);
    }
  }

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  app.useWebSocketAdapter(new SocketAdapter(app));
  app.enableShutdownHooks();
}
