import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { ClientIp } from '../common/client-ip.decorator';
import { RT } from '../realtime/events';
import { RealtimeService } from '../realtime/realtime.service';
import { MaintenanceService } from './maintenance.service';

@Roles('admin', 'manager')
@Controller('machines')
export class MaintenanceController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly realtime: RealtimeService,
  ) {}

  @Post(':id/maintenance')
  @HttpCode(200)
  async set(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @ClientIp() ip: string | null,
  ) {
    const result = await this.maintenance.set(user, id, body, ip);
    if (!result.duplicate) {
      this.realtime.toFactory(result.machine.factoryId, RT.MachineStatusChanged, result.machine);
    }
    return result;
  }
}