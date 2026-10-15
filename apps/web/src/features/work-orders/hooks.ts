"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type WorkOrderStatus = "scheduled" | "active" | "paused" | "completed" | "cancelled";

export interface WorkOrderAssignment {
  id: string;
  lineId: string;
  machineId: string | null;
  shiftId: string | null;
}

export interface LiveWorkOrder {
  id: string;
  factoryId: string;
  orderNumber: string;
  styleCode: string;
  garment: string;
  quantityTarget: number;
  quantityCompleted: number;
  status: WorkOrderStatus;
  plannedStart: string;
  plannedEnd: string | null;
  lineIds: string[];
  assignments: WorkOrderAssignment[];
}

export interface NewWorkOrder {
  factoryId: string;
  orderNumber: string;
  styleCode: string;
  garment: string;
  quantityTarget: number;
  plannedStart: string;
  plannedEnd?: string;
}

export interface WorkOrderPatch {
  styleCode?: string;
  garment?: string;
  quantityTarget?: number;
  plannedEnd?: string | null;
  status?: WorkOrderStatus;
}

export function useWorkOrderList() {
  return useQuery({
    queryKey: ["work-orders", "list"],
    queryFn: () => api.get<LiveWorkOrder[]>("/work-orders"),
    refetchInterval: 60_000,
  });
}

function useRefreshAfterWorkOrderChange() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["work-orders"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateWorkOrder() {
  const refresh = useRefreshAfterWorkOrderChange();
  return useMutation({
    mutationFn: (body: NewWorkOrder) => api.post<LiveWorkOrder>("/work-orders", body),
    onSuccess: refresh,
  });
}

export function useUpdateWorkOrder() {
  const refresh = useRefreshAfterWorkOrderChange();
  return useMutation({
    mutationFn: (input: { id: string; patch: WorkOrderPatch }) =>
      api.patch<LiveWorkOrder>(`/work-orders/${input.id}`, input.patch),
    onSuccess: refresh,
  });
}

export function useAddAssignment() {
  const refresh = useRefreshAfterWorkOrderChange();
  return useMutation({
    mutationFn: (input: { id: string; lineId: string; machineId?: string; shiftId?: string }) =>
      api.post<WorkOrderAssignment>(`/work-orders/${input.id}/assignments`, {
        lineId: input.lineId,
        machineId: input.machineId,
        shiftId: input.shiftId,
      }),
    onSuccess: refresh,
  });
}

export function useRemoveAssignment() {
  const refresh = useRefreshAfterWorkOrderChange();
  return useMutation({
    mutationFn: (input: { id: string; assignmentId: string }) =>
      api.delete<unknown>(`/work-orders/${input.id}/assignments/${input.assignmentId}`),
    onSuccess: refresh,
  });
}