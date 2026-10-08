"use client";
import { useQuery } from "@tanstack/react-query";
import type { ListFilters, WorkOrder } from "@sew-ops/shared";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export function useWorkOrders(filters?: ListFilters) {
  return useQuery({
    queryKey: qk.workOrders(filters),
    queryFn: () => api.get<WorkOrder[]>("/work-orders"),
  });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: qk.workOrder(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => api.get<WorkOrder>(`/work-orders/${id}`),
  });
}
