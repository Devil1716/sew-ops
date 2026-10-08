"use client";
import { useQuery } from "@tanstack/react-query";
import type { ListFilters, Machine } from "@sew-ops/shared";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

function toQuery(f?: ListFilters) {
  if (!f) return "";
  const qs = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function useMachines(filters?: ListFilters) {
  return useQuery({
    queryKey: qk.machines(filters),
    queryFn: () => api.get<Machine[]>(`/machines${toQuery(filters)}`),
  });
}
