import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { FactoriesService } from './factories.service';

@Controller('factories')
export class FactoriesController {
  constructor(private readonly factories: FactoriesService) {}

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.factories.list(user);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.factories.create(user, body, ip);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.factories.update(user, id, body, ip);
  }
}