import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ReportResult, ReportsService } from './reports.service';

@Roles('admin', 'manager')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('production')
  async production(@CurrentUser() user: AuthUser, @Query() query: unknown, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.reports.production(user, query));
  }

  @Get('downtime')
  async downtime(@CurrentUser() user: AuthUser, @Query() query: unknown, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.reports.downtime(user, query));
  }

  @Get('quality')
  async quality(@CurrentUser() user: AuthUser, @Query() query: unknown, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.reports.quality(user, query));
  }

  private send(res: Response, r: ReportResult) {
    if (r.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${r.filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      return r.csvText ?? '';
    }
    return r.data;
  }
}