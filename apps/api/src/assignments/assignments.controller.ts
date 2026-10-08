import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { AssignmentsService } from './assignments.service';

@Controller('operator-assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Roles('admin', 'manager')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.assignments.list(user, query);
  }

  @Roles('admin', 'manager')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    return this.assignments.create(user, body, ip);
  }

  @Roles('admin', 'manager')
  @Patch(':id')
  end(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.assignments.end(user, id, body, ip);
  }
}