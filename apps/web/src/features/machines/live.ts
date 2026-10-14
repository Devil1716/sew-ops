"use client";
import { useQuery } from "@tanstack/react-query";
import type { MachineStatus } from "@sew-ops/shared";
import { api } from "@/lib/api/client";

export interface LiveMachine {
  id: string;
  lineId: string;
  factoryId: string;
  name: string;
  code: string;
  model: string | null;
  status: MachineStatus;
  lastEventAt: string | null;
  isActive: boolean;
}

export function useMachineBoard() {
  return useQuery({
    queryKey: ["machines", "board"],
    queryFn: () => api.get<LiveMachine[]>("/machines"),
    refetchInterval: 60_000,
  });
}