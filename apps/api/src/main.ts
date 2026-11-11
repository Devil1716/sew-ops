import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

/**
 * Server Vercel actually listens on. Nest attaches Socket.IO only to the HTTP
 * server returned by the HTTP adapter, and only during `init()` — `listen()` is
 * never called on Vercel, which is why `/socket.io` answered "Cannot GET".
 * The adapter is pointed at this server before `configureApp` builds it.
 */
function createVercelServer(): Server {
  const expressApp: Express = express();
  let server: Server;
  let ready: Promise<void> | null = null;

  const boot = () => {
    if (!ready) {
      ready = (async () => {
        const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
        (app.getHttpAdapter() as ExpressAdapter).setHttpServer(server);
        configureApp(app);
        await app.init();
      })().catch((error: unknown) => {
        ready = null;
        throw error;
      });
    }
    return ready;
  };

  server = createServer((req, res) => {
    void boot()
      .then(() => expressApp(req, res))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'API failed to start';
        new Logger('Bootstrap').error(message);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.end('API failed to start');
        }
      });
  });

  void boot();
  return server;
}

let standalone: Promise<Express> | null = null;

/** Used only when this module is invoked as a function outside Vercel. */
async function standaloneExpress(): Promise<Express> {
  if (!standalone) {
    standalone = (async () => {
      const expressApp: Express = express();
      const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
      configureApp(app);
      await app.init();
      return expressApp;
    })();
  }
  return standalone;
}

async function functionHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const expressApp = await standaloneExpress();
  expressApp(req, res);
}

/**
 * Standalone HTTP server for local dev (npm run dev:api) and Docker production.
 * `listen()` mounts Socket.IO on the same server that accepts connections.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Sew Ops API running on http://localhost:${port}`);
}

// In serverless environments like Vercel, requests are dispatched via the exported server.
// Only bind to a TCP port if running standalone (local dev, test runner, Docker).
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  void bootstrap();
}

/**
 * Vercel uses a default-exported `http.Server` for WebSocket upgrades.
 * A function export only receives ordinary HTTP, so the handshake never connected.
 */
const entry: Server | typeof functionHandler =
  process.env.VERCEL === '1' ? createVercelServer() : functionHandler;

export default entry;
