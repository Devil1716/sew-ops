import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { findCurrentShift, localClock } from '../common/shift-time';
import { PrismaService } from '../prisma/prisma.service';

const day = (d: Date) => d.toISOString().slice(0, 10);

export interface StationContext {
  factoryId: string;
  businessDate: string;
  machine: { id: string; code: string; name: string; status: string };
  line: { id: string; code: string; name: string };
  shift: { id: string; name: string };
  workOrder: {
    id: string;
    orderNumber: string;
    styleCode: string;
    garment: string;
    quantityTarget: number;
    quantityCompleted: number;
  } | null;
}

@Injectable()
export class StationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Where is this operator working right now, and on what? null = nowhere. */
  async resolve(user: AuthUser): Promise<StationContext | null> {
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const assignments = await this.prisma.operatorAssignment.findMany({
      where: { userId: user.id, OR: [{ endDate: null }, { endDate: { gte: since } }] },
      include: { machine: { include: { line: true, factory: true } }, shift: true },
    });

    for (const a of assignments) {
      if (!a.machine.isActive || !a.shift.isActive || !a.machine.factory.isActive) continue;

      const current = findCurrentShift([a.shift], localClock(a.machine.factory.timezone));
      if (!current) continue;

      const businessDate = current.businessDate;
      if (day(a.startDate) > businessDate) continue;
      if (a.endDate && day(a.endDate) < businessDate) continue;

      const workOrder = await this.findWorkOrder(
        a.machine.factoryId,
        a.machine.id,
        a.machine.lineId,
        a.shift.id,
      );

      return {
        factoryId: a.machine.factoryId,
        businessDate,
        machine: {
          id: a.machine.id,
          code: a.machine.code,
          name: a.machine.name,
          status: a.machine.status,
        },
        line: { id: a.machine.line.id, code: a.machine.line.code, name: a.machine.line.name },
        shift: { id: a.shift.id, name: a.shift.name },
        workOrder,
      };
    }
    return null;
  }

  /** Most specific active work order wins: machine+shift, machine, line+shift, line. */
  private async findWorkOrder(factoryId: string, machineId: string, lineId: string, shiftId: string) {
    const rows = await this.prisma.workOrderAssignment.findMany({
      where: {
        factoryId,
        lineId,
        workOrder: { status: 'active' },
        AND: [
          { OR: [{ machineId }, { machineId: null }] },
          { OR: [{ shiftId }, { shiftId: null }] },
        ],
      },
      include: { workOrder: true },
    });
    if (rows.length === 0) return null;

    const score = (r: (typeof rows)[number]) => (r.machineId ? 2 : 0) + (r.shiftId ? 1 : 0);
    rows.sort(
      (a, b) =>
        score(b) - score(a) || a.workOrder.plannedStart.getTime() - b.workOrder.plannedStart.getTime(),
    );

    const w = rows[0].workOrder;
    return {
      id: w.id,
      orderNumber: w.orderNumber,
      styleCode: w.styleCode,
      garment: w.garment,
      quantityTarget: w.quantityTarget,
      quantityCompleted: w.quantityCompleted,
    };
  }
}