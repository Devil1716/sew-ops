"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Issue, OpenIssueRequest } from "@sew-ops/shared";
import { api, apiPostIdempotent } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export type LiveIssue = Issue & {
  machineName: string;
  machineCode: string;
  lineName: string;
  durationMinutes: number;
  acknowledgedAt: string | null;
};

/** Everything not yet resolved (open and acknowledged). */
export function useOpenIssues() {
  return useQuery({
    queryKey: qk.issues({}),
    queryFn: () => api.get<LiveIssue[]>("/issues"),
    refetchInterval: 60_000,
  });
}

export function useOpenIssueMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OpenIssueRequest) =>
      apiPostIdempotent<Issue>("/issues", payload, payload.idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: qk.issuesToday });
    },
  });
}