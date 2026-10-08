import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { IssuesService } from './issues.service';

// Many terminals share one factory IP, so terminal routes get a generous per-IP limit.
const TERMINAL_LIMIT = { default: { limit: 1200, ttl: 60_000 } };

@Controller('issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Roles('operator')
  @Throttle(TERMINAL_LIMIT)
  @Post()
  @HttpCode(200)
  open(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.issues.open(user, body, ip);
  }

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.issues.list(user, query);
  }

  @Roles('admin', 'manager')
  @Patch(':id/acknowledge')
  acknowledge(@CurrentUser() user: AuthUser, @Param('id') id: string, @ClientIp() ip: string | null) {
    return this.issues.acknowledge(user, id, ip);
  }

  @Roles('operator', 'manager', 'admin')
  @Throttle(TERMINAL_LIMIT)
  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.issues.resolve(user, id, body, ip);
  }
}

@Controller('operator/issues')
export class OperatorIssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Roles('operator')
  @Throttle(TERMINAL_LIMIT)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.issues.openForMyStation(user);
  }
}

@Controller('downtime')
export class DowntimeController {
  constructor(private readonly issues: IssuesService) {}

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.issues.listDowntime(user, query);
  }
}