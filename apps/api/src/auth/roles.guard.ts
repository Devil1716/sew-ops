import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
import type { RequestWithUser } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    // Deny by default: every non-public route MUST declare @Roles(...)
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    if (!roles || roles.length === 0) throw new ForbiddenException();

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}