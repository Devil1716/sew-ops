import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { RealtimeService } from '../realtime/realtime.service';
import { WorkOrdersService } from './work-orders.service';

@Roles('admin', 'manager')
@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    private readonly workOrders: WorkOrdersService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    return this.workOrders.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workOrders.get(user, id);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown, @ClientIp() ip: string | null) {
    const created = await this.workOrders.create(user, body, ip);
    this.realtime.workOrderChanged(created);
    return created;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    const updated = await this.workOrders.update(user, id, body, ip);
    this.realtime.workOrderChanged(updated);
    return updated;
  }

  @Post(':id/assignments')
  addAssignment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    return this.workOrders.addAssignment(user, id, body, ip);
  }

  @Delete(':id/assignments/:assignmentId')
  removeAssignment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @ClientIp() ip: string | null,
  ) {
    return this.workOrders.removeAssignment(user, id, assignmentId, ip);
  }
}