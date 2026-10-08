import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { LinesService } from './lines.service';

@Controller('lines')
export class LinesController {
  constructor(private readonly lines: LinesService) {}

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.lines.list(user, query);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.lines.create(user, body, ip);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.lines.update(user, id, body, ip);
  }
}