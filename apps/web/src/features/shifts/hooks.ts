"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export interface LiveShift {
  id: string;
  factoryId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export function useShiftsList() {
  return useQuery({
    queryKey: ["shifts", "list"],
    queryFn: () => api.get<LiveShift[]>("/shifts"),
    staleTime: 60_000,
  });
}