import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@Roles('admin', 'manager')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('kpis')
  kpis(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.dashboard.kpis(user, query);
  }

  @Get('lines')
  lines(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.dashboard.lines(user, query);
  }

  @Get('trend')
  trend(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.dashboard.trend(user, query);
  }

  @Get('downtime')
  downtime(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.dashboard.downtime(user, query);
  }
}