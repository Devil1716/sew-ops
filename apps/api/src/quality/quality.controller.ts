import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { QualityService } from './quality.service';

@Roles('admin', 'manager')
@Controller('quality')
export class QualityController {
  constructor(private readonly quality: QualityService) {}

  @Post('checks')
  @HttpCode(200)
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.quality.create(user, body, ip);
  }

  @Get('checks')
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.quality.list(user, query);
  }

  @Post('checks/:id/void')
  @HttpCode(200)
  void(@CurrentUser() user: AuthUser, @Param('id') id: string, @ClientIp() ip: string | null) {
    return this.quality.void(user, id, ip);
  }
}