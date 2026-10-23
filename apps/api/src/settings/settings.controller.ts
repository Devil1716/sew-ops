import { Body, Controller, Get, HttpCode, Patch, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { SettingsService } from './settings.service';

@Roles('admin')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.settings.get(user, query);
  }

  @Patch('alert-rules')
  @HttpCode(200)
  update(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.settings.updateAlertRules(user, body, ip);
  }
}