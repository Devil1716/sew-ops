import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

let cachedServer: Express | null = null;

/**
 * Creates or retrieves the cached Express instance backed by NestJS.
 * Essential for Vercel Serverless Functions to avoid re-bootstrapping NestJS on warm requests.
 */
export async function createServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }
  const expressApp: Express = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  configureApp(app);
  await app.init();
  cachedServer = expressApp;
  return expressApp;
}

/**
 * Vercel Serverless Function entrypoint handler.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = await createServer();
  return (server as any)(req, res);
}

/**
 * Standalone HTTP server for local dev (npm run dev:api) and Docker production.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Sew Ops API running on http://localhost:${port}`);
}

// In serverless environments like Vercel, requests are dispatched via the exported handler above.
// Only bind to a TCP port if running standalone (local dev, test runner, Docker).
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  void bootstrap();
}
