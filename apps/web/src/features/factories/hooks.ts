"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export interface LiveFactory {
  id: string;
  name: string;
  code: string;
  timezone: string;
  isActive: boolean;
}

export function useFactoriesList() {
  return useQuery({
    queryKey: ["factories", "list"],
    queryFn: () => api.get<LiveFactory[]>("/factories"),
    staleTime: 5 * 60_000,
  });
}