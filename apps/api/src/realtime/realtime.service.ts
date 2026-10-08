import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { RT } from './events';

interface PieceResult {
  duplicate: boolean;
  event: {
    id: string;
    machineId: string;
    lineId: string;
    workOrderId: string;
    type: string;
    quantity: number;
    occurredAt: string;
  };
  workOrder: { id: string; quantityCompleted: number; quantityTarget: number } | null;
}

interface IssueResult {
  duplicate: boolean;
  issue: { id: string; machineId: string } & Record<string, unknown>;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger('Realtime');
  private server: Server | null = null;

  constructor(private readonly prisma: PrismaService) {}

  attach(server: Server) {
    this.server = server;
  }

  toFactory(factoryId: string, event: string, payload: unknown) {
    try {
      this.server?.to(`factory:${factoryId}`).emit(event, payload);
    } catch (e) {
      this.logger.warn(`emit failed for ${event}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Call AFTER the database transaction has committed. Never throws. */
  async pieceChanged(r: PieceResult) {
    if (r.duplicate) return;
    await this.safely(async () => {
      const machine = await this.machineSnapshot(r.event.machineId);
      if (!machine) return;
      this.toFactory(machine.factoryId, RT.PieceCompleted, {
        factoryId: machine.factoryId,
        machineId: r.event.machineId,
        lineId: r.event.lineId,
        workOrderId: r.event.workOrderId,
        eventId: r.event.id,
        type: r.event.type,
        quantity: r.event.quantity,
        quantityCompleted: r.workOrder?.quantityCompleted ?? null,
        quantityTarget: r.workOrder?.quantityTarget ?? null,
        occurredAt: r.event.occurredAt,
      });
      this.toFactory(machine.factoryId, RT.MachineStatusChanged, machine);
    });
  }

  async issueChanged(kind: 'opened' | 'acknowledged' | 'resolved', r: IssueResult) {
    if (r.duplicate) return;
    await this.safely(async () => {
      const machine = await this.machineSnapshot(r.issue.machineId);
      if (!machine) return;
      const event =
        kind === 'opened'
          ? RT.IssueOpened
          : kind === 'resolved'
            ? RT.IssueResolved
            : RT.IssueAcknowledged;
      this.toFactory(machine.factoryId, event, { ...r.issue, factoryId: machine.factoryId });
      this.toFactory(machine.factoryId, RT.MachineStatusChanged, machine);
    });
  }

  workOrderChanged(workOrder: { id: string; factoryId: string } & Record<string, unknown>) {
    this.toFactory(workOrder.factoryId, RT.WorkOrderUpdated, workOrder);
  }

  private async machineSnapshot(machineId: string) {
    const m = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: {
        id: true,
        factoryId: true,
        lineId: true,
        status: true,
        statusSince: true,
        lastEventAt: true,
      },
    });
    if (!m) return null;
    return {
      machineId: m.id,
      factoryId: m.factoryId,
      lineId: m.lineId,
      status: m.status,
      statusSince: m.statusSince.toISOString(),
      lastEventAt: m.lastEventAt ? m.lastEventAt.toISOString() : null,
    };
  }

  private async safely(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      this.logger.warn(`publish failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}