import { Body, Controller, Get, HttpCode, NotFoundException, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { ProductionService } from './production.service';
import { StationService } from './station.service';

// Many terminals share one factory IP, so these routes get a generous per-IP limit.
const TERMINAL_LIMIT = { default: { limit: 1200, ttl: 60_000 } };

@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Roles('operator')
  @Throttle(TERMINAL_LIMIT)
  @Post('events')
  @HttpCode(200)
  record(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.production.recordPiece(user, body);
  }

  @Roles('operator', 'manager', 'admin')
  @Throttle(TERMINAL_LIMIT)
  @Post('events/undo')
  @HttpCode(200)
  undo(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.production.undo(user, body, ip);
  }

  @Roles('admin', 'manager')
  @Get('events')
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.production.list(user, query);
  }
}

@Controller('operator')
export class OperatorController {
  constructor(private readonly station: StationService) {}

  @Roles('operator')
  @Throttle(TERMINAL_LIMIT)
  @Get('station')
  async get(@CurrentUser() user: AuthUser) {
    const ctx = await this.station.resolve(user);
    if (!ctx) throw new NotFoundException('No station is assigned to you right now.');
    return {
      operator: { id: user.id, name: user.name },
      machine: ctx.machine,
      line: ctx.line,
      shift: ctx.shift,
      workOrder: ctx.workOrder,
    };
  }
}