import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Gives every request an id (returned in X-Request-Id) and writes one log line when it finishes.
 * Only the method, the path (without the query string), the status and the time are logged:
 * never bodies, cookies, headers or credentials.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
      const path = (req.originalUrl ?? req.url).split('?')[0];
      if (path === '/health') return;

      const status = res.statusCode;
      const production = process.env.NODE_ENV === 'production';
      // Development stays quiet: only problems and slow requests.
      if (!production && status < 400 && ms < 1000) return;

      if (production) {
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
        console.log(JSON.stringify({ time: new Date().toISOString(), level, requestId: id, method: req.method, path, status, ms }));
      } else {
        console.log(`${req.method} ${path} ${status} ${ms}ms [${id.slice(0, 8)}]`);
      }
    });
    next();
  }
}