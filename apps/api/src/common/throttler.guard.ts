import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard that accurately extracts the real client IP behind reverse proxies
 * (such as Vercel Edge, Next.js rewrites, Caddy, Cloudflare) from x-forwarded-for or x-real-ip headers.
 * Prevents multiple users behind the same proxy from sharing and exhausting a single rate limit bucket.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
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
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  }
}

