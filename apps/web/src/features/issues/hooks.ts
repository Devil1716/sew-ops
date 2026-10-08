"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Issue, OpenIssueRequest } from "@sew-ops/shared";
import { api, apiPostIdempotent } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export function useOpenIssues() {
  return useQuery({
    queryKey: qk.issues({ /* status filter is server-side */ }),
    queryFn: () => api.get<Issue[]>("/issues?status=open"),
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
