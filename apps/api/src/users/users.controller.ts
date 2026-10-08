import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.users.list(user, query);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.users.create(user, body, ip);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.users.update(user, id, body, ip);
  }

  @Roles('admin')
  @Post(':id/credentials')
  resetCredentials(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.users.resetCredentials(user, id, body, ip);
  }
}