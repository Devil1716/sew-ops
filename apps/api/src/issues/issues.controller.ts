import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { RealtimeService } from '../realtime/realtime.service';
import { IssuesService } from './issues.service';

// Many terminals share one factory IP, so terminal routes get a generous per-IP limit.
const TERMINAL_LIMIT = { default: { limit: 1200, ttl: 60_000 } };

@Controller('issues')
export class IssuesController {
  constructor(
    private readonly issues: IssuesService,
    private readonly realtime: RealtimeService,
  ) {}

  @Roles('operator')
  @Throttle(TERMINAL_LIMIT)
  @Post()
  @HttpCode(200)
  async open(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    const result = await this.issues.open(user, body, ip);
    void this.realtime.issueChanged('opened', result);
    return result;
  }

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.issues.list(user, query);
  }

  @Roles('admin', 'manager')
  @Patch(':id/acknowledge')
  async acknowledge(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ClientIp() ip: string | null,
  ) {
    const result = await this.issues.acknowledge(user, id, ip);
    void this.realtime.issueChanged('acknowledged', result);
    return result;
  }

  @Roles('operator', 'manager', 'admin')
  @Throttle(TERMINAL_LIMIT)
  @Post(':id/resolve')
  @HttpCode(200)
  async resolve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    const result = await this.issues.resolve(user, id, body, ip);
    void this.realtime.issueChanged('resolved', result);
    return result;
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