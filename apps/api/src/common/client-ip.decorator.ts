import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extracts the genuine visitor IP behind Vercel Edge, Next.js rewrites, Caddy or Cloudflare.
 */
export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const headers = req.headers ?? {};
    const forwarded = headers['x-forwarded-for'] || headers['x-vercel-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const clientIp = forwarded.split(',')[0].trim();
      if (clientIp) return clientIp;
    }
    const realIp = headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }
    return req.ip ?? req.socket?.remoteAddress ?? null;
  },
);
