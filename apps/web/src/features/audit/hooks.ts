"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export interface AuditEntry {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorRole: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
}

export interface AuditFilters {
  category: string;
  from: string; // YYYY-MM-DD or ""
  to: string;
  factoryId?: string;
}

export function useAuditLog(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: ["audit", filters],
    initialPageParam: "" as string,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: "50" });
      if (filters.category) q.set("category", filters.category);
      if (filters.factoryId) q.set("factoryId", filters.factoryId);
      if (filters.from) q.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
      if (filters.to) q.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
      if (pageParam) q.set("before", pageParam);
      return api.get<{ items: AuditEntry[]; nextBefore: string | null }>(`/audit-logs?${q.toString()}`);
    },
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
}