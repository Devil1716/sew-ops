import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<Request>().ip ?? null,
);