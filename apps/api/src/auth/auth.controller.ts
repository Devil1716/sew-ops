import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
} from './auth.constants';
import { CurrentUser, Public, Roles } from './auth.decorators';
import { AuthService, sessionTtlMs } from './auth.service';
import type { AuthUser, ClientMeta } from './auth.types';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const operatorLoginSchema = z
  .object({
    machineCode: z.string().trim().toUpperCase().min(1).max(20),
    factoryCode: z.string().trim().toUpperCase().min(1).max(20).optional(),
    pin: z.string().regex(/^\d{6}$/),
  })
  .strict();

const REFRESH_PATH = '/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Email and password are required.');

    const result = await this.auth.login(parsed.data.email, parsed.data.password, this.meta(req));
    this.setCookies(res, result.accessToken, result.refreshToken, sessionTtlMs(result.user.role));
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('operator-login')
  @HttpCode(200)
  async operatorLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = operatorLoginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Machine code and a 6-digit PIN are required.');

    const result = await this.auth.operatorLogin(parsed.data, this.meta(req));
    this.setCookies(res, result.accessToken, result.refreshToken, sessionTtlMs('operator'));
    return { user: result.user, station: result.station };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const result = await this.auth.refresh(cookies?.[REFRESH_COOKIE], this.meta(req));
    this.setCookies(res, result.accessToken, result.refreshToken, sessionTtlMs(result.user.role));
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string> | undefined;
    await this.auth.logout(cookies?.[REFRESH_COOKIE]);
    this.clearCookies(res);
    return { ok: true };
  }

  @Roles('admin', 'manager', 'operator')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    const { sessionId: _sessionId, ...publicUser } = user;
    return { user: publicUser };
  }

  // ---------- helpers ----------

  private meta(req: Request): ClientMeta {
    const headers = req.headers ?? {};
    const forwarded = headers['x-forwarded-for'] || headers['x-vercel-forwarded-for'];
    let ip = req.ip ?? null;
    if (typeof forwarded === 'string' && forwarded.trim()) {
      ip = forwarded.split(',')[0].trim() || ip;
    } else if (typeof headers['x-real-ip'] === 'string' && headers['x-real-ip'].trim()) {
      ip = headers['x-real-ip'].trim();
    }
    return { ip, userAgent: req.headers['user-agent'] ?? null };
  }

  private cookieBase() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string, refreshMaxAgeMs: number) {
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...this.cookieBase(),
      path: '/',
      maxAge: ACCESS_TTL_SECONDS * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.cookieBase(),
      path: REFRESH_PATH,
      maxAge: refreshMaxAgeMs,
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...this.cookieBase(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieBase(), path: REFRESH_PATH });
  }
}