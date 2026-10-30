import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { allowedOrigins } from './common/origins';
import { SocketAdapter } from './realtime/socket.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Behind the HTTPS front door every request arrives from the proxy: trust exactly its forwarded address,
  // so the login rate limit and the audit log see the real visitor (0 = no proxy, e.g. on your PC in dev mode).
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(proxyHops) && proxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  app.useWebSocketAdapter(new SocketAdapter(app));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Sew Ops API running on http://localhost:${port}`);
}

void bootstrap();