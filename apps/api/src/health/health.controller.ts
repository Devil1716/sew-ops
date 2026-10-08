import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'sew-ops-api',
        database: 'down',
      });
    }
    return {
      status: 'ok',
      service: 'sew-ops-api',
      database: 'up',
      time: new Date().toISOString(),
    };
  }
}