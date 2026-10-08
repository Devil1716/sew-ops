import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_COOKIE } from './auth.constants';
import { IS_PUBLIC_KEY } from './auth.decorators';
import { AuthService } from './auth.service';
import type { RequestWithUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException();

    req.user = await this.auth.authenticate(token);
    return true;
  }
}