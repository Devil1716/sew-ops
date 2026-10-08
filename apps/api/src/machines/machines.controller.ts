import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { MachinesService } from './machines.service';

@Controller('machines')
export class MachinesController {
  constructor(private readonly machines: MachinesService) {}

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.machines.list(user, query);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.machines.create(user, body, ip);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.machines.update(user, id, body, ip);
  }
}