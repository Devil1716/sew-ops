"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export interface LiveLine {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  targetPerShift: number;
  isActive: boolean;
}

export function useLinesList() {
  return useQuery({
    queryKey: ["lines", "list"],
    queryFn: () => api.get<LiveLine[]>("/lines"),
    staleTime: 60_000,
  });
}