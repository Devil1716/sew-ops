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
  note: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
};

export type IssueView = "unresolved" | "resolved";

/** Everything not yet resolved (open and acknowledged). Used by the dashboard. */
export function useOpenIssues() {
  return useQuery({
    queryKey: qk.issues({}),
    queryFn: () => api.get<LiveIssue[]>("/issues"),
    refetchInterval: 60_000,
  });
}

/** The Issues screen: unresolved, or resolved in the last 7 days. */
export function useIssueList(view: IssueView) {
  return useQuery({
    queryKey: ["issues", "list", view],
    queryFn: () => {
      if (view === "unresolved") return api.get<LiveIssue[]>("/issues?limit=200");
      const since = encodeURIComponent(new Date(Date.now() - 7 * 86_400_000).toISOString());
      return api.get<LiveIssue[]>(`/issues?status=resolved&since=${since}&limit=200`);
    },
    refetchInterval: 60_000,
  });
}

function useRefreshAfterIssueChange() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["issues"] });
    void qc.invalidateQueries({ queryKey: ["machines"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["downtime"] });
  };
}

export function useAcknowledgeIssue() {
  const refresh = useRefreshAfterIssueChange();
  return useMutation({
    mutationFn: (id: string) => api.patch<unknown>(`/issues/${id}/acknowledge`),
    onSuccess: refresh,
  });
}

export function useResolveIssue() {
  const refresh = useRefreshAfterIssueChange();
  return useMutation({
    mutationFn: (input: { id: string; resolutionNote: string }) =>
      api.post<unknown>(`/issues/${input.id}/resolve`, {
        resolutionNote: input.resolutionNote || undefined,
      }),
    onSuccess: refresh,
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